# Tool Forge: geração de ferramentas pelo agente → sandbox → eval → aprovação humana.
# Nada entra em produção sem aprovação explícita do senhor.

import os
import sys
import ast
import time
import uuid
import logging
import traceback
from typing import Any

from memory import upsert_tool, list_tools, audit

logger = logging.getLogger(__name__)


def get_forge_status() -> dict:
    """Resumo do estado do Forge para o endpoint /api/status."""
    tools = list_tools()
    approved = sum(1 for t in tools if t["status"] == "approved")
    pending = sum(1 for t in tools if t["status"] == "pending")
    total = len(tools)
    return {"eval_summary": f"{approved}/{total}", "pending": pending}


def validate_tool_code(code: str) -> tuple[bool, str]:
    """
    Validação estática: verifica se o código é Python válido e não contém
    imports perigosos. Não executa nada ainda.
    """
    BLOCKED = {
        "subprocess", "os.system", "eval", "exec", "__import__",
        "open", "socket", "urllib", "requests", "shutil.rmtree",
    }

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Erro de sintaxe: {e}"

    for node in ast.walk(tree):
        # Verifica imports bloqueados
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [alias.name for alias in node.names]
            for name in names:
                if any(b in name for b in BLOCKED):
                    return False, f"Import bloqueado: {name}"

    return True, "ok"


def sandbox_eval(code: str, test_inputs: list[Any] | None = None) -> dict:
    """
    Executa a ferramenta gerada em um namespace isolado.
    Retorna score (0–1) e detalhes do teste.
    """
    valid, msg = validate_tool_code(code)
    if not valid:
        return {"score": 0.0, "details": msg, "passed": False}

    namespace: dict = {}
    try:
        # Executa o código num namespace limpo e sem acesso a globals perigosos
        safe_globals = {"__builtins__": {"print": print, "len": len, "range": range,
                                          "str": str, "int": int, "float": float,
                                          "list": list, "dict": dict, "bool": bool}}
        exec(compile(code, "<forge>", "exec"), safe_globals, namespace)
    except Exception as exc:
        return {"score": 0.0, "details": f"Erro de execução: {exc}", "passed": False}

    # Verifica se existe pelo menos uma função definida
    functions = [k for k, v in namespace.items() if callable(v) and not k.startswith("_")]
    if not functions:
        return {"score": 0.2, "details": "Nenhuma função definida no código.", "passed": False}

    # Tenta chamar a função principal com inputs de teste
    score = 0.7  # base: compilou e tem função
    details = f"Funções encontradas: {functions}"

    if test_inputs:
        fn = namespace[functions[0]]
        passed_tests = 0
        for inp in test_inputs:
            try:
                result = fn(*inp) if isinstance(inp, (list, tuple)) else fn(inp)
                passed_tests += 1
            except Exception as exc:
                details += f" | Teste falhou: {exc}"
        score = passed_tests / len(test_inputs)
        details += f" | {passed_tests}/{len(test_inputs)} testes passaram"

    return {"score": round(score, 2), "details": details, "passed": score >= 0.5}


def submit_tool(name: str, description: str, code: str, test_inputs: list | None = None) -> dict:
    """
    Ponto de entrada do Forge: valida, faz eval em sandbox, registra no catálogo
    com status 'pending'. Aguarda aprovação humana via /api/forge/approve.
    """
    logger.info("Forge: nova ferramenta submetida — '%s'", name)
    audit("forge_submit", target=name)

    result = sandbox_eval(code, test_inputs)

    upsert_tool(
        name=name,
        description=description,
        code=code,
        eval_score=result["score"],
        status="pending",  # sempre pending — aprovação humana obrigatória
    )

    logger.info(
        "Forge: '%s' no catálogo (score=%.2f, passed=%s). Aguardando aprovação.",
        name, result["score"], result["passed"],
    )

    return {
        "tool": name,
        "eval": result,
        "status": "pending",
        "message": "Ferramenta registrada. Aprovação humana necessária via /api/forge/approve.",
    }
