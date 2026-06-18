# Ponto de entrada principal do Alfred — FastAPI endurecido para produção.
# Nenhum detalhe interno vaza para o cliente; o servidor é invisível para scanners.

import os
import json
import uuid
import time
import hashlib
import logging
import asyncio
from typing import Literal
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator

from persona import build_messages, ALFRED_GREETING
from llm import stream_completion, probe_brain, get_active_brain, get_last_latency
from memory import (
    init_db, save_turn, load_history, record_call,
    get_today_stats, list_tools, set_tool_status, audit,
)
from forge import get_forge_status

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "WARNING")),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

AUTH_TOKEN = os.getenv("ALFRED_TOKEN", "")
# Hash do token para evitar comparação em texto claro no log
_AUTH_HASH = hashlib.sha256(AUTH_TOKEN.encode()).hexdigest() if AUTH_TOKEN else ""

RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "30"))
ENV = os.getenv("ALFRED_ENV", "production")

# Origens permitidas — nunca "*" em produção
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:80")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Tamanho máximo do corpo da requisição (1 MB)
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(1 * 1024 * 1024)))

# Rate limit: contador por hash de token (ou IP como fallback)
_rate_window: dict[str, list[float]] = {}

# Falhas de autenticação (lockout após N tentativas)
_auth_failures: dict[str, list[float]] = {}
MAX_AUTH_FAILURES = 10
AUTH_FAILURE_WINDOW = 300  # 5 minutos


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    brain = await probe_brain()
    logger.warning("Alfred online. Cérebro: %s", brain)
    yield
    logger.warning("Alfred encerrando.")


# Desabilita /docs e /redoc em produção — não expõe a superfície da API
app = FastAPI(
    title="Alfred",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if ENV == "production" else "/docs",
    redoc_url=None,
    openapi_url=None if ENV == "production" else "/openapi.json",
)

# ---------------------------------------------------------------------------
# Middlewares
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    """Cabeçalhos de segurança em toda resposta — invisibilidade e proteção."""
    response: Response = await call_next(request)

    # Remove header Server — não vaza stack do servidor
    # Remove header server — uvicorn injeta o dele; sobrescrevemos com vazio
    del response.headers["server"]

    # Proteções de segurança padrão
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"

    # HSTS — só em HTTPS real
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # CSP restritivo
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; connect-src 'self'"
    )

    return response


