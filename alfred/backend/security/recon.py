# Módulo de recon — operações auditadas com escopo travado e validação rigorosa.
# DNS rebinding mitigado: re-valida o IP imediatamente antes de cada operação.
# Nenhuma operação roda contra alvos fora do scope.yaml.

import re
import ipaddress
import socket
import subprocess
import hashlib
import logging
from pathlib import Path
from typing import Callable

import yaml

from memory import audit

logger = logging.getLogger(__name__)

SCOPE_FILE = Path(__file__).parent / "scope.yaml"

# Hash do scope.yaml em produção — detecta modificações não autorizadas
# Execute: python3 -c "import hashlib; print(hashlib.sha256(open('scope.yaml','rb').read()).hexdigest())"
# e coloque o resultado em SCOPE_HASH no .env
EXPECTED_SCOPE_HASH = None  # Sobrescrever via env em produção

# Padrão válido para hostnames e IPs
_HOSTNAME_RE = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$')


# ---------------------------------------------------------------------------
# Validação de formato de alvo
# ---------------------------------------------------------------------------

def _validate_target_format(target: str) -> str:
    """
    Aceita apenas IPs válidos ou hostnames bem formados.
    Rejeita qualquer coisa com caracteres especiais de shell.
    """
    if not target or len(target) > 253:
        raise ValueError("Alvo inválido: tamanho fora do limite.")

    # Tenta parsear como IP
    try:
        parsed = ipaddress.ip_address(target)
        # Bloqueia endereços especiais que não devem ser varridos
        if parsed.is_loopback or parsed.is_link_local or parsed.is_multicast:
            raise ValueError(f"Endereço reservado não permitido: {target}")
        return str(parsed)
    except ValueError as e:
        if "não permitido" in str(e):
            raise

    # Valida como hostname
    if not _HOSTNAME_RE.match(target):
        raise ValueError(f"Formato de alvo inválido: '{target}'")

    return target


def _resolve_to_ip(hostname: str) -> str:
    """Resolve hostname para IP. Lança exceção se não resolver."""
    try:
        ip = socket.getaddrinfo(hostname, None, socket.AF_INET)[0][4][0]
        return ip
    except (socket.gaierror, IndexError) as e:
        raise ValueError(f"Não foi possível resolver '{hostname}': {e}")


# ---------------------------------------------------------------------------
# Carregamento e verificação de escopo
# ---------------------------------------------------------------------------

def _load_scope() -> dict:
    """Carrega scope.yaml e verifica integridade se EXPECTED_SCOPE_HASH configurado."""
    scope_bytes = SCOPE_FILE.read_bytes()

    if EXPECTED_SCOPE_HASH:
        actual = hashlib.sha256(scope_bytes).hexdigest()
        if actual != EXPECTED_SCOPE_HASH:
            raise RuntimeError("scope.yaml foi modificado! Hash inválido — operações bloqueadas.")

    return yaml.safe_load(scope_bytes)


def _find_in_scope(ip: str, scope: dict) -> dict | None:
    """Verifica se o IP (já resolvido) está nos alvos autorizados."""
    try:
        parsed_ip = ipaddress.ip_address(ip)
    except ValueError:
        return None

    for entry in scope.get("authorized_targets", []):
        if "address" in entry:
            try:
                if ipaddress.ip_address(entry["address"]) == parsed_ip:
                    return entry
            except ValueError:
                pass

        if "cidr" in entry:
            try:
                if parsed_ip in ipaddress.ip_network(entry["cidr"], strict=False):
                    return entry
            except ValueError:
                pass

    return None


def _check_operation_allowed(entry: dict, operation: str, scope: dict) -> bool:
    t_type = entry.get("type", "unknown")
    return operation in scope.get("allowed_operations", {}).get(t_type, [])


# ---------------------------------------------------------------------------
# Autorização com proteção contra DNS rebinding
# ---------------------------------------------------------------------------

