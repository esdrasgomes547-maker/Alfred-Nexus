# Ferramentas nativas do Alfred — operações de arquivo, leitura de sistema, busca.
# Sem execução de shell arbitrário — cada operação é explícita e auditável.

import os
import json
import time
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Diretório de trabalho permitido — operações de arquivo ficam confinadas aqui
WORKSPACE = Path(os.getenv("ALFRED_WORKSPACE", "/workspace"))


def _safe_path(relative: str) -> Path:
    """Garante que o caminho está dentro do workspace."""
    target = (WORKSPACE / relative).resolve()
    if not str(target).startswith(str(WORKSPACE.resolve())):
        raise PermissionError(f"Acesso negado: '{relative}' está fora do workspace.")
    return target


def read_file(path: str) -> str:
    """Lê um arquivo do workspace."""
    target = _safe_path(path)
    if not target.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")
    return target.read_text(encoding="utf-8")


def write_file(path: str, content: str) -> dict:
    """Escreve conteúdo em um arquivo do workspace."""
    target = _safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    logger.info("Arquivo escrito: %s (%d bytes)", target, len(content))
    return {"path": str(path), "bytes": len(content)}


def list_workspace(subdir: str = ".") -> list[str]:
    """Lista arquivos e diretórios no workspace."""
    target = _safe_path(subdir)
    if not target.is_dir():
        raise NotADirectoryError(f"Não é um diretório: {subdir}")
    return sorted(str(p.relative_to(WORKSPACE)) for p in target.iterdir())


def system_info() -> dict:
    """Informações básicas do sistema (memória, disco, uptime)."""
    import shutil
    import platform

    disk = shutil.disk_usage("/")
    mem_info = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if parts[0] in ("MemTotal:", "MemAvailable:"):
                    mem_info[parts[0].rstrip(":")] = int(parts[1])  # kB
    except Exception:
        pass

    return {
        "platform": platform.system(),
        "python": platform.python_version(),
        "disk_free_gb": round(disk.free / 1e9, 1),
        "disk_total_gb": round(disk.total / 1e9, 1),
        "mem_total_mb": round(mem_info.get("MemTotal", 0) / 1024, 0),
        "mem_free_mb": round(mem_info.get("MemAvailable", 0) / 1024, 0),
    }


# Catálogo de ferramentas nativas — usado pelo endpoint /api/tools
NATIVE_TOOLS = [
    {
        "name": "read_file",
        "description": "Lê o conteúdo de um arquivo no workspace",
        "status": "approved",
        "category": "filesystem",
    },
    {
        "name": "write_file",
        "description": "Escreve conteúdo em um arquivo no workspace",
        "status": "approved",
        "category": "filesystem",
    },
    {
        "name": "list_workspace",
        "description": "Lista arquivos e pastas no workspace",
        "status": "approved",
        "category": "filesystem",
    },
    {
        "name": "system_info",
        "description": "Retorna informações de hardware e sistema",
        "status": "approved",
        "category": "system",
    },
]