@app.middleware("http")
async def enforce_body_size(request: Request, call_next) -> Response:
    """Bloqueia corpos maiores que MAX_BODY_BYTES antes de parsear."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return Response(status_code=413, content=b'{"detail":"Payload too large"}',
                        media_type="application/json")
    return await call_next(request)


# ---------------------------------------------------------------------------
# Auth e rate limiting
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)


def _client_key(request: Request, token: str | None) -> str:
    """Identifica o cliente pelo hash do token (preferencial) ou IP."""
    if token:
        return f"tok:{hashlib.sha256(token.encode()).hexdigest()[:16]}"
    ip = request.client.host if request.client else "unknown"
    return f"ip:{ip}"


def _check_auth_lockout(ip: str) -> None:
    """Rejeita IPs com muitas falhas de auth recentes."""
    now = time.time()
    fails = _auth_failures.get(ip, [])
    _auth_failures[ip] = [t for t in fails if now - t < AUTH_FAILURE_WINDOW]
    if len(_auth_failures[ip]) >= MAX_AUTH_FAILURES:
        # Resposta genérica — não revela motivo
        raise HTTPException(status_code=403, detail="Acesso negado.")


def verify_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    """Valida Bearer token e aplica rate limit. Resposta 403 genérica."""
    ip = request.client.host if request.client else "unknown"
    _check_auth_lockout(ip)

    if not AUTH_TOKEN:
        # Modo dev sem token: rate limit por IP
        check_rate_limit(f"ip:{ip}")
        return None

    token = credentials.credentials if credentials else None
    token_hash = hashlib.sha256(token.encode()).hexdigest() if token else ""

    if token_hash != _AUTH_HASH:
        _auth_failures.setdefault(ip, []).append(time.time())
        audit("auth_failure", target=ip)
        raise HTTPException(status_code=403, detail="Acesso negado.")

    # Rate limit por hash do token — não por IP (resiste a proxies compartilhados)
    check_rate_limit(f"tok:{token_hash[:16]}")
    return token


def check_rate_limit(key: str) -> None:
    now = time.time()
    _rate_window[key] = [t for t in _rate_window.get(key, []) if now - t < 60]
    if len(_rate_window[key]) >= RATE_LIMIT_RPM:
        raise HTTPException(status_code=429, detail="Muitas requisições.")
    _rate_window[key].append(now)


# ---------------------------------------------------------------------------
# Schemas — validação rigorosa de entrada
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=8_000)

    @field_validator("content")
    @classmethod
    def no_null_bytes(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Conteúdo inválido.")
        return v


class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., min_length=1, max_length=50)
    # session_id SEMPRE gerado pelo servidor; campo aqui só para o cliente referenciar
    session_id: str | None = Field(None, pattern=r"^[a-f0-9\-]{36}$")


class ForgeApprovalRequest(BaseModel):
    tool_name: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_]+$")
    approved: bool


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    # Sem informação de versão ou arquitetura interna
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(
    req: ChatRequest,
    request: Request,
    token: str | None = Depends(verify_token),
):
    # Session ID gerado server-side — ignora qualquer valor do cliente
    session_id = str(uuid.uuid4())

    client_messages = [m.model_dump() for m in req.messages]
    full_messages = build_messages(client_messages)

    if client_messages and client_messages[-1]["role"] == "user":
        save_turn(session_id, "user", client_messages[-1]["content"])

    async def event_stream():
        collected: list[str] = []
        t_start = time.monotonic()
        token_count = 0
        MAX_TOKENS = 4_096

        try:
            async for token in stream_completion(full_messages):
                if token_count >= MAX_TOKENS:
                    break
                token_count += 1
                collected.append(token)
                yield f"data: {json.dumps({'token': token, 'session_id': session_id})}\n\n"

            response_text = "".join(collected)
            latency = (time.monotonic() - t_start) * 1000

            save_turn(session_id, "assistant", response_text, model=get_active_brain())
            record_call(latency)

            yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"

        except Exception:
            # Nunca vaza detalhes internos para o cliente
            logger.exception("Erro interno no stream")
            yield f"data: {json.dumps({'error': 'Falha interna. Tente novamente.'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/status")
async def status(token: str | None = Depends(verify_token)):
    stats = get_today_stats()
    forge = get_forge_status()
    return {
        "brain": get_active_brain(),
        "quota": "ok",
        "scope_locked": True,
        "eval": forge["eval_summary"],
        "calls_today": stats["calls_today"],
        "avg_latency_ms": stats["avg_latency_ms"],
        "last_latency_ms": round(get_last_latency(), 1),
    }


@app.get("/api/tools")
async def tools(token: str | None = Depends(verify_token)):
    return {"tools": list_tools()}


@app.post("/api/forge/approve")
async def forge_approve(
    req: ForgeApprovalRequest,
    token: str | None = Depends(verify_token),
):
    status_val = "approved" if req.approved else "rejected"
    ok = set_tool_status(req.tool_name, status_val)
    if not ok:
        # Não revela se a ferramenta existe ou não
        raise HTTPException(status_code=403, detail="Operação não autorizada.")
    audit("forge_approval", target=req.tool_name, result=status_val)
    return {"tool": req.tool_name, "status": status_val}


# Serve o frontend buildado se o diretório existir
_FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        return Response(status_code=200)


# Absorve qualquer rota desconhecida com 403 genérico (não 404)
# — impede enumeração de rotas por scanners
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return Response(status_code=403, content=b'{"detail":"Acesso negado."}',
                    media_type="application/json")


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    logger.exception("Erro não tratado")
    return Response(status_code=500, content=b'{"detail":"Erro interno."}',
                    media_type="application/json")
