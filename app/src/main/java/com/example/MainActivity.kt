package com.example

import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AgentRunLog
import com.example.data.LocalRAGDoc
import com.example.data.PythonCodeTemplates
import com.example.ui.theme.*
import com.example.viewmodel.AlfredViewModel
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity(), TextToSpeech.OnInitListener {

    private val viewModel: AlfredViewModel by viewModels()
    private var tts: TextToSpeech? = null
    private var isTtsInitialized = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Init Text-to-Speech
        try {
            tts = TextToSpeech(this, this)
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to initialize TextToSpeech", e)
        }

        setContent {
            MyApplicationTheme {
                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    containerColor = CyberBlack
                ) { innerPadding ->
                    MainScreen(
                        viewModel = viewModel,
                        speak = ::speakText,
                        modifier = Modifier.padding(innerPadding)
                    )
                }
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            try {
                val result = tts?.setLanguage(Locale("pt", "BR"))
                if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                    isTtsInitialized = true
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Error in TextToSpeech onInit: ${e.message}", e)
            }
        }
    }

    private fun speakText(text: String) {
        if (isTtsInitialized) {
            try {
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AlfredSpeech")
            } catch (e: Exception) {
                Log.e("MainActivity", "speakText failed", e)
            }
        }
    }

    override fun onDestroy() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            Log.e("MainActivity", "Error during TextToSpeech shutdown: ${e.message}", e)
        }
        super.onDestroy()
    }
}

@Composable
fun MainScreen(
    viewModel: AlfredViewModel,
    speak: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val activeTab by viewModel.activeTab.collectAsState()
    val isRunning by viewModel.isPipelineRunning.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CyberBlack)
    ) {
        // Futuristic Header
        HeaderSection(viewModel)

        // Tab Content Area
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            when (activeTab) {
                "playground" -> PlaygroundTab(viewModel)
                "code_hub" -> CodeHubTab()
                "rag" -> RagDocsTab(viewModel)
                "settings" -> SettingsTab(viewModel)
                "voice" -> VoiceTab(viewModel, speak)
            }
        }

        // Custom High-Tech Navigation Bar
        HighTechNavBar(
            activeTab = activeTab,
            onTabSelected = { viewModel.setTab(it) }
        )
    }
}

// --- CORE UI COMPONENTS ---

@Composable
fun HeaderSection(viewModel: AlfredViewModel) {
    val context = LocalContext.current
    var showHelpDialog by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ObsidianDark)
            .padding(horizontal = 16.dp, vertical = 14.dp)
            .drawBehind {
                drawLine(
                    color = CyberCyan.copy(alpha = 0.3f),
                    start = Offset(0f, size.height),
                    end = Offset(size.width, size.height),
                    strokeWidth = 2f
                )
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // App adaptive logo badge
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(CyberCyan.copy(alpha = 0.15f))
                    .border(1.dp, CyberCyan, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Build,
                    contentDescription = "Logo",
                    tint = CyberCyan,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "ALFRED NEXUS",
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = CyberCyan,
                    letterSpacing = 1.sp
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(ActiveGreen)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "LOCAL DEEP ORCHESTRATOR",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                        color = GhostText,
                        letterSpacing = 0.5.sp
                    )
                }
            }
        }

        IconButton(
            onClick = { showHelpDialog = true },
            modifier = Modifier.testTag("help_button")
        ) {
            Icon(
                imageVector = Icons.Default.Info,
                contentDescription = "Instruções",
                tint = CyberCyan
            )
        }
    }

    if (showHelpDialog) {
        AlertDialog(
            onDismissRequest = { showHelpDialog = false },
            title = {
                Text(
                    "Alfred Nexus Orquestrador",
                    fontFamily = FontFamily.Monospace,
                    color = CyberCyan,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text(
                        "Bem-vindo ao workspace do Alfred Nexus, um ambiente profissional inspirado nos recursos inovadores do Claude Code, DeepSeek R1 e o1.",
                        color = PureWhite,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Como usar as abas:",
                        color = CyberCyan,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                    Text(
                        "• Playground: Digite prompts e veja a colaboração multi-agente agir (Supervisor, Pesquisador, Coder, Crítico, Memória).\n" +
                        "• Arquivos Python: Leia e copie os códigos reais para montar o Framework na sua máquina.\n" +
                        "• Documentos RAG: Cadastre guias de texto para abastecer a busca semântica ChromaDB local.\n" +
                        "• Otimização: Ajuste pesos de quantização e veja insights de auto-aprimoramento.\n" +
                        "• Modo Voz: Faça perguntas com voz nativa e ouça as respostas do Supervisor.",
                        color = PureWhite,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showHelpDialog = false }) {
                    Text("OK", color = CyberCyan)
                }
            },
            containerColor = ObsidianDark,
            titleContentColor = CyberCyan,
            textContentColor = PureWhite
        )
    }
}

