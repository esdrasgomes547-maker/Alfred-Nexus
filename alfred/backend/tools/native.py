# Ferramentas nativas — operações de arquivo e sistema com validação rigorosa.
# Sem symlinks, sem extensões perigosas, sem acesso fora do workspace.

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

WORKSPACE = Path(os.getenv("ALFRED_WORKSPACE", "/workspace")).resolve()

# Extensões de arquivo permitidas para leitura/escrita
ALLOWED_READ_EXTENSIONS = {".txt", ".md", ".json", ".yaml", ".yml",
                           ".py", ".js", ".ts", ".html", ".css", ".sh",
                           ".toml", ".ini", ".cfg", ".csv", ".log"}

ALLOWED_WRITE_EXTENSIONS = {".txt", ".md", ".json", ".yaml", ".yml",
                             ".py", ".js", ".ts", ".html", ".css", ".sh",
                             ".toml", ".ini", ".csv"}

MAX_FILE_SIZE = 5 * 1024 * 1024   # 5 MB para leitura
MAX_WRITE_SIZE = 1 * 1024 * 1024  # 1 MB para escrita


def _safe_path(relative: str, must_exist: bool = False) -> Path:
    """
    Valida e resolve o caminho dentro do workspace.
    Bloqueia: path traversal, symlinks, paths absolutos.
    """
    if not relative or len(relative) > 512:
        raise ValueError("Path inválido.")

    # Rejeita paths absolutos e sequências de traversal
    if os.path.isabs(relative) or ".." in Path(relative).parts:
        raise PermissionError("Path traversal detectado.")

    target = (WORKSPACE / relative).resolve()

    # Garante que está dentro do workspace (mesmo após resolve)
    try:
        target.relative_to(WORKSPACE)
    except ValueError:
        raise PermissionError(f"Acesso negado: fora do workspace.")

    # Bloqueia symlinks (podem apontar para fora do workspace)
    if target.is_symlink():
        raise PermissionError("Symlinks não permitidos.")

    if must_exist and not target.exists():
        raise FileNotFoundError(f"Não encontrado: {relative}")

    return target


def read_file(path: str) -> str:
    # Valida extensão antes de verificar existência — evita enumeração de arquivos
    ext = Path(path).suffix
    if ext not in ALLOWED_READ_EXTENSIONS:
        raise PermissionError(f"Tipo de arquivo não permitido para leitura: '{ext}'")

    target = _safe_path(path, must_exist=True)

    if target.suffix not in ALLOWED_READ_EXTENSIONS:
        raise PermissionError(f"Tipo de arquivo não permitido para leitura: '{target.suffix}'")

    if not target.is_file():
        raise IsADirectoryError(f"'{path}' é um diretório.")

    size = target.stat().st_size
    if size > MAX_FILE_SIZE:
        raise ValueError(f"Arquivo muito grande ({size} bytes). Máximo: {MAX_FILE_SIZE}.")

    return target.read_text(encoding="utf-8", errors="replace")


def write_file(path: str, content: str) -> dict:
    target = _safe_path(path)

    if target.suffix not in ALLOWED_WRITE_EXTENSIONS:
        raise PermissionError(f"Tipo de arquivo não permitido para escrita: '{target.suffix}'")

    if len(content.encode("utf-8")) > MAX_WRITE_SIZE:
        raise ValueError(f"Conteúdo muito grande. Máximo: {MAX_WRITE_SIZE} bytes.")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return {"path": str(path), "bytes": len(content.encode())}


def list_workspace(subdir: str = ".") -> list[str]:
    target = _safe_path(subdir)
    if not target.is_dir():
        raise NotADirectoryError(f"'{subdir}' não é um diretório.")

    entries = []
    for p in sorted(target.iterdir()):
        if p.is_symlink():
            continue  # ignora symlinks na listagem
        try:
            rel = str(p.relative_to(WORKSPACE))
            entries.append(rel)
        except ValueError:
            pass
    return entries[:500]  # limita listagem


def system_info() -> dict:
    import shutil, platform
    disk = shutil.disk_usage("/")
    mem_info: dict[str, int] = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2 and parts[0] in ("MemTotal:", "MemAvailable:"):
                    mem_info[parts[0].rstrip(":")] = int(parts[1])
    except OSError:
        pass
    return {
        "platform": platform.system(),
        "disk_free_gb": round(disk.free / 1e9, 1),
        "disk_total_gb": round(disk.total / 1e9, 1),
        "mem_total_mb": round(mem_info.get("MemTotal", 0) / 1024),
        "mem_free_mb": round(mem_info.get("MemAvailable", 0) / 1024),
    }


NATIVE_TOOLS = [
    {"name": "read_file",      "description": "Lê arquivo no workspace",      "status": "approved", "category": "filesystem"},
    {"name": "write_file",     "description": "Escreve arquivo no workspace",  "status": "approved", "category": "filesystem"},
    {"name": "list_workspace", "description": "Lista arquivos no workspace",   "status": "approved", "category": "filesystem"},
    {"name": "system_info",    "description": "Info de hardware e sistema",    "status": "approved", "category": "system"},
]
