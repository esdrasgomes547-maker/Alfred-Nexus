package com.example.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class AlfredViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = AlfredRepository(application)

    // Reactive State lists from Database
    val allPrompts: StateFlow<List<WorkspacePrompt>> = repository.allPrompts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allRagDocs: StateFlow<List<LocalRAGDoc>> = repository.allRagDocs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allReflections: StateFlow<List<SelfReflectionLog>> = repository.allReflections
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Workspace control states
    private val _currentPromptId = MutableStateFlow<Int?>(null)
    val currentPromptId: StateFlow<Int?> = _currentPromptId.asStateFlow()

    private val _currentLogs = MutableStateFlow<List<AgentRunLog>>(emptyList())
    val currentLogs: StateFlow<List<AgentRunLog>> = _currentLogs.asStateFlow()

    private val _isPipelineRunning = MutableStateFlow(false)
    val isPipelineRunning: StateFlow<Boolean> = _isPipelineRunning.asStateFlow()

    private val _isOptimizing = MutableStateFlow(false)
    val isOptimizing: StateFlow<Boolean> = _isOptimizing.asStateFlow()

    private val _activeTab = MutableStateFlow("playground") // playground, code_hub, rag, settings, voice
    val activeTab: StateFlow<String> = _activeTab.asStateFlow()

    // Configuration Settings (saved in datastore/memory)
    private val _selectedModel = MutableStateFlow("qwen2.5-coder:7b")
    val selectedModel: StateFlow<String> = _selectedModel.asStateFlow()

    private val _quantizationMode = MutableStateFlow("q4_K_M (4-bit)")
    val quantizationMode: StateFlow<String> = _quantizationMode.asStateFlow()

    private val _vectorStoreType = MutableStateFlow("ChromaDB (Local)")
    val vectorStoreType: StateFlow<String> = _vectorStoreType.asStateFlow()

    init {
        // Automatically listen to Agent logs when the selectedPromptId changes
        viewModelScope.launch {
            _currentPromptId.collectLatest { id ->
                if (id != null) {
                    repository.getLogsForPromptFlow(id).collect { logs ->
                        _currentLogs.value = logs
                    }
                } else {
                    _currentLogs.value = emptyList()
                }
            }
        }

        // Set the most recent prompt as selected automatically on list update if none selected
        viewModelScope.launch {
            allPrompts.collect { list ->
                if (_currentPromptId.value == null && list.isNotEmpty()) {
                    _currentPromptId.value = list.first().id
                }
            }
        }
    }

    fun selectPrompt(id: Int) {
        _currentPromptId.value = id
    }

    fun setTab(tab: String) {
        _activeTab.value = tab
    }

    fun updateConfig(model: String, quant: String, dbType: String) {
        _selectedModel.value = model
        _quantizationMode.value = quant
        _vectorStoreType.value = dbType
    }

    /**
     * Triggers the complete agentic pipeline
     */
    fun runPipeline(promptText: String) {
        if (promptText.isBlank()) return
        viewModelScope.launch {
            _isPipelineRunning.value = true
            try {
                // Execute pipeline, passing active indexed RAG docs for context compilation
                val promptId = repository.executeAgentPipeline(promptText, allRagDocs.value)
                _currentPromptId.value = promptId
            } catch (e: Exception) {
                // Log and safe fallback is managed inside service, but we handle exceptions here too
            } finally {
                _isPipelineRunning.value = false
            }
        }
    }

    /**
     * Adds virtual documentation for RAG simulation
     */
    fun addRagDoc(fileName: String, content: String) {
        viewModelScope.launch {
            repository.addRagDocument(fileName, content)
        }
    }

    /**
     * Deletes a specific RAG doc
     */
    fun deleteRagDoc(id: Int) {
        viewModelScope.launch {
            repository.deleteRagDoc(id)
        }
    }

    /**
     * Deletes a prompt and its run steps
     */
    fun removePrompt(id: Int) {
        viewModelScope.launch {
            if (_currentPromptId.value == id) {
                _currentPromptId.value = null
            }
            repository.deletePrompt(id)
        }
    }

    /**
     * Resets the databases/workspace
     */
    fun clearAllData() {
        viewModelScope.launch {
            _currentPromptId.value = null
            _currentLogs.value = emptyList()
            repository.clearWorkspace()
        }
    }

    /**
     * Triggers the self-reflection loop manually
     */
    fun optimizeAgents() {
        if (allPrompts.value.isEmpty()) return
        viewModelScope.launch {
            _isOptimizing.value = true
            try {
                repository.triggerSelfReflection(allPrompts.value)
            } finally {
                _isOptimizing.value = false
            }
        }
    }
}
