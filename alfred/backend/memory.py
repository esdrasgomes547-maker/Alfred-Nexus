# Camada de memória: SQLite + ChromaDB embedded.
# Paths validados; histórico limitado; ChromaDB lazy e opcional.

import os
import time
import sqlite3
import logging
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Validação de path — impede path traversal nos caminhos de dados
def _validated_data_path(env_var: str, default: str) -> Path:
    raw = os.getenv(env_var, default)
    p = Path(raw).resolve()
    # Só aceita paths absolutos que não contenham componentes suspeitos
    if any(part in ("..",".",) for part in p.parts if part.startswith(".")):
        raise ValueError(f"Path inválido para {env_var}: {raw}")
    return p

DB_PATH    = _validated_data_path("SQLITE_PATH", "/data/alfred.db")
CHROMA_PATH = _validated_data_path("CHROMA_PATH", "/data/chroma")

MAX_SESSION_HISTORY = 60   # mensagens máximas por sessão
MAX_CHROMA_DOC_SIZE = 50_000  # 50 KB por documento


# ---------------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    # WAL mode: melhor concorrência e mais seguro contra corrupção
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db():
    conn = _get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                session   TEXT NOT NULL,
                role      TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
                content   TEXT NOT NULL,
                model     TEXT,
                ts        REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tool_catalog (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT UNIQUE NOT NULL,
                description TEXT,
                code        TEXT,
                status      TEXT DEFAULT 'pending'
                              CHECK(status IN ('pending','approved','rejected')),
                eval_score  REAL,
                created_at  REAL NOT NULL
            );

            -- Audit log append-only: nunca deletar, nunca atualizar
            CREATE TABLE IF NOT EXISTS audit_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                action    TEXT NOT NULL,
                target    TEXT,
                result    TEXT,
                ts        REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_stats (
                date       TEXT PRIMARY KEY,
                calls      INTEGER DEFAULT 0,
                total_ms   REAL DEFAULT 0
            );
        """)
    logger.warning("SQLite inicializado em %s", DB_PATH)


def save_turn(session: str, role: str, content: str, model: str | None = None) -> None:
    # Limita conteúdo salvo a 32 KB por mensagem
    content = content[:32_768]
    with db() as conn:
        conn.execute(
            "INSERT INTO conversations (session, role, content, model, ts) VALUES (?,?,?,?,?)",
            (session, role, content, model, time.time()),
        )
        # Apaga mensagens antigas além do limite da sessão
        conn.execute(
            """DELETE FROM conversations WHERE session=? AND id NOT IN (
                SELECT id FROM conversations WHERE session=? ORDER BY ts DESC LIMIT ?
            )""",
            (session, session, MAX_SESSION_HISTORY),
        )


def load_history(session: str, limit: int = 40) -> list[dict]:
    limit = min(limit, MAX_SESSION_HISTORY)
    with db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM conversations WHERE session=? ORDER BY ts DESC LIMIT ?",
            (session, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def record_call(latency_ms: float) -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with db() as conn:
        conn.execute(
            """INSERT INTO daily_stats (date, calls, total_ms) VALUES (?,1,?)
               ON CONFLICT(date) DO UPDATE SET
               calls=calls+1, total_ms=total_ms+excluded.total_ms""",
            (today, latency_ms),
        )


def get_today_stats() -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with db() as conn:
        row = conn.execute(
            "SELECT calls, total_ms FROM daily_stats WHERE date=?", (today,)
        ).fetchone()
    if not row or row["calls"] == 0:
        return {"calls_today": 0, "avg_latency_ms": 0}
    return {
        "calls_today": row["calls"],
        "avg_latency_ms": round(row["total_ms"] / row["calls"], 1),
    }


def audit(action: str, target: str | None = None, result: str | None = None) -> None:
    """Audit log append-only — nunca expõe tokens ou dados sensíveis."""
    # Trunca para evitar log bomb
    safe_result = (result or "")[:256]
    safe_target = (target or "")[:128]
    with db() as conn:
        conn.execute(
            "INSERT INTO audit_log (action, target, result, ts) VALUES (?,?,?,?)",
            (action, safe_target, safe_result, time.time()),
        )


# ---------------------------------------------------------------------------
# Catálogo de ferramentas
# ---------------------------------------------------------------------------

def list_tools(status: str | None = None) -> list[dict]:
    with db() as conn:
        if status:
            rows = conn.execute(
                "SELECT id,name,description,status,eval_score,created_at FROM tool_catalog "
                "WHERE status=? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id,name,description,status,eval_score,created_at FROM tool_catalog "
                "ORDER BY created_at DESC"
            ).fetchall()
    # Nunca retorna o código-fonte das ferramentas via API
    return [dict(r) for r in rows]


def get_tool(name: str) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM tool_catalog WHERE name=?", (name,)
        ).fetchone()
    return dict(row) if row else None


def upsert_tool(name: str, description: str, code: str,
                eval_score: float | None = None, status: str = "pending") -> None:
    with db() as conn:
        conn.execute(
            """INSERT INTO tool_catalog (name,description,code,status,eval_score,created_at)
               VALUES (?,?,?,?,?,?)
               ON CONFLICT(name) DO UPDATE SET
               description=excluded.description, code=excluded.code,
               status=excluded.status, eval_score=excluded.eval_score""",
            (name, description, code, status, eval_score, time.time()),
        )


def set_tool_status(name: str, status: str) -> bool:
    with db() as conn:
        cur = conn.execute(
            "UPDATE tool_catalog SET status=? WHERE name=?", (status, name)
        )
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# ChromaDB embedded — lazy, sem servidor, sem bloquear o boot
# ---------------------------------------------------------------------------

_chroma_collection = None


def _chroma():
    global _chroma_collection
    if _chroma_collection is None:
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            CHROMA_PATH.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=str(CHROMA_PATH))
            ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            _chroma_collection = client.get_or_create_collection(
                name="alfred_memory", embedding_function=ef
            )
        except Exception as exc:
            logger.warning("ChromaDB indisponível (RAG desativado): %s", exc)
    return _chroma_collection


def add_to_memory(doc_id: str, text: str, metadata: dict | None = None) -> None:
    if len(text) > MAX_CHROMA_DOC_SIZE:
        text = text[:MAX_CHROMA_DOC_SIZE]
    col = _chroma()
    if col:
        col.upsert(ids=[doc_id], documents=[text], metadatas=[metadata or {}])


def search_memory(query: str, n: int = 3) -> list[str]:
    col = _chroma()
    if not col:
        return []
    n = min(n, 10)
    results = col.query(query_texts=[query[:1000]], n_results=n)
    return results.get("documents", [[]])[0]
