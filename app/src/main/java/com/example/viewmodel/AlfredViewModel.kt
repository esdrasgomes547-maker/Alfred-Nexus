package com.example.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.AlfredApi
import com.example.data.ApiMessage
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

enum class AlfredState { IDLE, PONDERING, RESPONDING }

data class ChatMessage(
    val id:          Long    = System.currentTimeMillis(),
    val role:        String,
    val content:     String,
    val isStreaming: Boolean = false,
)

class AlfredViewModel(application: Application) : AndroidViewModel(application) {

    // Set to the notebook's LAN IP during real usage; 10.0.2.2 works for the Android emulator.
    var serverUrl: String = "http://10.0.2.2:8000"
    var token:     String = ""

    private val _messages    = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _alfredState = MutableStateFlow(AlfredState.IDLE)
    val alfredState: StateFlow<AlfredState> = _alfredState.asStateFlow()

    private var streamJob: Job? = null

    fun send(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _alfredState.value != AlfredState.IDLE) return

        _messages.update { it + ChatMessage(role = "user", content = trimmed) }
        _alfredState.value = AlfredState.PONDERING

        streamJob = viewModelScope.launch {
            val placeholderId = System.currentTimeMillis() + 1L
            _messages.update { it + ChatMessage(id = placeholderId, role = "assistant", content = "", isStreaming = true) }
            _alfredState.value = AlfredState.RESPONDING

            val history = _messages.value
                .filter { !it.isStreaming }
                .takeLast(20)
                .map { ApiMessage(it.role, it.content) }

            var buffer = ""

            AlfredApi(serverUrl, token).streamChat(
                messages = history,
                onToken  = { tok ->
                    buffer += tok
                    _messages.update { msgs ->
                        msgs.map { m -> if (m.id == placeholderId) m.copy(content = buffer) else m }
                    }
                },
                onDone   = {
                    _messages.update { msgs ->
                        msgs.map { m ->
                            if (m.id == placeholderId) m.copy(content = buffer, isStreaming = false) else m
                        }
                    }
                    _alfredState.value = AlfredState.IDLE
                },
                onError  = { err ->
                    _messages.update { msgs ->
                        msgs.map { m ->
                            if (m.id == placeholderId) m.copy(
                                content = if (buffer.isNotEmpty()) buffer else "— Falha de conexão. Verifique o servidor, senhor.",
                                isStreaming = false
                            ) else m
                        }
                    }
                    _alfredState.value = AlfredState.IDLE
                }
            )
        }
    }

    fun cancel() {
        streamJob?.cancel()
        _messages.update { msgs -> msgs.map { m -> if (m.isStreaming) m.copy(isStreaming = false) else m } }
        _alfredState.value = AlfredState.IDLE
    }

    fun clearHistory() {
        cancel()
        _messages.value = emptyList()
    }
}