@Composable
fun HighTechNavBar(
    activeTab: String,
    onTabSelected: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ObsidianDark)
            .navigationBarsPadding()
            .padding(vertical = 4.dp, horizontal = 8.dp)
            .drawBehind {
                drawLine(
                    color = CyberCyan.copy(alpha = 0.2f),
                    start = Offset(0f, 0f),
                    end = Offset(size.width, 0f),
                    strokeWidth = 2f
                )
            },
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        val tabs = listOf(
            Triple("playground", "Agentes", Icons.Default.Home),
            Triple("code_hub", "Trunk", Icons.Default.Build),
            Triple("rag", "RAG", Icons.Default.Search),
            Triple("voice", "Falar", Icons.Default.PlayArrow),
            Triple("settings", "Self-Ref", Icons.Default.Settings)
        )

        tabs.forEach { (tabId, label, icon) ->
            val isSelected = activeTab == tabId
            val glowAnim by animateFloatAsState(
                targetValue = if (isSelected) 1f else 0.3f,
                animationSpec = tween(300), label = "glow"
            )

            IconButton(
                onClick = { onTabSelected(tabId) },
                modifier = Modifier
                    .weight(1f)
                    .padding(vertical = 4.dp)
                    .testTag("nav_${tabId}")
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (isSelected) CyberCyan else PureWhite.copy(alpha = 0.4f),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = label,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) CyberCyan else PureWhite.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

// --- 1. PLAYGROUND TAB ---

@Composable
fun PlaygroundTab(viewModel: AlfredViewModel) {
    val prompts by viewModel.allPrompts.collectAsState()
    val logs by viewModel.currentLogs.collectAsState()
    val isRunning by viewModel.isPipelineRunning.collectAsState()
    val selectedId by viewModel.currentPromptId.collectAsState()

    var inputPrompt by remember { mutableStateOf("") }
    var scaffoldState = rememberScrollState()

    Column(modifier = Modifier.fillMaxSize()) {
        // Top list of prompt history
        if (prompts.isNotEmpty()) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SlateGrey.copy(alpha = 0.5f))
                    .padding(vertical = 8.dp, horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(prompts) { p ->
                    val isSelected = selectedId == p.id
                    Card(
                        modifier = Modifier
                            .clickable { viewModel.selectPrompt(p.id) }
                            .testTag("prompt_item_${p.id}"),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) CyberCyan.copy(alpha = 0.15f) else ObsidianDark,
                            contentColor = PureWhite
                        ),
                        border = BorderStroke(
                            1.dp,
                            if (isSelected) CyberCyan else MutedSlate
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = p.text,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.widthIn(max = 120.dp),
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Deletar",
                                tint = DangerRed.copy(alpha = 0.6f),
                                modifier = Modifier
                                    .size(14.dp)
                                    .clickable { viewModel.removePrompt(p.id) }
                            )
                        }
                    }
                }
            }
        }

        // Active Pipeline Monitor or step log
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(CyberBlack)
        ) {
            if (isRunning) {
                PipelineRunningIndicator()
            } else if (logs.isNotEmpty()) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    contentPadding = PaddingValues(vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Draw visual connection node connections map
                    item {
                        InteractiveAgentGraph(logs)
                    }

                    // Render each active step logs
                    items(logs) { log ->
                        AgentLogCard(log)
                    }
                }
            } else {
                // Empty state
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.Home,
                        contentDescription = "Vazio",
                        tint = GhostText,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Nenhum pipeline ativo.",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = PureWhite,
                        fontFamily = FontFamily.Monospace
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Insira um comando no console técnico abaixo ou clique em um dos exemplos rápidos para simular o workflow dos agentes open-source no micro-terminal.",
                        textAlign = TextAlign.Center,
                        fontSize = 12.sp,
                        color = GhostText,
                        lineHeight = 18.sp
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    // Preset templates
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val suggestionPrompts = listOf(
                            "Criar api fastapi no python 3.12",
                            "Pesquisar sobre DeepSeek R1 no Chroma",
                            "Gerador de e-mail de aniversários seguro"
                        )
                        items(suggestionPrompts) { item ->
                            OutlinedButton(
                                onClick = {
                                    inputPrompt = item
                                    viewModel.runPipeline(item)
                                },
                                border = BorderStroke(1.dp, CyberCyan.copy(alpha = 0.5f))
                            ) {
                                Text(item, fontSize = 11.sp, color = CyberCyan, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
                }
            }
        }

        // Terminal Prompt Input Box
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(ObsidianDark)
                .padding(12.dp)
                .drawBehind {
                    drawLine(
                        color = CyberCyan.copy(alpha = 0.2f),
                        start = Offset(0f, 0f),
                        end = Offset(size.width, 0f),
                        strokeWidth = 2f
                    )
                }
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = inputPrompt,
                    onValueChange = { inputPrompt = it },
                    placeholder = {
                        Text(
                            "root@alfred-nexus:~# digite seu prompt...",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = GhostText
                        )
                    },
                    modifier = Modifier
                        .weight(1f)
                        .testTag("prompt_input_field"),
                    maxLines = 3,
                    textStyle = TextStyle(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 14.sp,
                        color = PureWhite
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CyberCyan,
                        unfocusedBorderColor = MutedSlate,
                        focusedContainerColor = CyberBlack,
                        unfocusedContainerColor = CyberBlack
                    ),
                    shape = RoundedCornerShape(8.dp)
                )

                Spacer(modifier = Modifier.width(10.dp))

                Button(
                    onClick = {
                        if (inputPrompt.isNotBlank()) {
                            viewModel.runPipeline(inputPrompt)
                            inputPrompt = ""
                        }
                    },
                    modifier = Modifier
                        .height(54.dp)
                        .testTag("pipeline_run_button"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CyberCyan,
                        contentColor = CyberBlack
                    ),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !isRunning
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Enviar",
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun PipelineRunningIndicator() {
    val infiniteTransition = rememberInfiniteTransition(label = "terminalLoader")
    val dotCount by infiniteTransition.animateValue(
        initialValue = 1,
        targetValue = 4,
        typeConverter = Int.VectorConverter,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ), label = "dots"
    )

    val dots = ".".repeat(dotCount)

    // Simulating sequence string
    val currentWorkingStep = remember { mutableStateOf("Supervisor (Planejando)") }
    LaunchedEffect(Unit) {
        val steps = listOf(
            "Supervisor (Iniciando Grafo LangGraph)...",
            "Researcher (Buscando base ChromaDB local)...",
            "Coder (Escrevendo arquivos de script Python)...",
            "Critic (Compilando código no Executor Sandbox)...",
            "Memory (Aprimorando regras com SQLite)..."
        )
        var count = 0
        while (true) {
            currentWorkingStep.value = steps[count % steps.size]
            kotlinx.coroutines.delay(2000)
            count++
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier.size(90.dp),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(
                color = CyberCyan,
                strokeWidth = 3.dp,
                modifier = Modifier.fillMaxSize()
            )
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = "Looping",
                tint = CyberCyan,
                modifier = Modifier.size(36.dp)
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "ALFRED PIPELINE ATIVO",
            fontFamily = FontFamily.Monospace,
            color = CyberCyan,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "${currentWorkingStep.value}$dots",
            fontFamily = FontFamily.Monospace,
            color = PureWhite,
            fontSize = 13.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Utilizando modelos locais quantizados sem internet. Orquestração baseada em rotas condicionais e loops de auto-correção automática.",
            fontSize = 11.sp,
            color = GhostText,
            textAlign = TextAlign.Center,
            lineHeight = 16.sp,
            modifier = Modifier.widthIn(max = 300.dp)
        )
    }
}

