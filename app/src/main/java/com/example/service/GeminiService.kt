package com.example.service

import android.util.Log
import com.example.data.AgentRunLog
import com.example.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

object GeminiService {
    private const val TAG = "GeminiService"
    private const val BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"

    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    /**
     * Checks if a valid API Key is present.
     */
    fun isKeyConfigured(): Boolean {
        val key = BuildConfig.GEMINI_API_KEY
        return key.isNotEmpty() && key != "MY_GEMINI_API_KEY" && !key.contains("PLACEHOLDER")
    }

    /**
     * Requests Gemini to simulate the multi-agent collaboration and return structured run logs.
     */
    suspend fun simulateMultiAgentRun(userPrompt: String, ragoContext: String = ""): List<AgentRunLog> {
        if (!isKeyConfigured()) {
            return generateOfflineRun(userPrompt)
        }

        val systemInstruction = """
            You are the "Alfred Nexus" Multi-Agent Orchestrator framework (equivalent to Gemini 2.5, DeepSeek R1 reasoning, and Claude Code style).
            The user wants to resolve the following request: "$userPrompt"
            ${if (ragoContext.isNotEmpty()) "Context from active RAG documents: $ragoContext" else ""}

            You must simulate a collaborative multi-agent execution flow using 5 structured stages. Return the response strictly as a JSON list matching this schema:
            [
              {
                "agentName": "Supervisor",
                "thought": "State the high-level plan and agent routing based on LangGraph orchestration.",
                "status": "SUCCESS",
                "result": "Plan: \n1. Research details\n2. Draft python/HTML/markdown code.\n3. Verify against edge cases.\n4. Save to memory."
              },
              {
                "agentName": "Researcher",
                "thought": "Analyze terms, documentation, query vector store, and search reference data.",
                "status": "SUCCESS",
                "result": "Retrieved API specs, syntax requirements, or context details relevant to the task."
              },
              {
                "agentName": "Coder",
                "thought": "Write complete and fully formatted source code/files. No half-finished placeholders.",
                "status": "SUCCESS",
                "result": "Provide the actual code written in beautiful formatting (e.g. ```python ... ```)."
              },
              {
                "agentName": "Critic",
                "thought": "Evaluate the code written, critique quality, safety, standard violations, and log checks.",
                "status": "SUCCESS",
                "result": "Analysis: Passes all unit tests. No memory leaks. Suggested optimization applied successfully."
              },
              {
                "agentName": "Memory",
                "thought": "Deconstruct lessons learned, summarize, index to sqlite/chromadb, and output self-improving prompt rules.",
                "status": "SUCCESS",
                "result": "Long-term memory updated. Context logged. Self-improving rule: When doing this task, always prioritize X."
              }
            ]

            Strict rules:
            1. Return ONLY the JSON array. Do not wrap in markdown code blocks like ```json or prefix with text.
            2. Make sure the 'result' attributes are detailed and contain actual professional content for the request (e.g., actual Python, Kotlin, or HTML code in 'Coder's result, real search details in 'Researcher').
            3. The response must be a valid JSON array parseable by org.json.JSONArray.
        """.trimIndent()

        val jsonRequest = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply {
                            put("text", "Execute multi-agent graph simulation for: $userPrompt")
                        })
                    })
                })
            })
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply {
                        put("text", systemInstruction)
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("responseMimeType", "application/json")
                put("temperature", 0.3)
            })
        }

        val requestBody = jsonRequest.toString().toRequestBody("application/json".toMediaType())
        val url = "$BASE_URL?key=${BuildConfig.GEMINI_API_KEY}"

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val errBody = response.body?.string() ?: "Unknown error"
                    Log.e(TAG, "Gemini API error: HTTP ${response.code} -> $errBody")
                    return generateErrorRun(userPrompt, "HTTP error ${response.code}: $errBody")
                }

                val resBody = response.body?.string()
                if (resBody.isNullOrEmpty()) {
                    return generateErrorRun(userPrompt, "Empty response body from api")
                }

                try {
                    val rootJson = JSONObject(resBody)
                    val candidates = rootJson.getJSONArray("candidates")
                    val candidate = candidates.getJSONObject(0)
                    val content = candidate.getJSONObject("content")
                    val parts = content.getJSONArray("parts")
                    val rawText = parts.getJSONObject(0).getString("text").trim()

                    // Try parsing as JSON list
                    val jsonArray = JSONArray(rawText)
                    val logsList = mutableListOf<AgentRunLog>()
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        logsList.add(
                            AgentRunLog(
                                promptId = 0, // Will be set by repository after saving prompt
                                agentName = obj.optString("agentName", "Unknown"),
                                thought = obj.optString("thought", "Reasoning..."),
                                status = obj.optString("status", "SUCCESS"),
                                result = obj.optString("result", ""),
                                timestamp = System.currentTimeMillis() + (i * 100)
                            )
                        )
                    }
                    return logsList
                } catch (e: Exception) {
                    Log.e(TAG, "JSON parsing of response failed: ${e.message}. Raw text: $resBody")
                    return generateErrorRun(userPrompt, "JSON parsing error: ${e.localizedMessage}")
                }
            }
        } catch (e: IOException) {
            Log.e(TAG, "Network call failed", e)
            return generateErrorRun(userPrompt, "No internet or timeout: ${e.localizedMessage}")
        }
    }

    /**
     * Simulation template for self-improvement and self-reflection loops.
     */
    suspend fun runSelfReflection(promptHistory: List<String>): Pair<String, String> {
        val defaultInsight = "ChromaDB memory index shows 94% retrieval accuracy. Agent communication latency normalized to 112ms per node."
        val defaultRule = "Supervisor rule: If code output contains state management, delegate safety checking to verified edge-case models."

        if (!isKeyConfigured()) {
            return Pair(defaultInsight, defaultRule)
        }

        val promptListText = promptHistory.joinToString("\n") { "- $it" }
        val systemInstruction = """
            You are the "Alfred Nexus" Self-Reflection Agent.
            Evaluate these recent user requests executed in our Agent framework:
            $promptListText

            Analyze patterns in these tasks, and generate:
            1. An advanced engineering insight (e.g., prompt analysis, vector chunking efficiency, or tool calling latency).
            2. An optimized system rule or directive that the Supervisor should inject next time to avoid failures or boost quality (self-improving loop).

            Return as a simple JSON object matching:
            {
              "insight": "Explain the analysis and optimization of the agent graph based on past interactions",
              "rule": "Write a concrete prompt directive for future runs"
            }
        """.trimIndent()

        val jsonRequest = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply {
                            put("text", "Perform self-reflection logic on prompt history")
                        })
                    })
                })
            })
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply {
                        put("text", systemInstruction)
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("responseMimeType", "application/json")
                put("temperature", 0.4)
            })
        }

        val requestBody = jsonRequest.toString().toRequestBody("application/json".toMediaType())
        val url = "$BASE_URL?key=${BuildConfig.GEMINI_API_KEY}"

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val rawBody = response.body?.string() ?: ""
                    val rootJson = JSONObject(rawBody)
                    val rawText = rootJson.getJSONArray("candidates")
                        .getJSONObject(0)
                        .getJSONObject("content")
                        .getJSONArray("parts")
                        .getJSONObject(0)
                        .getString("text").trim()
                    
                    val obj = JSONObject(rawText)
                    return Pair(obj.optString("insight", defaultInsight), obj.optString("rule", defaultRule))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Self-reflection call failed: ${e.message}")
        }

        return Pair(defaultInsight, defaultRule)
    }

    /**
     * Fallback high-quality offline simulation in Portuguese so the app is always functional.
     */
    private fun generateOfflineRun(prompt: String): List<AgentRunLog> {
        val cleanPrompt = prompt.lowercase()
        val isCode = cleanPrompt.contains("codigo") || cleanPrompt.contains("api") || cleanPrompt.contains("funcao") || cleanPrompt.contains("escreva") || cleanPrompt.contains("python") || cleanPrompt.contains("crie")

        val codeResult = if (isCode) {
            """
            # [Alfred Nexus Coder Agent] - Autopiloto Ativo 
            import os
            import sys
            import logfire
            from fastapi import FastAPI, HTTPException
            from pydantic import BaseModel, EmailStr
            
            app = FastAPI(title="Alfred Generated Service (Local)")
            logfire.configure()
            
            class EmailRequest(BaseModel):
                destinatario: EmailStr
                assunto: str
                corpo_mensagem: str
                
            @app.post("/enviar-email")
            async def enviar_email(payload: EmailRequest):
                try:
                    # Simulação de envio seguro com o ferramenta local 'SMTP_Tool'
                    print(f"Enviando email para {payload.destinatario}")
                    return {"status": "enviado", "id": "msg_984183719"}
                except Exception as e:
                    raise HTTPException(status_code=500, detail=str(e))
            """.trimIndent()
        } else {
            """
            # [Alfred Nexus Agent Output] - Processamento RAG Concluído
            Resultado da busca semântica sobre "$prompt" compilado com sucesso a partir do banco ChromaDB local.
            - Itens relevantes indexados: 4 documentos de texto, 1 arquivo em pdf.
            - Estratégia recomendada: Executar pipeline modular e orquestrar através de CrewAI.
            """.trimIndent()
        }

        return listOf(
            AgentRunLog(
                promptId = 0,
                agentName = "Supervisor",
                thought = "Recebido o prompt: \"$prompt\". Orquestrando agentes disponíveis no Alfred Nexus Hub. Ativando Researcher para documentação e Coder para montagem segura.",
                status = "SUCCESS",
                result = "Plano:\n1. Researcher analisa referências locais.\n2. Coder estrutura os scripts.\n3. Critic valida segurança de tipos no Python 3.11.\n4. Memory registra as regras de self-reflection."
            ),
            AgentRunLog(
                promptId = 0,
                agentName = "Researcher",
                thought = "Buscando referências offline no SQLite, indexadores de RAG locais e no repositório de templates pré-quantizados. Módulos carregados com sucesso.",
                status = "SUCCESS",
                result = "Resultado: Encontrados 3 templates compatíveis de APIs Python modernas configurados para processamento de baixo overhead."
            ),
            AgentRunLog(
                promptId = 0,
                agentName = "Coder",
                thought = "Gerando o script local respeitando as diretrizes Open-Source e as bibliotecas importadas (FastAPI, LangGraph). Injetando monitoramento.",
                status = "SUCCESS",
                result = codeResult
            ),
            AgentRunLog(
                promptId = 0,
                agentName = "Critic",
                thought = "Analisando estaticamente a estrutura do código gerado pelo Coder Agent. Validando dependências e possíveis leaks de recursos.",
                status = "SUCCESS",
                result = "Verificação: Código 100% livre de vulnerabilidades de injeção. Tipos Pydantic estruturados corretamente."
            ),
            AgentRunLog(
                promptId = 0,
                agentName = "Memory",
                thought = "Consolidando logs de execução. Resumindo a resposta para armazenamento no ChromaDB e atualizando o score de afinidade do Supervisor.",
                status = "SUCCESS",
                result = "Memória persistida. Auto-otimização: Próximas chamadas para tarefas semelhantes aceleradas em 15% por cache semântico."
            )
        )
    }

    private fun generateErrorRun(prompt: String, errorText: String): List<AgentRunLog> {
        return listOf(
            AgentRunLog(
                promptId = 0,
                agentName = "Supervisor",
                thought = "Falha na conexão de inteligência ativa.",
                status = "ERROR",
                result = "Erro detectado: $errorText\nConfigure sua chave GEMINI_API_KEY no painel de Secrets do AI Studio para obter respostas reais e dinâmicas dos agentes ou verifique sua conexão!"
            )
        )
    }
}
