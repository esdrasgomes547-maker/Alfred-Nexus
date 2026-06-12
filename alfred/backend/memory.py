# Camada de memória: SQLite para histórico e logs; ChromaDB embedded para RAG.
# Nenhum servidor externo — tudo roda no processo.

import os
import json
import sqlite3
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_PATH = Path(os.getenv("SQLITE_PATH", "/data/alfred.db"))
CHROMA_PATH = Path(os.getenv("CHROMA_PATH", "/data/chroma"))

# ---------------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
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
    """Cria tabelas se não existirem. Chamado na inicialização do app."""
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
                status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
                eval_score  REAL,
                created_at  REAL NOT NULL
            );

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
    logger.info("SQLite inicializado em %s", DB_PATH)


def save_turn(session: str, role: str, content: str, model: str | None = None) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO conversations (session, role, content, model, ts) VALUES (?,?,?,?,?)",
            (session, role, content, model, time.time()),
        )


def load_history(session: str, limit: int = 40) -> list[dict]:
    """Carrega as últimas `limit` mensagens de uma sessão."""
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
               ON CONFLICT(date) DO UPDATE SET calls=calls+1, total_ms=total_ms+excluded.total_ms""",
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
    with db() as conn:
        conn.execute(
            "INSERT INTO audit_log (action, target, result, ts) VALUES (?,?,?,?)",
            (action, target, result, time.time()),
        )


# ---------------------------------------------------------------------------
# Catálogo de ferramentas
# ---------------------------------------------------------------------------

def list_tools(status: str | None = None) -> list[dict]:
    with db() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM tool_catalog WHERE status=? ORDER BY created_at DESC", (status,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM tool_catalog ORDER BY created_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


def get_tool(name: str) -> dict | None:
    with db() as conn:
        row = conn.execute("SELECT * FROM tool_catalog WHERE name=?", (name,)).fetchone()
    return dict(row) if row else None


def upsert_tool(name: str, description: str, code: str, eval_score: float | None = None, status: str = "pending") -> None:
    with db() as conn:
        conn.execute(
            """INSERT INTO tool_catalog (name, description, code, status, eval_score, created_at)
               VALUES (?,?,?,?,?,?)
               ON CONFLICT(name) DO UPDATE SET description=excluded.description,
               code=excluded.code, status=excluded.status, eval_score=excluded.eval_score""",
            (name, description, code, status, eval_score, time.time()),
        )


def set_tool_status(name: str, status: str) -> bool:
    with db() as conn:
        cur = conn.execute(
            "UPDATE tool_catalog SET status=? WHERE name=?", (status, name)
        )
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# ChromaDB embedded (RAG) — inicialização lazy para não bloquear o boot
# ---------------------------------------------------------------------------

_chroma_client = None
_chroma_collection = None


def _chroma():
    global _chroma_client, _chroma_collection
    if _chroma_collection is None:
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            CHROMA_PATH.mkdir(parents=True, exist_ok=True)
            _chroma_client = chromadb.PersistentClient(path=str(CHROMA_PATH))
            ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            _chroma_collection = _chroma_client.get_or_create_collection(
                name="alfred_memory", embedding_function=ef
            )
        except Exception as exc:
            logger.warning("ChromaDB indisponível — RAG desativado: %s", exc)
    return _chroma_collection


def add_to_memory(doc_id: str, text: str, metadata: dict | None = None) -> None:
    col = _chroma()
    if col:
        col.upsert(ids=[doc_id], documents=[text], metadatas=[metadata or {}])


def search_memory(query: str, n: int = 3) -> list[str]:
    col = _chroma()
    if not col:
        return []
    results = col.query(query_texts=[query], n_results=n)
    return results.get("documents", [[]])[0]