@Composable
fun InteractiveAgentGraph(logs: List<AgentRunLog>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
        colors = CardDefaults.cardColors(containerColor = ObsidianDark),
        border = BorderStroke(1.dp, MutedSlate)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                "ROTEAMENTO DO GRAFO MULTI-AGENTE (LangGraph)",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = CyberCyan,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Row of agent circles nodes
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val nodesList = listOf(
                    Pair("Supervisor", "SPV"),
                    Pair("Researcher", "RSC"),
                    Pair("Coder", "CDR"),
                    Pair("Critic", "CTC"),
                    Pair("Memory", "MMR")
                )

                nodesList.forEachIndexed { idx, (agentFull, badge) ->
                    val hasRundLog = logs.any { it.agentName.equals(agentFull, ignoreCase = true) }
                    val borderAccent = if (hasRundLog) ActiveGreen else GhostText.copy(alpha = 0.2f)
                    val bgAlphaColor = if (hasRundLog) ActiveGreen.copy(alpha = 0.15f) else Color.Transparent

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(bgAlphaColor)
                                .border(1.dp, borderAccent, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = badge,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (hasRundLog) PureWhite else GhostText.copy(alpha = 0.3f)
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = agentFull,
                            fontSize = 8.sp,
                            fontFamily = FontFamily.Monospace,
                            color = if (hasRundLog) PureWhite else GhostText.copy(alpha = 0.3f)
                        )
                    }

                    if (idx < nodesList.size - 1) {
                        // arrow visual divider
                        Text(
                            text = "→",
                            color = if (hasRundLog) ActiveGreen else GhostText.copy(alpha = 0.2f),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            modifier = Modifier.align(Alignment.CenterVertically)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AgentLogCard(log: AgentRunLog) {
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current

    val (accentColor, agentTitleLong) = when (log.agentName) {
        "Supervisor" -> Pair(CyberCyan, "Supervisor Orquestrador")
        "Researcher" -> Pair(SmoothTeal, "Researcher (Vector DB Client)")
        "Coder" -> Pair(CyberCyan, "Coder (Claude Code Synthesizer)")
        "Critic" -> Pair(DangerRed, "Critic / Verifier Sandbox")
        "Memory" -> Pair(ActiveGreen, "Memory Agent (Self-Improving)")
        else -> Pair(PureWhite, "Alfred Agent Node")
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("agent_card_${log.agentName}"),
        colors = CardDefaults.cardColors(containerColor = ObsidianDark),
        border = BorderStroke(1.dp, MutedSlate)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header node info
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(accentColor)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = agentTitleLong.uppercase(),
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = accentColor
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(accentColor.copy(alpha = 0.1f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = log.status,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = accentColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Reason/Thought
            Text(
                text = "COGNITION:",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = GhostText
            )
            Text(
                text = log.thought,
                fontSize = 13.sp,
                color = PureWhite,
                lineHeight = 18.sp,
                modifier = Modifier.padding(top = 2.dp)
            )

            log.result?.let { output ->
                if (output.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "OUTPUT LOGS & ARTIFACTS:",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = GhostText
                    )

                    val isSourceCode = output.trim().startsWith("import") || output.contains("def ") || output.contains("class ") || output.contains("app =")
                    
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(CyberBlack)
                            .border(1.dp, MutedSlate, RoundedCornerShape(6.dp))
                            .padding(10.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (isSourceCode) "python_sandbox.py" else "terminal_out.log",
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    color = if (isSourceCode) CyberCyan else ActiveGreen
                                )
                                Icon(
                                    imageVector = Icons.Default.Share,
                                    contentDescription = "Copiar",
                                    tint = CyberCyan,
                                    modifier = Modifier
                                        .size(16.dp)
                                        .clickable {
                                            clipboardManager.setText(AnnotatedString(output))
                                            Toast.makeText(context, "Código copiado para o clipboard!", Toast.LENGTH_SHORT).show()
                                        }
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = output,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 12.sp,
                                color = if (isSourceCode) PureWhite else ActiveGreen,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

// --- 2. CODE HUB TAB (PROJECT EXPORTER) ---

@Composable
fun CodeHubTab() {
    var selectedFile by remember { mutableStateOf("agents.py") }
    val codeContent = remember(selectedFile) { PythonCodeTemplates.getFileContent(selectedFile) }
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Explanatory title
        Text(
            text = "ALFRED NEXUS PYTHON EXPORTER",
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            color = CyberCyan,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Explore a estrutura de arquivos completa e modular do Alfred Nexus. Copie e execute de forma 100% gratuita na sua máquina.",
            fontSize = 12.sp,
            color = GhostText,
            lineHeight = 16.sp,
            modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
        )

        // Horizontal view of files structure
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(PythonCodeTemplates.filesList) { folderFile ->
                val isSelected = folderFile == selectedFile
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (isSelected) CyberCyan else SlateGrey)
                        .clickable { selectedFile = folderFile }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                        .testTag("file_tab_${folderFile.replace(".", "_")}")
                ) {
                    Text(
                        text = folderFile,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isSelected) CyberBlack else PureWhite
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Large Code Panel Terminal
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(CyberBlack)
                .border(1.dp, CyberCyan.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                .padding(12.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "VIRTUAL_REPOSITORY/${selectedFile}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberCyan
                    )
                    Button(
                        onClick = {
                            clipboardManager.setText(AnnotatedString(codeContent))
                            Toast.makeText(context, "$selectedFile copiado para área de transferência!", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = CyberCyan.copy(alpha = 0.15f),
                            contentColor = CyberCyan
                        ),
                        border = BorderStroke(1.dp, CyberCyan),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.height(30.dp).testTag("copy_file_button")
                    ) {
                        Text("Copiar Arquivo", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = codeContent,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = PureWhite,
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }
}

// --- 3. RAG DOCUMENTS TAB ---

@Composable
fun RagDocsTab(viewModel: AlfredViewModel) {
    val documents by viewModel.allRagDocs.collectAsState()

    var docTitle by remember { mutableStateOf("") }
    var docContent by remember { mutableStateOf("") }
    var showAddDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "BASE DE CONHECIMENTO VETORIAL RAG",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = CyberCyan,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Cadastre manuais e artigos locais para os agentes consultarem.",
                    fontSize = 12.sp,
                    color = GhostText
                )
            }

            IconButton(
                onClick = { showAddDialog = true },
                modifier = Modifier
                    .clip(CircleShape)
                    .background(CyberCyan)
                    .testTag("add_rag_doc_button")
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Adicionar Doc",
                    tint = CyberBlack
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (documents.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = GhostText,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "ChromaDB local sem registros",
                        color = PureWhite,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "Cadastre documentos de teste no botão '+' para dar aos agentes inteligência semântica contextual.",
                        textAlign = TextAlign.Center,
                        fontSize = 11.sp,
                        color = GhostText,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(documents) { doc ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = ObsidianDark),
                        border = BorderStroke(1.dp, MutedSlate)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Info,
                                        contentDescription = "Doc",
                                        tint = SmoothTeal,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = doc.fileName,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PureWhite
                                    )
                                }
                                IconButton(
                                    onClick = { viewModel.deleteRagDoc(doc.id) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Excluir",
                                        tint = DangerRed.copy(alpha = 0.8f),
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = doc.content,
                                fontSize = 11.sp,
                                color = GhostText,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Embeddings: sentence-transformers",
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = SmoothTeal
                                )
                                Text(
                                    text = "${doc.sizeBytes} Bytes",
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = GhostText
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = {
                Text(
                    "Cadastrar Guia de Contexto",
                    fontFamily = FontFamily.Monospace,
                    color = CyberCyan,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column {
                    OutlinedTextField(
                        value = docTitle,
                        onValueChange = { docTitle = it },
                        label = { Text("Nome do PDF / Manual", color = GhostText) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("rag_input_title"),
                        textStyle = TextStyle(color = PureWhite),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = MutedSlate
                        )
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = docContent,
                        onValueChange = { docContent = it },
                        label = { Text("Artigo Técnico / Detalhes Contexto", color = GhostText) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .testTag("rag_input_body"),
                        textStyle = TextStyle(color = PureWhite),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = MutedSlate
                        )
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    // Autofill presets
                    Text(
                        "Autocompletar templates rápidos:",
                        fontSize = 10.sp,
                        color = GhostText,
                        fontFamily = FontFamily.Monospace
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Button(
                            onClick = {
                                docTitle = "langgraph_state_router.txt"
                                docContent = "O Alfred Nexus LangGraph gerencia rotas estáticas e condicionais. Para loops de auto-aprimoramento o Coder Agent retorna de forma síncrona ao Sandbox se o Critic retornar feedback falho."
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = SlateGrey),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("LangGraph Router", fontSize = 9.sp, color = PureWhite)
                        }
                        Button(
                            onClick = {
                                docTitle = "fastapi_logging.txt"
                                docContent = "Logfire da FastAPI deve ser inicializado estritamente no root_module invocando logfire.configure(). Todos os roteadores agregados herdam o escopo seguro."
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = SlateGrey),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("FastAPI Logs", fontSize = 9.sp, color = PureWhite)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (docTitle.isNotBlank() && docContent.isNotBlank()) {
                            viewModel.addRagDoc(docTitle, docContent)
                            docTitle = ""
                            docContent = ""
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CyberCyan, contentColor = CyberBlack)
                ) {
                    Text("Indexar", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancelar", color = PureWhite)
                }
            },
            containerColor = ObsidianDark,
            titleContentColor = CyberCyan,
            textContentColor = PureWhite
        )
    }
}

// --- 4. VOICE TAB ---

@Composable
fun VoiceTab(viewModel: AlfredViewModel, speak: (String) -> Unit) {
    val context = LocalContext.current
    val prompts by viewModel.allPrompts.collectAsState()
    val isRunning by viewModel.isPipelineRunning.collectAsState()
    val checkLogs by viewModel.currentLogs.collectAsState()
    val currentPromptId by viewModel.currentPromptId.collectAsState()

    var spokenText by remember { mutableStateOf("") }
    var voiceStatusText by remember { mutableStateOf("Tap para iniciar comando por voz") }
    var isListening by remember { mutableStateOf(false) }
    var lastVocalizedPromptId by remember { mutableStateOf<Int?>(null) }

    // Wave animations
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val waveScale1 by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "wave1"
    )
    val waveScale2 by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "wave2"
    )

    // Speech-To-Text result handler
    val speechLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
        onResult = { result ->
            isListening = false
            val data = result.data
            val results = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            if (!results.isNullOrEmpty()) {
                val command = results[0]
                spokenText = command
                voiceStatusText = "Processando comando..."
                viewModel.runPipeline(command)
            } else {
                voiceStatusText = "Não entendi. Toque e fale novamente."
            }
        }
    )

    // Playback Voice Response whenever pipeline finishes
    LaunchedEffect(isRunning, checkLogs, currentPromptId) {
        if (!isRunning && checkLogs.isNotEmpty() && currentPromptId != null) {
            if (currentPromptId != lastVocalizedPromptId) {
                val supervisorLog = checkLogs.firstOrNull { it.agentName == "Supervisor" }
                val ttsResponse = supervisorLog?.result ?: "Simulação dos agentes Alfred Nexus concluída com sucesso."
                speak(ttsResponse)
                voiceStatusText = "Comando processado. Resposta vocalizada!"
                lastVocalizedPromptId = currentPromptId
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "MODO VOZ INTELECTUAL (Siri-like)",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = CyberCyan,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Controle o Alfred Nexus por comando de voz nativo e ouça os planos do supervisor em português.",
                fontSize = 12.sp,
                color = GhostText,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 2.dp)
            )
        }

        // Animated Central Pulse Wave Core
        Box(
            modifier = Modifier.size(240.dp),
            contentAlignment = Alignment.Center
        ) {
            if (isListening || isRunning) {
                // Wave pulsing layers
                Box(
                    modifier = Modifier
                        .size(130.dp)
                        .alpha(0.2f)
                        .clip(CircleShape)
                        .background(CyberCyan)
                        .drawBehind {
                            drawCircle(color = CyberCyan, alpha = 0.5f, radius = size.minDimension / 2 * waveScale1)
                        }
                )
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .alpha(0.3f)
                        .clip(CircleShape)
                        .background(SmoothTeal)
                        .drawBehind {
                            drawCircle(color = SmoothTeal, alpha = 0.4f, radius = size.minDimension / 2 * waveScale2)
                        }
                )
            }

            // Central Interactive Sphere
            Box(
                modifier = Modifier
                    .size(90.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(CyberCyan, ObsidianDark)
                        )
                    )
                    .border(
                        BorderStroke(
                            2.dp,
                            if (isListening) ActiveGreen else CyberCyan
                        ),
                        CircleShape
                    )
                    .clickable {
                        try {
                            isListening = true
                            voiceStatusText = "Ouvindo terminal..."
                            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(
                                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                                )
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                                putExtra(RecognizerIntent.EXTRA_PROMPT, "Por favor, diga seu comando...")
                            }
                            speechLauncher.launch(intent)
                        } catch (e: Exception) {
                            isListening = false
                            voiceStatusText = "Recurso indisponível neste emulador."
                            Toast.makeText(
                                context,
                                "Google Speech recognition não suportado neste dispositivo.",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                    .testTag("voice_trigger_button"),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Microfone",
                    tint = if (isListening) ActiveGreen else CyberCyan,
                    modifier = Modifier.size(36.dp)
                )
            }
        }

        // Voice logs console
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(ObsidianDark)
                .border(1.dp, MutedSlate, RoundedCornerShape(8.dp))
                .padding(14.dp)
        ) {
            Text(
                text = "ALFRED_SYS STATUS:",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = CyberCyan,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = voiceStatusText,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                color = PureWhite,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
            )

            if (spokenText.isNotEmpty()) {
                Divider(color = MutedSlate, modifier = Modifier.padding(vertical = 4.dp))
                Text(
                    text = "TEXTO RECONHECIDO:",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    color = GhostText
                )
                Text(
                    text = "\"$spokenText\"",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    color = SmoothTeal,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
    }
}

// --- 5. SETTINGS & SELF-REFLECTION TAB ---

@Composable
fun SettingsTab(viewModel: AlfredViewModel) {
    val reflections by viewModel.allReflections.collectAsState()
    val isOptimizing by viewModel.isOptimizing.collectAsState()
    val prompts by viewModel.allPrompts.collectAsState()

    val localModel by viewModel.selectedModel.collectAsState()
    val localQuant by viewModel.quantizationMode.collectAsState()
    val vectorStore by viewModel.vectorStoreType.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Quantization Configurations Card
        Text(
            text = "AGENTIC CONFIGURATIONS (Ollama Settings)",
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            color = CyberCyan,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = ObsidianDark),
            border = BorderStroke(1.dp, MutedSlate)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                // Models Row Dropdown Simulation
                Text("Chief Agent LLM Local", fontSize = 11.sp, color = GhostText, fontFamily = FontFamily.Monospace)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(CyberBlack)
                        .border(1.dp, MutedSlate, RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(localModel, color = PureWhite, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                    Row {
                        Text(
                            "Qwen2.5-Coder (Ativo)",
                            fontSize = 11.sp,
                            color = CyberCyan,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Quantization Simulation Option
                Text("Precisão de Quantização GGUF", fontSize = 11.sp, color = GhostText, fontFamily = FontFamily.Monospace)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(CyberBlack)
                        .border(1.dp, MutedSlate, RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(localQuant, color = PureWhite, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                    Text("Baixo Overhead", fontSize = 11.sp, color = ActiveGreen, fontFamily = FontFamily.Monospace)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Vector store dropdown simulation
                Text("Banco de Dados Vetorial", fontSize = 11.sp, color = GhostText, fontFamily = FontFamily.Monospace)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(CyberBlack)
                        .border(1.dp, MutedSlate, RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(vectorStore, color = PureWhite, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                    Text("100% Local", fontSize = 11.sp, color = SmoothTeal, fontFamily = FontFamily.Monospace)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // SELF-REFLECTION LOOP ENGiNE SECtion
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "LOOP DE AUTO-OTIMIZAÇÃO (Hermes Self-Reflection)",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = CyberCyan,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Analise o histórico e auto-programe prompts.",
                    fontSize = 11.sp,
                    color = GhostText
                )
            }

            Button(
                onClick = { viewModel.optimizeAgents() },
                modifier = Modifier.height(36.dp).testTag("optimize_loop_button"),
                colors = ButtonDefaults.buttonColors(containerColor = CyberCyan, contentColor = CyberBlack),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 2.dp),
                enabled = !isOptimizing && prompts.isNotEmpty()
            ) {
                if (isOptimizing) {
                    CircularProgressIndicator(color = CyberBlack, strokeWidth = 1.5.dp, modifier = Modifier.size(16.dp))
                } else {
                    Text("Raciocinar", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (reflections.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ObsidianDark)
                    .border(1.dp, MutedSlate, RoundedCornerShape(8.dp))
                    .padding(12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Ainda sem otimizações. Execute prompts ou clique em 'Raciocinar' para analisar correções cognitivas baseadas no histórico de comandos.",
                    fontSize = 11.sp,
                    color = GhostText,
                    textAlign = TextAlign.Center,
                    lineHeight = 16.sp
                )
            }
        } else {
            // Render reflections list
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                reflections.forEach { log ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = ObsidianDark),
                        border = BorderStroke(1.dp, CyberCyan.copy(alpha = 0.3f))
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Info,
                                        contentDescription = "Check",
                                        tint = ActiveGreen,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "REGRA AUTO-GERADA",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = ActiveGreen
                                    )
                                }
                                Text(
                                    text = "Runs: ${log.agentRunsEvaluated}",
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = GhostText
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "ANÁLISE COGNITIVA: " + log.insight,
                                fontSize = 11.sp,
                                color = PureWhite,
                                lineHeight = 16.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(CyberBlack)
                                    .padding(8.dp)
                            ) {
                                Text(
                                    text = "REGRA ATIVA NO SUPERVISOR: " + log.optimizedRule,
                                    fontSize = 11.sp,
                                    color = CyberCyan,
                                    lineHeight = 16.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Reset workspace configurations
        OutlinedButton(
            onClick = { viewModel.clearAllData() },
            border = BorderStroke(1.dp, DangerRed),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = DangerRed),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp)
                .testTag("reset_workspace_button")
        ) {
            Text(
                "LIMPAR LOGS E HISTÓRICO",
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
        }
    }
}
