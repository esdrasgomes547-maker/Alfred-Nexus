# Ponto de entrada principal do Alfred — FastAPI + SSE + autenticação por token.

import os
import json
import uuid
import time
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from persona import build_messages, ALFRED_GREETING
from llm import stream_completion, probe_brain, get_active_brain, get_last_latency
from memory import (
    init_db, save_turn, load_history, record_call,
    get_today_stats, list_tools, set_tool_status, audit,
)
from forge import get_forge_status

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

AUTH_TOKEN = os.getenv("ALFRED_TOKEN", "")
RATE_LIMIT_RPM = int(os.getenv("RATE_LIMIT_RPM", "30"))

# Contador simples em memória para rate limiting (1 usuário)
_rate_window: dict[str, list[float]] = {}


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Alfred online. Cérebro: %s", await probe_brain())
    yield
    logger.info("Alfred encerrando.")


app = FastAPI(title="Alfred API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringir via Tailscale na produção
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

security = HTTPBearer(auto_error=False)


def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> None:
    if not AUTH_TOKEN:
        return  # sem token configurado: modo desenvolvimento local
    if not credentials or credentials.credentials != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Token inválido.")


def check_rate_limit(client_ip: str) -> None:
    now = time.time()
    window = _rate_window.setdefault(client_ip, [])
    # Remove timestamps mais antigos que 60s
    _rate_window[client_ip] = [t for t in window if now - t < 60]
    if len(_rate_window[client_ip]) >= RATE_LIMIT_RPM:
        raise HTTPException(status_code=429, detail="Muitas requisições. Aguarde um momento.")
    _rate_window[client_ip].append(now)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    session_id: str | None = None


class ForgeApprovalRequest(BaseModel):
    tool_name: str
    approved: bool


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "greeting": ALFRED_GREETING}


@app.post("/api/chat")
async def chat(
    req: ChatRequest,
    request: Request,
    _: None = Depends(verify_token),
):
    check_rate_limit(request.client.host if request.client else "unknown")

    session_id = req.session_id or str(uuid.uuid4())
    # Constrói histórico: mensagens vindas do cliente + memória da sessão
    client_messages = [m.model_dump() for m in req.messages]

    # Injeta persona do Alfred (system prompt server-side)
    full_messages = build_messages(client_messages)

    # Salva a última mensagem do usuário
    if client_messages and client_messages[-1]["role"] == "user":
        save_turn(session_id, "user", client_messages[-1]["content"])

    async def event_stream():
        collected = []
        t_start = time.monotonic()
        try:
            async for token in stream_completion(full_messages):
                collected.append(token)
                payload = json.dumps({"token": token, "session_id": session_id})
                yield f"data: {payload}\n\n"

            response_text = "".join(collected)
            latency = (time.monotonic() - t_start) * 1000

            # Persiste resposta e telemetria
            save_turn(session_id, "assistant", response_text, model=get_active_brain())
            record_call(latency)

            yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"

        except Exception as exc:
            logger.error("Erro no stream: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/status")
async def status(_: None = Depends(verify_token)):
    stats = get_today_stats()
    forge = get_forge_status()

    return {
        "brain": get_active_brain(),
        "quota": "ok",  # Groq não expõe quota via header facilmente — placeholder
        "scope_locked": True,
        "eval": forge["eval_summary"],
        "calls_today": stats["calls_today"],
        "avg_latency_ms": stats["avg_latency_ms"],
        "last_latency_ms": round(get_last_latency(), 1),
    }


@app.get("/api/tools")
async def tools(_: None = Depends(verify_token)):
    return {"tools": list_tools()}


@app.post("/api/forge/approve")
async def forge_approve(req: ForgeApprovalRequest, _: None = Depends(verify_token)):
    status_val = "approved" if req.approved else "rejected"
    ok = set_tool_status(req.tool_name, status_val)
    if not ok:
        raise HTTPException(status_code=404, detail="Ferramenta não encontrada.")
    audit("forge_approval", target=req.tool_name, result=status_val)
    return {"tool": req.tool_name, "status": status_val}


@app.get("/")
async def root():
    return {"service": "Alfred", "version": "1.0.0"}
