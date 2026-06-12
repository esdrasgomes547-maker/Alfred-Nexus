package com.example.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class ApiMessage(val role: String, val content: String)

class AlfredApi(
    private val baseUrl: String,
    private val token: String = "",
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    suspend fun streamChat(
        messages: List<ApiMessage>,
        onToken:  (String) -> Unit,
        onDone:   () -> Unit,
        onError:  (String) -> Unit,
    ) = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("messages", JSONArray().apply {
                messages.forEach { m ->
                    put(JSONObject().apply {
                        put("role",    m.role)
                        put("content", m.content)
                    })
                }
            })
        }.toString()

        val request = Request.Builder()
            .url("$baseUrl/api/chat")
            .post(body.toRequestBody("application/json".toMediaType()))
            .addHeader("Accept", "text/event-stream")
            .apply { if (token.isNotEmpty()) addHeader("Authorization", "Bearer $token") }
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    onError("Erro ${response.code}")
                    return@withContext
                }
                response.body?.byteStream()?.bufferedReader()?.use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val l = line ?: continue
                        if (!l.startsWith("data: ")) continue
                        val json = l.removePrefix("data: ").trim()
                        if (json.isEmpty()) continue
                        try {
                            val obj = JSONObject(json)
                            when {
                                obj.has("token") -> onToken(obj.getString("token"))
                                obj.has("done")  -> { onDone(); return@withContext }
                                obj.has("error") -> { onError(obj.getString("error")); return@withContext }
                            }
                        } catch (_: Exception) { }
                    }
                    onDone()
                }
            }
        } catch (e: IOException) {
            onError("Falha de conexão: ${e.message ?: "desconhecido"}")
        }
    }
}
