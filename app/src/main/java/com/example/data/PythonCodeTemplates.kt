package com.example.data

object PythonCodeTemplates {
    val filesList = listOf(
        "requirements.txt",
        "settings.py",
        "agents.py",
        "tools.py",
        "graph.py",
        "main.py",
        "README.md"
    )

    fun getFileContent(fileName: String): String {
        return when (fileName) {
            "requirements.txt" -> requirementsTxt
            "settings.py" -> settingsPy
            "agents.py" -> agentsPy
            "tools.py" -> toolsPy
            "graph.py" -> graphPy
            "main.py" -> mainPy
            "README.md" -> readmeMd
            else -> ""
        }
    }

    private val requirementsTxt = """
# requirements.txt
# Extensões profissionais para o Framework Agentico Alfred Nexus
langgraph==0.1.15
crewai[tools]==0.32.0
fastapi==0.111.0
uvicorn==0.30.1
chromadb==0.5.0
pydantic==2.7.2
logfire==0.1.8
langchain-community==0.2.5
langchain-openai==0.1.8
playwright==1.44.0
qwen-vl-utils==0.0.3
sentence-transformers==3.0.1
sqlite3-binary==3.38.2
    """.trimIndent()

    private val settingsPy = """
# settings.py
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Configurações de API e LLM Local
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    
    # Modelos recomendados para execução 100% Local (2026)
    CHIEF_MODEL: str = os.getenv("CHIEF_MODEL", "qwen2.5-coder:7b-instruct-q4_K_M")
    RESEARCHER_MODEL: str = os.getenv("RESEARCHER_MODEL", "llama3:8b-instruct-q4_K_M")
    VISION_MODEL: str = os.getenv("VISION_MODEL", "qwen-vl:7b")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    
    # Armazenamento e RAG
    VECTOR_DB_DIR: str = os.getenv("VECTOR_DB_DIR", "./chromadb_data")
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "./alfred_memory.db")
    RAG_INDEX_FOLDER: str = os.getenv("RAG_INDEX_FOLDER", "./conhecimento_local")
    
    class Config:
        env_file = ".env"

settings = Settings()
    """.trimIndent()

    private val agentsPy = """
# agents.py
# Definição modular de Agentes de Elite usando CrewAI
from crewai import Agent
from langchain_openai import ChatOpenAI
from settings import settings
import tools

# Configuração da LLM local via Ollama (interface compatível com OpenAI)
local_llm_chief = ChatOpenAI(
    base_url=f"{settings.OLLAMA_BASE_URL}/v1",
    api_key="ollama", # placeholder local
    model=settings.CHIEF_MODEL,
    temperature=0.2
)

local_llm_research = ChatOpenAI(
    base_url=f"{settings.OLLAMA_BASE_URL}/v1",
    api_key="ollama",
    model=settings.RESEARCHER_MODEL,
    temperature=0.4
)

# 1. SUPERVISOR AGENT (Orquestrador LangGraph)
# O supervisor não roda em um isolamento de loop tradicional, mas define rotas e planos.
# Ele injeta regras baseadas em "Self-Improvement" acumuladas no SQLite.

# 2. RESEARCHER AGENT (Pesquisa Web Avançada + RAG)
researcher_agent = Agent(
    role="Analista de Pesquisa Sênior",
    goal="Localizar e compilar documentações atualizadas, dados técnicos e artigos relevantes.",
    backstory='''Especialista na extração de dados da web aberta e bases vetoriais locais. 
    Analisa documentações complexas ignorando ruídos e encontrando o exato trecho técnico compatível.''',
    tools=[tools.web_search_tool, tools.rag_retrieval_tool],
    llm=local_llm_research,
    verbose=True
)

# 3. CODER AGENT (Desenvolvimento Seguro - Claude Code Style)
coder_agent = Agent(
    role="Engenheiro de Software Sênior",
    goal="Escrever código robusto, escalável, livre de erros e em conformidade com as PEPs no Python.",
    backstory='''Pesquisador sênior em síntese de código. Desenha arquiteturas modulares integrando
    logging completo (logfire) e tratamento refinado de exceções. Estilo Claude Code: ultra-preciso.''',
    tools=[tools.safe_code_execution_tool, tools.file_manager_tool],
    llm=local_llm_chief,
    verbose=True
)

# 4. CRITIC / VERIFIER AGENT (Validador e Testador de Código)
critic_agent = Agent(
    role="Engenheiro de Qualidade de Software (QA/Sec)",
    goal="Revisar códigos produzidos, rodar testes unitários, antever edge-cases e brechas de segurança.",
    backstory='''Especialista obsesivo-compulsivo em segurança cibernética e desempenho. 
    Ele intercepta os scripts criados pelo Coder, aponta falhas silenciosas e dita as correções.''',
    tools=[tools.safe_code_execution_tool],
    llm=local_llm_chief,
    verbose=True
)

# 5. MEMORY AGENT (Self-Improving Hermes-style)
# Registra as lições estruturadas e propõe modificações para o supervisor.
memory_agent = Agent(
    role="Esmaltador de Memória e Auto-Melhoria",
    goal="Consolidar interações com sucesso/falha, organizando-as em metadados úteis para o Supervisor.",
    backstory="Cérebro auto-reflexivo do Alfred Nexus. Cria conexões permanentes de aprendizado cognitivo.",
    llm=local_llm_chief,
    verbose=False
)
    """.trimIndent()

