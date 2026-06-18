# Roteamento LLM: Groq como provedor principal, Ollama local como fallback automático.
# Retries e timeout centralizados aqui — nenhuma outra camada precisa saber disso.

import os
import time
import asyncio
import logging
from typing import AsyncGenerator

import litellm
from litellm import acompletion

logger = logging.getLogger(__name__)

# Modelos
GROQ_MODEL = os.getenv("GROQ_MODEL", "groq/llama-3.3-70b-versatile")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ollama/qwen2.5-coder:3b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

TIMEOUT_GROQ = float(os.getenv("GROQ_TIMEOUT", "30"))
TIMEOUT_OLLAMA = float(os.getenv("OLLAMA_TIMEOUT", "60"))
MAX_RETRIES_GROQ = 2

# Silencia logs desnecessários do litellm em produção
litellm.drop_params = True
litellm.set_verbose = False

# Estado compartilhado — indica qual provedor está respondendo agora
_active_brain: str = "groq"
_last_latency_ms: float = 0.0


def get_active_brain() -> str:
    return _active_brain


def get_last_latency() -> float:
    return _last_latency_ms


async def stream_completion(messages: list[dict]) -> AsyncGenerator[str, None]:
    """
    Tenta Groq; em falha (timeout, quota, erro de rede), cai para Ollama.
    Faz yield de tokens conforme chegam — nunca acumula a resposta inteira.
    """
    global _active_brain, _last_latency_ms

    providers = [
        (GROQ_MODEL, "groq", TIMEOUT_GROQ, MAX_RETRIES_GROQ),
        (OLLAMA_MODEL, "ollama", TIMEOUT_OLLAMA, 1),
    ]

    last_error: Exception | None = None

    for model, name, timeout, retries in providers:
        t_start = time.monotonic()
        try:
            kwargs: dict = dict(
                model=model,
                messages=messages,
                stream=True,
                timeout=timeout,
                num_retries=retries,
            )
            if name == "ollama":
                kwargs["api_base"] = OLLAMA_BASE_URL

            response = await acompletion(**kwargs)
            _active_brain = name

            async for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta

            _last_latency_ms = (time.monotonic() - t_start) * 1000
            return

        except Exception as exc:
            elapsed = (time.monotonic() - t_start) * 1000
            logger.warning("Provedor '%s' falhou em %.0fms: %s", name, elapsed, exc)
            last_error = exc

    # Ambos os provedores falharam — propaga o último erro
    raise RuntimeError(f"Todos os provedores LLM falharam. Último erro: {last_error}")


async def probe_brain() -> str:
    """Sondagem rápida para saber qual provedor responde agora."""
    probe = [{"role": "user", "content": "ok"}]
    try:
        await acompletion(
            model=GROQ_MODEL,
            messages=probe,
            max_tokens=1,
            timeout=5,
            num_retries=0,
        )
        return "groq"
    except Exception:
        pass

    try:
        await acompletion(
            model=OLLAMA_MODEL,
            messages=probe,
            max_tokens=1,
            timeout=10,
            num_retries=0,
            api_base=OLLAMA_BASE_URL,
        )
        return "ollama"
    except Exception:
        return "offline"
