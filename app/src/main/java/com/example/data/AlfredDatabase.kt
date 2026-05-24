package com.example.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

// --- 1. ENTITIES ---

@Entity(tableName = "prompts")
data class WorkspacePrompt(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val text: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "agent_run_logs")
data class AgentRunLog(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val promptId: Int,
    val agentName: String, // "Supervisor", "Researcher", "Coder", "Critic", "Memory", "Multimodal"
    val thought: String,
    val status: String,    // "ACTIVE", "SUCCESS", "ERROR", "WAITING"
    val result: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "rag_documents")
data class LocalRAGDoc(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val fileName: String,
    val content: String,
    val sizeBytes: Long,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "self_reflections")
data class SelfReflectionLog(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val agentRunsEvaluated: Int,
    val insight: String,
    val optimizedRule: String,
    val timestamp: Long = System.currentTimeMillis()
)

// --- 2. DAOs ---

@Dao
interface AlfredDao {
    // Prompts
    @Query("SELECT * FROM prompts ORDER BY timestamp DESC")
    fun getAllPromptsFlow(): Flow<List<WorkspacePrompt>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPrompt(prompt: WorkspacePrompt): Long

    @Query("DELETE FROM prompts WHERE id = :id")
    suspend fun deletePromptById(id: Int)

    @Query("DELETE FROM prompts")
    suspend fun clearPrompts()

    // Run Logs
    @Query("SELECT * FROM agent_run_logs WHERE promptId = :promptId ORDER BY id ASC")
    fun getLogsForPromptFlow(promptId: Int): Flow<List<AgentRunLog>>

    @Query("SELECT * FROM agent_run_logs WHERE promptId = :promptId ORDER BY id ASC")
    suspend fun getLogsForPrompt(promptId: Int): List<AgentRunLog>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRunLog(log: AgentRunLog)

    @Query("DELETE FROM agent_run_logs WHERE promptId = :promptId")
    suspend fun deleteLogsForPrompt(promptId: Int)

    // RAG Docs
    @Query("SELECT * FROM rag_documents ORDER BY timestamp DESC")
    fun getAllRagDocsFlow(): Flow<List<LocalRAGDoc>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRagDoc(doc: LocalRAGDoc)

    @Query("DELETE FROM rag_documents WHERE id = :id")
    suspend fun deleteRagDocById(id: Int)

    // Self Reflections
    @Query("SELECT * FROM self_reflections ORDER BY timestamp DESC")
    fun getAllReflectionsFlow(): Flow<List<SelfReflectionLog>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReflection(reflection: SelfReflectionLog)

    @Query("DELETE FROM self_reflections")
    suspend fun clearReflections()
}

// --- 3. DATABASE ---

@Database(
    entities = [
        WorkspacePrompt::class,
        AgentRunLog::class,
        LocalRAGDoc::class,
        SelfReflectionLog::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AlfredDatabase : RoomDatabase() {
    abstract fun dao(): AlfredDao

    companion object {
        @Volatile
        private var INSTANCE: AlfredDatabase? = null

        fun getDatabase(context: Context): AlfredDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AlfredDatabase::class.java,
                    "alfred_nexus_db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