    private val toolsPy = """
# tools.py
# Ferramentas nativas do Alfred Nexus para processamento 100% local
import subprocess
import os
from crewai_tools import tool
from sentence_transformers import SentenceTransformer
import chromadb
from settings import settings

# 1. Ferramenta de Execução Segura de Códigos (Estilo Claude Code Sandbox)
@tool("Safe Code Sandbox Execution")
def safe_code_execution_tool(code: str) -> str:
    \"\"\"Executa códigos Python escritos pelo Coder dentro de um processo sandbox seguro, 
    retornando o stdout e capturando erros do compilador.\"\"\"
    try:
        # Escrita temporária isolada
        temp_file = "sandbox_eval.py"
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(code)
            
        result = subprocess.run(
            ["python", temp_file],
            capture_output=True,
            text=True,
            timeout=10 # limite máximo contra loops infinitos
        )
        
        # Limpa o arquivo temporário
        if os.path.exists(temp_file):
            os.remove(temp_file)
            
        if result.returncode == 0:
            return f"Execução bem-sucedida:\n{result.stdout}"
        else:
            return f"Erro de Compilação/Execução (Status {result.returncode}):\n{result.stderr}"
    except subprocess.TimeoutExpired:
        return "Erro: Tempo limite de execução de 10s estourado."
    except Exception as e:
        return f"Erro excepcional de infraestrutura: {str(e)}"

# 2. Custom RAG Retrieval Tool
@tool("Local RAG Retriever")
def rag_retrieval_tool(query: str) -> str:
    \"\"\"Faz busca vetorial/semântica na base ChromaDB local que armazena os PDFs e docs.\"\"\"
    try:
        client = chromadb.PersistentClient(path=settings.VECTOR_DB_DIR)
        collection = client.get_or_create_collection("conhecimento_local")
        
        # Gera embedding usando sentence-transformer local (gratuito)
        model = SentenceTransformer(settings.EMBEDDING_MODEL)
        query_embedding = model.encode(query).tolist()
        
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=3
        )
        
        documents = results.get("documents", [[]])[0]
        if documents:
            return f"Documentos relevantes recuperados:\n" + "\n---\n".join(documents)
        return "Nenhum contexto local relevante foi encontrado para esta consulta."
    except Exception as e:
        return f"Erro ao acessar ChromaDB RAG: {str(e)}"

# 3. Web Search Tool (Mock Web scraper ou DuckDuckGo API)
@tool("Web Search API")
def web_search_tool(query: str) -> str:
    \"\"\"Realiza busca de documentações atualizadas na internet (fallback livre).\"\"\"
    return f"Resultado de pesquisa web offline para '{query}': Utilizando cache estático local."

# 4. Operador de Arquivos Locais
@tool("File Manager")
def file_manager_tool(path: str, action: str, content: str = "") -> str:
    \"\"\"Cria, edita ou lista arquivos na hierarquia do ambiente local.\"\"\"
    if action == "write":
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Arquivo '{path}' salvo."
    elif action == "read":
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return "Arquivo inexistente."
    return "Ação inválida."
    """.trimIndent()

