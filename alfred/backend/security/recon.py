# Módulo de segurança/recon — wrappers auditados com escopo travado.
# Nenhuma operação roda contra alvos fora do scope.yaml.
# Tudo registrado no audit log do SQLite.

import os
import ipaddress
import socket
import subprocess
import logging
from pathlib import Path

import yaml

from memory import audit

logger = logging.getLogger(__name__)

SCOPE_FILE = Path(__file__).parent / "scope.yaml"


# ---------------------------------------------------------------------------
# Carregamento e verificação de escopo
# ---------------------------------------------------------------------------

def _load_scope() -> dict:
    with open(SCOPE_FILE) as f:
        return yaml.safe_load(f)


def _resolve_target(address: str) -> str:
    """Resolve hostname para IP se necessário."""
    try:
        return socket.gethostbyname(address)
    except socket.gaierror:
        return address


def _find_target_in_scope(address: str, scope: dict) -> dict | None:
    """Retorna a entrada de escopo se o alvo for autorizado, None caso contrário."""
    resolved = _resolve_target(address)

    for entry in scope.get("authorized_targets", []):
        # Comparação direta por endereço
        if entry.get("address") == resolved or entry.get("address") == address:
            return entry
        # Comparação por CIDR
        if "cidr" in entry:
            try:
                if ipaddress.ip_address(resolved) in ipaddress.ip_network(entry["cidr"], strict=False):
                    return entry
            except ValueError:
                pass

    return None


def _check_operation_allowed(target_entry: dict, operation: str, scope: dict) -> bool:
    """Verifica se a operação é permitida para o tipo de alvo."""
    target_type = target_entry.get("type", "unknown")
    allowed = scope.get("allowed_operations", {}).get(target_type, [])
    return operation in allowed


def authorize(target: str, operation: str) -> tuple[bool, str]:
    """
    Ponto central de autorização.
    Retorna (autorizado: bool, motivo: str).
    """
    scope = _load_scope()

    if not scope.get("locked", True):
        return False, "Escopo desbloqueado — operações de segurança suspensas por segurança."

    entry = _find_target_in_scope(target, scope)
    if not entry:
        audit("recon_denied", target=target, result=f"Fora do escopo: {operation}")
        return False, f"Alvo '{target}' não está no escopo autorizado. Adicione-o ao scope.yaml com consciência."

    if not _check_operation_allowed(entry, operation, scope):
        audit("recon_denied", target=target, result=f"Operação não permitida: {operation}")
        return False, f"Operação '{operation}' não é permitida para alvos do tipo '{entry.get('type')}'."

    return True, "ok"


# ---------------------------------------------------------------------------
# Operações de recon autorizadas
# ---------------------------------------------------------------------------

def ping(target: str) -> dict:
    """Verifica conectividade com ICMP."""
    allowed, reason = authorize(target, "ping")
    if not allowed:
        return {"error": reason}

    audit("recon_ping", target=target)
    result = subprocess.run(
        ["ping", "-c", "3", "-W", "2", target],
        capture_output=True, text=True, timeout=15,
    )
    audit("recon_ping_result", target=target, result=f"exit={result.returncode}")
    return {
        "target": target,
        "reachable": result.returncode == 0,
        "output": result.stdout[:500],
    }


def port_scan(target: str, ports: str = "22,80,443,8080,8443") -> dict:
    """
    Varredura de portas via socket — sem nmap para manter leveza.
    `ports`: string separada por vírgulas, ex: "22,80,443".
    """
    allowed, reason = authorize(target, "port_scan")
    if not allowed:
        return {"error": reason}

    port_list = [int(p.strip()) for p in ports.split(",") if p.strip().isdigit()]
    if len(port_list) > 50:
        return {"error": "Máximo de 50 portas por varredura."}

    audit("recon_port_scan", target=target, result=f"ports={ports}")
    open_ports = []

    for port in port_list:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1.5)
                if s.connect_ex((_resolve_target(target), port)) == 0:
                    open_ports.append(port)
        except Exception:
            pass

    audit("recon_port_scan_result", target=target, result=f"open={open_ports}")
    return {"target": target, "scanned": port_list, "open": open_ports}


def banner_grab(target: str, port: int) -> dict:
    """Captura o banner de serviço de uma porta aberta."""
    allowed, reason = authorize(target, "banner_grab")
    if not allowed:
        return {"error": reason}

    audit("recon_banner", target=target, result=f"port={port}")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3)
            s.connect((_resolve_target(target), port))
            s.sendall(b"HEAD / HTTP/1.0\r\n\r\n")
            banner = s.recv(512).decode("utf-8", errors="replace")
        return {"target": target, "port": port, "banner": banner[:300]}
    except Exception as exc:
        return {"target": target, "port": port, "error": str(exc)}
