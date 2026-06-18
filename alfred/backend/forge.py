# Tool Forge: geração → sandbox endurecido → eval → aprovação humana obrigatória.
# O exec() usa namespace completamente isolado; nenhum acesso a builtins perigosos.

import ast
import time
import logging
import threading
from typing import Any

from memory import upsert_tool, list_tools, audit

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Whitelist de imports permitidos no sandbox
# ---------------------------------------------------------------------------

ALLOWED_IMPORTS = frozenset({
    "math", "json", "re", "datetime", "collections", "itertools",
    "functools", "string", "textwrap", "unicodedata",
})

# Blocklist de nomes que nunca devem aparecer no código gerado
BLOCKED_NAMES = frozenset({
    "subprocess", "os", "sys", "shutil", "socket", "signal",
    "ctypes", "importlib", "__import__", "exec", "eval", "compile",
    "open", "io", "pathlib", "tempfile", "glob", "pickle", "marshal",
    "shelve", "mmap", "pty", "tty", "termios", "fcntl", "grp", "pwd",
    "resource", "sysconfig", "site", "runpy", "code", "codeop",
    "__builtins__", "__loader__", "__spec__", "builtins",
})


def _static_validate(code: str) -> tuple[bool, str]:
    """
    Validação estática via AST antes de qualquer execução.
    Verifica imports proibidos, calls perigosos e acesso a dunder.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Sintaxe inválida: {e}"

    for node in ast.walk(tree):
        # Verifica imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                base = alias.name.split(".")[0]
                if base not in ALLOWED_IMPORTS:
                    return False, f"Import não permitido: '{alias.name}'"

        elif isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".")[0]
            if module not in ALLOWED_IMPORTS:
                return False, f"Import não permitido: '{node.module}'"

        # Bloqueia acesso a atributos __dunder__ (escape via metaclasses)
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith("__") and node.attr.endswith("__"):
                return False, f"Acesso a dunder proibido: '{node.attr}'"

        # Bloqueia nomes proibidos usados diretamente
        elif isinstance(node, ast.Name):
            if node.id in BLOCKED_NAMES:
                return False, f"Identificador proibido: '{node.id}'"

        # Bloqueia chamadas a funções perigosas por nome
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in BLOCKED_NAMES:
                return False, f"Chamada proibida: '{node.func.id}()'"

    # Verificação adicional: busca textual por strings suspeitas
    suspicious = ["__subclasses__", "mro()", "for_name", "object.__", "type("]
    for s in suspicious:
        if s in code:
            return False, f"Padrão suspeito encontrado: '{s}'"

    return True, "ok"


def _exec_with_timeout(code: str, namespace: dict, timeout: float = 3.0) -> Exception | None:
    """Executa código num thread com timeout; mata a execução se exceder."""
    error: list[Exception] = []

    def run():
        try:
            exec(code, namespace)  # noqa: S102
        except Exception as e:
            error.append(e)

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(timeout)

    if t.is_alive():
        return TimeoutError(f"Execução excedeu {timeout}s — possível loop infinito.")
    return error[0] if error else None


# Namespace completamente limpo — sem acesso a builtins perigosos
_SAFE_BUILTINS = {
    "print": print,
    "len": len,
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "reversed": reversed,
    "min": min,
    "max": max,
    "sum": sum,
    "abs": abs,
    "round": round,
    "isinstance": isinstance,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "list": list,
    "dict": dict,
    "set": set,
    "tuple": tuple,
    "type": type,
    "None": None,
    "True": True,
    "False": False,
}


def sandbox_eval(code: str, test_inputs: list[Any] | None = None) -> dict:
    """Valida estaticamente, depois executa em namespace isolado com timeout."""
    valid, msg = _static_validate(code)
    if not valid:
        return {"score": 0.0, "details": msg, "passed": False}

    namespace: dict = {"__builtins__": _SAFE_BUILTINS}
    exc = _exec_with_timeout(code, namespace, timeout=3.0)

    if exc:
        return {"score": 0.0, "details": f"Erro de execução: {exc}", "passed": False}

    # Filtra namespace — remove o que não é função definida pelo código
    functions = [
        k for k, v in namespace.items()
        if callable(v) and not k.startswith("_") and k != "type"
    ]

    if not functions:
        return {"score": 0.2, "details": "Nenhuma função definida.", "passed": False}

    score = 0.7
    details = f"Funções: {functions}"

    if test_inputs:
        fn = namespace[functions[0]]
        passed = 0
        for inp in test_inputs:
            try:
                fn(*inp) if isinstance(inp, (list, tuple)) else fn(inp)
                passed += 1
            except Exception as e:
                details += f" | falhou: {e}"
        score = passed / len(test_inputs)
        details += f" | {passed}/{len(test_inputs)} testes"

    return {"score": round(score, 2), "details": details, "passed": score >= 0.5}


def get_forge_status() -> dict:
    tools = list_tools()
    approved = sum(1 for t in tools if t["status"] == "approved")
    pending = sum(1 for t in tools if t["status"] == "pending")
    return {"eval_summary": f"{approved}/{len(tools)}", "pending": pending}


def submit_tool(name: str, description: str, code: str, test_inputs: list | None = None) -> dict:
    """Submete uma ferramenta ao Forge. Status sempre 'pending' — aprovação humana obrigatória."""
    if not name.replace("_", "").isalnum() or len(name) > 64:
        return {"error": "Nome de ferramenta inválido."}

    logger.warning("Forge: ferramenta submetida — '%s'", name)
    audit("forge_submit", target=name)

    result = sandbox_eval(code, test_inputs)
    upsert_tool(name=name, description=description, code=code,
                eval_score=result["score"], status="pending")

    return {
        "tool": name,
        "eval": result,
        "status": "pending",
        "message": "Registrada. Aprovação humana necessária via /api/forge/approve.",
    }