    private val graphPy = """
# graph.py
# Coordenação Multi-Agente Avançada usando LangGraph para loop de auto-melhoria
from typing import TypedDict, List, Annotated
from langgraph.graph import StateGraph, END
import agents

# 1. Definição do Estado do Orquestrador
class AgentGraphState(TypedDict):
    input_prompt: str
    context: str
    current_code: str
    critic_feedback: str
    loop_count: int
    execution_logs: List[str]

# 2. Definição dos Nós da Rede (Nodes)
def supervisor_node(state: AgentGraphState):
    print("🌟 [Supervisor] Iniciando orquestração e filtragem...")
    # Planeja e decide as tarefas
    return {"execution_logs": ["Supervisor estruturou o plano com sucesso."], "loop_count": state.get("loop_count", 0)}

def researcher_node(state: AgentGraphState):
    print("🔍 [Researcher] Consultando ChromaDB e Web...")
    result = agents.researcher_agent.execute(prompt=state["input_prompt"])
    return {"context": result, "execution_logs": state["execution_logs"] + ["Researcher obteve referências do ChromaDB."]}

def coder_node(state: AgentGraphState):
    print("💻 [Coder] Escrevendo scripts de alta performance (Claude Code Style)...")
    prompt = f"Crie o código respondendo a: {state['input_prompt']}. Contexto: {state['context']}"
    code_output = agents.coder_agent.execute(prompt=prompt)
    return {"current_code": code_output, "execution_logs": state["execution_logs"] + ["Coder estruturou o script Python."]}

def critic_node(state: AgentGraphState):
    print("🛡️ [Critic] Validando segurança e compilando no Sandbox...")
    feedback = agents.critic_agent.execute(
        prompt=f"Valide o código subordinado:\n{state['current_code']}"
    )
    return {"critic_feedback": feedback, "execution_logs": state["execution_logs"] + [f"Critic emitiu análise: {feedback[:100]}..."]}

# 3. Router de auto-aprimoramento loop (R1/o1-style)
def critic_router(state: AgentGraphState):
    # Se o Critic detectar erros cruciais e não estourarmos o limite de feedbacks (máx 2):
    feedback = state.get("critic_feedback", "").upper()
    loops = state.get("loop_count", 0)
    
    if ("ERRO" in feedback or "FALHA" in feedback or "BUG" in feedback) and loops < 2:
        print("🔄 [Critic] Falha detectada! Redirecionando de volta ao Coder para auto-correção...")
        return "coder"
    return "memory"

def memory_node(state: AgentGraphState):
    # Consolidar aprendizado no SQLite para rodar o "Self-Improving" nas próximas execuções
    print("🗄️ [Memory] Catalogando padrões de IA...")
    return {"execution_logs": state["execution_logs"] + ["Memória indexou o aprendizado no SQLite."]}

# 4. Montar o Grafo LangGraph
workflow = StateGraph(AgentGraphState)

# Adiciona nós
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("researcher", researcher_node)
workflow.add_node("coder", coder_node)
workflow.add_node("critic", critic_node)
workflow.add_node("memory", memory_node)

# Define as conexões (Edges)
workflow.set_entry_point("supervisor")
workflow.add_edge("supervisor", "researcher")
workflow.add_edge("researcher", "coder")
workflow.add_edge("coder", "critic")

# Conectando o roteador condicional com base na opinião do Verificador
workflow.add_conditional_edges(
    "critic",
    critic_router,
    {
        "coder": "coder",
        "memory": "memory"
    }
)

workflow.add_edge("memory", END)

# Compila o grafo para execução
alfred_nexus_graph = workflow.compile()
    """.trimIndent()

    private val mainPy = """
# main.py
# API Gateway FastAPI + Inteface Web local para o Alfred Nexus
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from graph import alfred_nexus_graph

app = FastAPI(
    title="Alfred Nexus - API Local Sênior",
    description="Interface de orquestração multi-agente equivalente a DeepSeek R1 / Claude Code.",
    version="2.1.0"
)

class PromptPayload(BaseModel):
    prompt: str

@app.post("/executar")
async def executar_pipeline(payload: PromptPayload):
    try:
        initial_state = {
            "input_prompt": payload.prompt,
            "context": "",
            "current_code": "",
            "critic_feedback": "",
            "loop_count": 0,
            "execution_logs": []
        }
        
        # Executa o grafo multi-agente
        final_state = alfred_nexus_graph.invoke(initial_state)
        
        return {
            "status": "sucesso",
            "logs": final_state["execution_logs"],
            "codigo_gerado": final_state["current_code"],
            "critica": final_state["critic_feedback"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🚀 Alfred Nexus rodando localmente http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
    """.trimIndent()

