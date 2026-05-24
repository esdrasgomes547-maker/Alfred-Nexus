package com.example.data

import android.content.Context
import com.example.service.GeminiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

class AlfredRepository(context: Context) {
    private val database = AlfredDatabase.getDatabase(context)
    private val dao = database.dao()

    // Flow lists
    val allPrompts: Flow<List<WorkspacePrompt>> = dao.getAllPromptsFlow()
    val allRagDocs: Flow<List<LocalRAGDoc>> = dao.getAllRagDocsFlow()
    val allReflections: Flow<List<SelfReflectionLog>> = dao.getAllReflectionsFlow()

    fun getLogsForPromptFlow(promptId: Int): Flow<List<AgentRunLog>> = dao.getLogsForPromptFlow(promptId)

    /**
     * Executes a complete simulated or real multi-agent run, saving records to Room.
     */
    suspend fun executeAgentPipeline(promptText: String, activeDocs: List<LocalRAGDoc>): Int = withContext(Dispatchers.IO) {
        // 1. Create and save the primary prompt
        val prompt = WorkspacePrompt(text = promptText)
        val promptId = dao.insertPrompt(prompt).toInt()

        // 2. Build RAG context if user has indexed documents
        val ragContext = activeDocs.joinToString("\n---\n") { 
            "Document: ${it.fileName}\nContent: ${it.content}"
        }

        // 3. Request multi-agent orchestration logs from service
        val runLogs = GeminiService.simulateMultiAgentRun(promptText, ragContext)

        // 4. Save each agent's run log into Room linked to promptId
        for (log in runLogs) {
            dao.insertRunLog(log.copy(promptId = promptId))
        }

        return@withContext promptId
    }

    /**
     * Simulates indexing/adding a custom user RAG document.
     */
    suspend fun addRagDocument(fileName: String, content: String) = withContext(Dispatchers.IO) {
        val sizeBytes = content.toByteArray().size.toLong()
        dao.insertRagDoc(
            LocalRAGDoc(
                fileName = fileName,
                content = content,
                sizeBytes = sizeBytes
            )
        )
    }

    /**
     * Deletes a RAG document by ID.
     */
    suspend fun deleteRagDoc(id: Int) = withContext(Dispatchers.IO) {
        dao.deleteRagDocById(id)
    }

    /**
     * Deletes a prompt and its corresponding agent run logs.
     */
    suspend fun deletePrompt(promptId: Int) = withContext(Dispatchers.IO) {
        dao.deletePromptById(promptId)
        dao.deleteLogsForPrompt(promptId)
    }

    /**
     * Clears all workspace prompts and logs.
     */
    suspend fun clearWorkspace() = withContext(Dispatchers.IO) {
        dao.clearPrompts()
        dao.clearReflections()
    }

    /**
     * Triggers the self-reflection and self-improvement loop.
     */
    suspend fun triggerSelfReflection(prompts: List<WorkspacePrompt>) = withContext(Dispatchers.IO) {
        if (prompts.isEmpty()) return@withContext

        // Evaluate up to 5 recent prompts
        val promptTexts = prompts.take(5).map { it.text }
        val (insight, rule) = GeminiService.runSelfReflection(promptTexts)

        // Save findings
        dao.insertReflection(
            SelfReflectionLog(
                agentRunsEvaluated = promptTexts.size,
                insight = insight,
                optimizedRule = rule
            )
        )
    }
}