def authorize_and_resolve(target: str, operation: str) -> tuple[bool, str, str]:
    """
    Valida formato, resolve DNS, verifica escopo.
    Retorna (ok, motivo, ip_resolvido).
    Resolução e verificação acontecem juntas — sem janela TOCTOU.
    """
    try:
        target = _validate_target_format(target)
    except ValueError as e:
        audit("recon_denied", target=target, result=str(e))
        return False, str(e), ""

    try:
        ip = _resolve_to_ip(target)
    except ValueError as e:
        audit("recon_denied", target=target, result=str(e))
        return False, str(e), ""

    scope = _load_scope()
    if not scope.get("locked", True):
        return False, "Escopo desbloqueado — operações suspensas.", ip

    entry = _find_in_scope(ip, scope)
    if not entry:
        audit("recon_denied", target=target, result=f"fora do escopo ({ip}): {operation}")
        return False, f"Alvo '{target}' ({ip}) não está no escopo autorizado.", ip

    if not _check_operation_allowed(entry, operation, scope):
        audit("recon_denied", target=target, result=f"operação proibida: {operation}")
        return False, f"Operação '{operation}' não permitida para alvos do tipo '{entry.get('type')}'.", ip

    return True, "ok", ip


# ---------------------------------------------------------------------------
# Operações de recon — usam o IP já resolvido e validado
# ---------------------------------------------------------------------------

def ping(target: str) -> dict:
    ok, reason, ip = authorize_and_resolve(target, "ping")
    if not ok:
        return {"error": reason}

    audit("recon_ping", target=target, result=f"ip={ip}")
    try:
        # Usa o IP resolvido — sem nova resolução DNS (evita rebinding)
        result = subprocess.run(
            ["ping", "-c", "3", "-W", "2", ip],
            capture_output=True, text=True, timeout=12,
        )
        audit("recon_ping_result", target=target, result=f"exit={result.returncode}")
        return {"target": target, "resolved_ip": ip,
                "reachable": result.returncode == 0, "output": result.stdout[:400]}
    except subprocess.TimeoutExpired:
        return {"target": target, "error": "Timeout"}


def port_scan(target: str, ports: str = "22,80,443,8080,8443") -> dict:
    ok, reason, ip = authorize_and_resolve(target, "port_scan")
    if not ok:
        return {"error": reason}

    # Valida portas: apenas inteiros no range 1-65535, máximo 50
    try:
        port_list = [int(p.strip()) for p in ports.split(",") if p.strip()]
        if not all(1 <= p <= 65535 for p in port_list):
            return {"error": "Porta fora do range 1-65535."}
        if len(port_list) > 50:
            return {"error": "Máximo de 50 portas por varredura."}
    except ValueError:
        return {"error": "Lista de portas inválida."}

    audit("recon_port_scan", target=target, result=f"ip={ip} ports={ports[:100]}")
    open_ports: list[int] = []

    for port in port_list:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1.0)
                if s.connect_ex((ip, port)) == 0:
                    open_ports.append(port)
        except OSError:
            pass

    audit("recon_port_scan_result", target=target, result=f"open={open_ports}")
    return {"target": target, "resolved_ip": ip,
            "scanned": port_list, "open": open_ports}


def banner_grab(target: str, port: int) -> dict:
    ok, reason, ip = authorize_and_resolve(target, "banner_grab")
    if not ok:
        return {"error": reason}

    if not (1 <= port <= 65535):
        return {"error": "Porta inválida."}

    audit("recon_banner", target=target, result=f"ip={ip} port={port}")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((ip, port))
            s.sendall(b"HEAD / HTTP/1.0\r\n\r\n")
            banner = s.recv(512).decode("utf-8", errors="replace")
        return {"target": target, "resolved_ip": ip, "port": port, "banner": banner[:300]}
    except (OSError, UnicodeDecodeError) as exc:
        return {"target": target, "port": port, "error": str(exc)[:100]}