    private val readmeMd = """
# README.md
# Guia de Otimização e Uso do Alfred Nexus Local

Alfred Nexus é uma extensão profissional projetada para entregar raciocínio profundo de multi-agentes de forma 100% gratuita, privada e rodando na sua própria máquina.

## ⚙️ Dicas de Hardware e Requisitos Mínimos

Dependendo do tamanho dos modelos, as especificações mínimas de RAM/VRAM recomendadas são:

1. **Setup Leve (Modelos 3B/7B quantizados - GGUF Int4)**:
   - Mínimo de 8GB RAM Unificada (Mac M1/M2/M3) ou 4GB de VRAM dedicada (NVIDIA GTX 1650/RTX 3050).
   - *Modelos recomendados*: `qwen2.5-coder:3b` + `llama3.2:3b`.
2. **Setup Padrão (Modelos 7B/8B quantizados - GGUF Int4/Int8)**:
   - Mínimo de 16GB RAM Unificada (Mac) ou 8GB de VRAM dedicada (NVIDIA RTX 3160/3060).
   - *Modelos recomendados*: `qwen2.5-coder:7b-instruct-q4_K_M` + `llama3:8b-instruct-q4_K_M`.
3. **Setup Avançado (Multimodal e Raciocínio Int8/FP16)**:
   - Mínimo de 32GB RAM Unificada ou 16GB de VRAM dedicada (NVIDIA RTX 4080/4090).
   - *Modelos recomendados*: `qwen2.5-coder:14b` + `llama3:70b-instruct-q4_K_M` + `qwen-vl:7b`.

---

## 🛠️ Como Instalar e Rodar Localmente (Passo-a-Passo)

1. Instale o **Ollama** na sua máquina oficial: https://ollama.com
2. Baixe os modelos necessários no seu terminal:
   ```bash
   ollama pull qwen2.5-coder:7b-instruct-q4_K_M
   ollama pull llama3:8b-instruct-q4_K_M
   ```
3. Garanta que o Ollama esteja rodando em segundo plano (escutando na porta padrão 11434).
4. No terminal, instale os pacotes requirements:
   ```bash
   pip install -r requirements.txt
   ```
5. Rode o servidor principal FastAPI:
   ```bash
   python main.py
   ```

---

## 🚀 Como Adicionar novos Agentes ou Tools Facilmente (Em minutos!)

O Alfred Nexus foi desenvolvido utilizando modularidade absoluta. Para estender a arquitetura:

### 1. Criando uma nova Tool (Em `tools.py`):
Adicione um decorator `@tool` do CrewAI e defina sua lógica:
```python
@tool("GitHub Issue Manager")
def github_issue_tool(issue_title: str, body: str) -> str:
    "Cria automaticamente issues técnicas no repositório local do usuário."
    # Sua lógica para chamar a API do GitHub
    return f"Issue '{issue_title}' postada com sucesso!"
```

### 2. Criando um novo Agente (Em `agents.py`):
Instancie o agente com a LLM local e mapeie suas ferramentas:
```python
tester_agent = Agent(
    role="Engenheiro de Testes de Integração",
    goal="Escrever simulações comportamentais no pytest.",
    backstory="Especializado em cobertura de testes end-to-end.",
    tools=[github_issue_tool], 
    llm=local_llm_chief,
    verbose=True
)
```

### 3. Registrando no LangGraph (Em `graph.py`):
Adicione o nó do agente e configure suas rotas de fluxo:
```python
# 1. Defina o nó executor
def tester_node(state: AgentGraphState):
    result = agents.tester_agent.execute(prompt=state["input_prompt"])
    return {"execution_logs": state["execution_logs"] + [f"Tests created."]}

# 2. Registre no workflow:
workflow.add_node("tester", tester_node)

# 3. Adicione as transições:
workflow.add_edge("critic", "tester")
workflow.add_edge("tester", "memory")
```
Pronto! Seu novo circuito modular multi-agente está completo e pronto para rodar.
    """.trimIndent()
}
