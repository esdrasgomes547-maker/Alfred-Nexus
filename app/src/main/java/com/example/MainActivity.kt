package com.example

import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.viewmodel.AlfredState
import com.example.viewmodel.AlfredViewModel
import com.example.viewmodel.ChatMessage
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

class MainActivity : ComponentActivity(), TextToSpeech.OnInitListener {

    private val viewModel: AlfredViewModel by viewModels()
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        tts = TextToSpeech(this, this)
        setContent {
            MyApplicationTheme {
                AlfredApp(viewModel = viewModel, speak = ::speak)
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val r = tts?.setLanguage(Locale("pt", "BR"))
            ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED
        }
    }

    private fun speak(text: String) {
        if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "alfred_utterance")
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

@Composable
fun AlfredApp(viewModel: AlfredViewModel, speak: (String) -> Unit) {
    val messages    by viewModel.messages.collectAsState()
    val alfredState by viewModel.alfredState.collectAsState()
    val listState    = rememberLazyListState()
    var inputText   by remember { mutableStateOf("") }
    val context      = LocalContext.current

    // Read last Alfred response aloud once it finishes streaming
    LaunchedEffect(messages) {
        val last = messages.lastOrNull()
        if (last != null && last.role == "assistant" && !last.isStreaming && last.content.isNotEmpty()) {
            speak(last.content)
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    val speechLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
        onResult = { result ->
            result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
                ?.let { viewModel.send(it) }
        }
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PianoBlack)
            .systemBarsPadding()
            .imePadding()
    ) {
        // ── Top bar ────────────────────────────────────────────────────────
        AlfredTopBar(state = alfredState, onClear = viewModel::clearHistory)

        // ── Medallion ──────────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 18.dp, bottom = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AlfredCoreView(state = alfredState, modifier = Modifier.size(180.dp))
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = when (alfredState) {
                    AlfredState.IDLE       -> "AGUARDANDO, SENHOR"
                    AlfredState.PONDERING  -> "PONDERANDO"
                    AlfredState.RESPONDING -> "A SEU SERVIÇO"
                },
                fontFamily    = FontFamily.Monospace,
                fontWeight    = FontWeight.Normal,
                fontSize      = 9.sp,
                letterSpacing = 0.30.sp,
                color         = when (alfredState) {
                    AlfredState.IDLE       -> PlatinumGray
                    AlfredState.PONDERING  -> GoldDim
                    AlfredState.RESPONDING -> GoldAccent
                }
            )
        }

        // Gold separator line
        GoldRule()

        // ── Chat ───────────────────────────────────────────────────────────
        if (messages.isEmpty()) {
            EmptyState(modifier = Modifier.weight(1f).fillMaxWidth())
        } else {
            LazyColumn(
                state           = listState,
                modifier        = Modifier.weight(1f).fillMaxWidth(),
                contentPadding  = PaddingValues(horizontal = 16.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(messages, key = { it.id }) { msg -> ChatBubble(msg) }
            }
        }

        // Gold separator line
        GoldRule()

        // ── Input ──────────────────────────────────────────────────────────
        LuxuryInputBar(
            text        = inputText,
            onTextChange = { inputText = it },
            enabled     = alfredState == AlfredState.IDLE,
            onSend      = {
                if (inputText.isNotBlank()) {
                    viewModel.send(inputText)
                    inputText = ""
                }
            },
            onMic = {
                try {
                    speechLauncher.launch(
                        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                            putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale sua ordem...")
                        }
                    )
                } catch (e: Exception) {
                    Toast.makeText(context, "STT indisponível", Toast.LENGTH_SHORT).show()
                }
            }
        )
    }
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

@Composable
fun AlfredTopBar(state: AlfredState, onClear: () -> Unit) {
    // Animate the state dot
    val inf = rememberInfiniteTransition(label = "statusDot")
    val dotAlpha by inf.animateFloat(
        initialValue  = 0.5f,
        targetValue   = 1.0f,
        animationSpec = infiniteRepeatable(
            animation  = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "dotAlpha"
    )
    val dotColor = when (state) {
        AlfredState.IDLE       -> PlatinumGray.copy(alpha = dotAlpha)
        AlfredState.PONDERING  -> GoldAccent.copy(alpha = dotAlpha)
        AlfredState.RESPONDING -> GoldBright.copy(alpha = 1f)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(EbonyDeep)
            .drawBehind {
                // Fine gold rule at the bottom
                drawLine(
                    color       = GoldDim,
                    start       = Offset(0f, size.height),
                    end         = Offset(size.width, size.height),
                    strokeWidth = 0.5f
                )
            }
            .padding(horizontal = 20.dp, vertical = 16.dp)
    ) {
        // Left: status dot + title
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier          = Modifier.align(Alignment.CenterStart)
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Spacer(modifier = Modifier.width(14.dp))
            Column {
                Text(
                    text          = "ALFRED",
                    fontFamily    = FontFamily.Monospace,
                    fontWeight    = FontWeight.Bold,
                    fontSize      = 16.sp,
                    letterSpacing = 0.60.sp,
                    color         = GoldAccent,
                )
                Text(
                    text          = "MORDOMO  DIGITAL",
                    fontFamily    = FontFamily.Monospace,
                    fontWeight    = FontWeight.Normal,
                    fontSize      = 8.sp,
                    letterSpacing = 0.35.sp,
                    color         = PlatinumGray,
                )
            }
        }

        // Right: clear button
        Icon(
            imageVector        = Icons.Default.Delete,
            contentDescription = "Limpar",
            tint               = EbonyBorder,
            modifier           = Modifier
                .align(Alignment.CenterEnd)
                .size(18.dp)
                .clickable(onClick = onClear)
        )
    }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

@Composable
fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier             = modifier,
        horizontalAlignment  = Alignment.CenterHorizontally,
        verticalArrangement  = Arrangement.Center
    ) {
        Text(
            text          = "A",
            fontFamily    = FontFamily.Monospace,
            fontWeight    = FontWeight.Bold,
            fontSize      = 48.sp,
            letterSpacing = 0.sp,
            color         = GoldDim,
        )
        Spacer(modifier = Modifier.height(2.dp))
        // Fine horizontal rule
        Box(
            modifier = Modifier
                .width(40.dp)
                .height(1.dp)
                .background(
                    Brush.horizontalGradient(listOf(Color.Transparent, GoldDim, Color.Transparent))
                )
        )
        Spacer(modifier = Modifier.height(18.dp))
        Text(
            text          = "ALFRED",
            fontFamily    = FontFamily.Monospace,
            fontWeight    = FontWeight.Bold,
            fontSize      = 20.sp,
            letterSpacing = 1.0.sp,
            color         = IvoryWhite,
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text          = "Aqui começa a história do senhor.",
            fontFamily    = FontFamily.Monospace,
            fontSize      = 11.sp,
            letterSpacing = 0.05.sp,
            color         = PlatinumGray,
            textAlign     = TextAlign.Center,
        )
    }
}

// ---------------------------------------------------------------------------
// Gold rule separator
// ---------------------------------------------------------------------------

@Composable
fun GoldRule() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(
                Brush.horizontalGradient(
                    listOf(PianoBlack, GoldDim.copy(alpha = 0.7f), GoldDim.copy(alpha = 0.7f), PianoBlack)
                )
            )
    )
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

@Composable
fun ChatBubble(message: ChatMessage) {
    val isUser = message.role == "user"

    Row(
        modifier              = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            // Alfred avatar — small gold initial disc
            Box(
                modifier = Modifier
                    .padding(end = 10.dp, top = 2.dp)
                    .size(26.dp)
                    .clip(CircleShape)
                    .background(EbonyDeep)
                    .border(0.5.dp, GoldDim, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text          = "A",
                    fontFamily    = FontFamily.Monospace,
                    fontWeight    = FontWeight.Bold,
                    fontSize      = 10.sp,
                    letterSpacing = 0.sp,
                    color         = GoldAccent,
                )
            }
        }

        if (isUser) {
            // User bubble: ivory/cream paper — maximum contrast
            Box(
                modifier = Modifier
                    .widthIn(max = 268.dp)
                    .clip(
                        RoundedCornerShape(topStart = 12.dp, topEnd = 2.dp, bottomStart = 12.dp, bottomEnd = 12.dp)
                    )
                    .background(IvoryCream)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text(
                    text       = message.content,
                    fontFamily = FontFamily.Monospace,
                    fontSize   = 14.sp,
                    lineHeight = 21.sp,
                    color      = EbonyDeep,
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
        } else {
            // Alfred bubble: black lacquer with gold left stripe
            Row(modifier = Modifier.widthIn(max = 268.dp)) {
                // Gold left accent
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(topStart = 2.dp, bottomStart = 2.dp))
                        .background(
                            Brush.verticalGradient(listOf(GoldDim, GoldAccent, GoldDim))
                        )
                        .align(Alignment.Top)
                )
                Box(
                    modifier = Modifier
                        .clip(
                            RoundedCornerShape(topStart = 0.dp, topEnd = 12.dp, bottomStart = 0.dp, bottomEnd = 12.dp)
                        )
                        .background(EbonyDeep)
                        .border(
                            0.5.dp,
                            GoldGhost,
                            RoundedCornerShape(topStart = 0.dp, topEnd = 12.dp, bottomStart = 0.dp, bottomEnd = 12.dp)
                        )
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    if (message.isStreaming && message.content.isEmpty()) {
                        // Typing indicator — three pulsing gold dots
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment     = Alignment.CenterVertically,
                            modifier              = Modifier.padding(vertical = 6.dp)
                        ) {
                            repeat(3) { idx ->
                                val i = rememberInfiniteTransition(label = "d$idx")
                                val a by i.animateFloat(
                                    initialValue  = 0.15f, targetValue = 0.85f,
                                    animationSpec = infiniteRepeatable(
                                        tween(500, delayMillis = idx * 160),
                                        RepeatMode.Reverse
                                    ), label = "da$idx"
                                )
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(GoldAccent.copy(alpha = a))
                                )
                            }
                        }
                    } else {
                        Column {
                            Text(
                                text       = message.content,
                                fontFamily = FontFamily.Monospace,
                                fontSize   = 14.sp,
                                lineHeight = 21.sp,
                                color      = IvoryWhite,
                            )
                            if (message.isStreaming) {
                                val i = rememberInfiniteTransition(label = "cursor")
                                val v by i.animateFloat(
                                    initialValue = 0f, targetValue = 1f,
                                    animationSpec = infiniteRepeatable(tween(480), RepeatMode.Reverse),
                                    label = "cv"
                                )
                                Text("▋", fontFamily = FontFamily.Monospace,
                                    fontSize = 14.sp, color = GoldAccent.copy(alpha = v))
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Luxury input bar — single underline, no box
// ---------------------------------------------------------------------------

@Composable
fun LuxuryInputBar(
    text: String,
    onTextChange: (String) -> Unit,
    enabled: Boolean,
    onSend: () -> Unit,
    onMic: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(EbonyDeep)
            .padding(start = 20.dp, end = 16.dp, top = 12.dp, bottom = 12.dp)
            .navigationBarsPadding(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TextField(
            value         = text,
            onValueChange = onTextChange,
            modifier      = Modifier.weight(1f),
            placeholder   = {
                Text(
                    "Diga sua ordem, senhor...",
                    fontFamily = FontFamily.Monospace,
                    fontSize   = 13.sp,
                    color      = GhostIvory,
                )
            },
            textStyle = TextStyle(
                fontFamily    = FontFamily.Monospace,
                fontSize      = 14.sp,
                color         = IvoryWhite,
                letterSpacing = 0.05.sp,
            ),
            colors = TextFieldDefaults.colors(
                focusedContainerColor    = Color.Transparent,
                unfocusedContainerColor  = Color.Transparent,
                disabledContainerColor   = Color.Transparent,
                focusedIndicatorColor    = GoldAccent,
                unfocusedIndicatorColor  = EbonyBorder,
                disabledIndicatorColor   = EbonyBorder.copy(alpha = 0.4f),
                cursorColor              = GoldAccent,
                focusedTextColor         = IvoryWhite,
                unfocusedTextColor       = IvoryWhite,
                disabledTextColor        = IvoryWhite.copy(alpha = 0.3f),
                focusedPlaceholderColor  = GhostIvory,
                unfocusedPlaceholderColor = GhostIvory,
            ),
            maxLines        = 4,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (enabled) onSend() }),
            enabled         = enabled,
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Mic — subtle
        Icon(
            imageVector        = Icons.Default.Mic,
            contentDescription = "Voz",
            tint               = PlatinumGray.copy(alpha = if (enabled) 0.7f else 0.25f),
            modifier           = Modifier
                .size(22.dp)
                .clickable(enabled = enabled, onClick = onMic)
        )

        Spacer(modifier = Modifier.width(16.dp))

        // Send — gold when active, dim when not
        val sendEnabled = text.isNotBlank() && enabled
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(if (sendEnabled) GoldAccent else EbonySurface)
                .clickable(enabled = sendEnabled, onClick = onSend),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector        = Icons.Default.Send,
                contentDescription = "Enviar",
                tint               = if (sendEnabled) PianoBlack else EbonyBorder,
                modifier           = Modifier.size(18.dp)
            )
        }
    }
}

// ---------------------------------------------------------------------------
// AlfredCoreView — Piano Black + White Luxury watch-inspired medallion
// ---------------------------------------------------------------------------

@Composable
fun AlfredCoreView(state: AlfredState, modifier: Modifier = Modifier) {
    val inf = rememberInfiniteTransition(label = "core")

    // Speed tiers per state
    val outerMs  = when (state) { AlfredState.IDLE -> 28000; AlfredState.PONDERING -> 9000;  AlfredState.RESPONDING -> 5000 }
    val innerMs  = when (state) { AlfredState.IDLE -> 42000; AlfredState.PONDERING -> 14000; AlfredState.RESPONDING -> 7500 }
    val breathMs = when (state) { AlfredState.IDLE -> 5000;  AlfredState.PONDERING -> 1400;  AlfredState.RESPONDING -> 850  }

    val outerAngle by inf.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(outerMs, easing = LinearEasing)), label = "oa"
    )
    val innerAngle by inf.animateFloat(
        initialValue = 360f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(innerMs, easing = LinearEasing)), label = "ia"
    )
    val breathe by inf.animateFloat(
        initialValue = 0.96f, targetValue = 1.05f,
        animationSpec = infiniteRepeatable(tween(breathMs, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "br"
    )
    val rippleR by inf.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Restart),
        label = "rp"
    )
    // Shimmer sweep on outermost ring (gives lacquer gloss feel)
    val shimmerAngle by inf.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(8000, easing = LinearEasing)), label = "sh"
    )

    // Colour palette (inline to avoid recomposition cost)
    val white   = Color(0xFFFFFFFF)
    val ivory   = Color(0xFFF2EDE4)
    val gold    = Color(0xFFC8A951)
    val goldBrt = Color(0xFFE0C068)
    val goldDm  = Color(0xFF8A7030)
    val black   = Color(0xFF060606)

    Canvas(modifier = modifier) {
        val cx = size.width  / 2f
        val cy = size.height / 2f
        val c  = Offset(cx, cy)

        // Radii
        val R0 = size.minDimension / 2f * 0.90f   // outermost track
        val R1 = R0 * 0.76f                         // intermediate ring
        val R2 = R0 * 0.58f                         // gold ring
        val R3 = R0 * 0.38f                         // core ring
        val R4 = R0 * 0.09f                         // jewel

        // ── Gold ripples (RESPONDING) ───────────────────────────────────
        if (state == AlfredState.RESPONDING) {
            for (i in 0..2) {
                val phase = (rippleR + i * 0.33f) % 1f
                val radius = R3 + (R0 - R3) * phase
                drawCircle(
                    color  = gold.copy(alpha = (1f - phase) * 0.35f),
                    radius = radius,
                    center = c,
                    style  = Stroke(width = 1f)
                )
            }
        }

        // ── Outermost tick ring (rotates clockwise) ─────────────────────
        rotate(outerAngle, c) {
            for (i in 0 until 60) {
                val rad      = ((i * 6f) - 90f) * (Math.PI / 180.0).toFloat()
                val is5th    = i % 5  == 0
                val is15th   = i % 15 == 0
                val tickLen  = R0 * if (is15th) 0.09f else if (is5th) 0.06f else 0.025f
                val alpha    = if (is15th) 0.85f else if (is5th) 0.55f else 0.22f
                val thick    = if (is15th) 2f else 1f
                drawLine(
                    color       = white.copy(alpha = alpha),
                    start       = Offset(cx + cos(rad) * (R0 - tickLen), cy + sin(rad) * (R0 - tickLen)),
                    end         = Offset(cx + cos(rad) * R0,              cy + sin(rad) * R0),
                    strokeWidth = thick,
                )
            }
        }

        // Outer ring circle
        drawCircle(color = white.copy(alpha = 0.35f), radius = R0, center = c, style = Stroke(width = 0.5f))

        // Lacquer gloss shimmer arc — rotates independently
        rotate(shimmerAngle, c) {
            drawArc(
                color      = white.copy(alpha = 0.20f),
                startAngle = -100f,
                sweepAngle = 70f,
                useCenter  = false,
                topLeft    = Offset(cx - R0, cy - R0),
                size       = Size(R0 * 2, R0 * 2),
                style      = Stroke(width = 1.5f)
            )
        }

        // ── Intermediate ring ────────────────────────────────────────────
        drawCircle(color = white.copy(alpha = 0.15f), radius = R1, center = c, style = Stroke(width = 0.5f))

        // ── Gold ring (counter-rotates) — Alfred's signature ─────────────
        rotate(innerAngle, c) {
            drawCircle(color = gold.copy(alpha = 0.70f), radius = R2, center = c, style = Stroke(width = 1f))
            // 8 gold notches on the gold ring
            for (i in 0 until 8) {
                val rad  = ((i * 45f) - 90f) * (Math.PI / 180.0).toFloat()
                val half = R0 * 0.032f
                drawLine(
                    color       = gold.copy(alpha = 0.80f),
                    start       = Offset(cx + cos(rad) * (R2 - half), cy + sin(rad) * (R2 - half)),
                    end         = Offset(cx + cos(rad) * (R2 + half), cy + sin(rad) * (R2 + half)),
                    strokeWidth = 1.5f,
                )
            }
        }

        // ── 4 ultra-thin spoke lines (R3 → R2) ──────────────────────────
        for (i in 0 until 4) {
            val rad = ((i * 90f) + 45f - 90f) * (Math.PI / 180.0).toFloat()
            drawLine(
                color       = white.copy(alpha = 0.10f),
                start       = Offset(cx + cos(rad) * R3, cy + sin(rad) * R3),
                end         = Offset(cx + cos(rad) * R2, cy + sin(rad) * R2),
                strokeWidth = 0.5f,
            )
        }

        // ── Core ring (pulsing with breathe) ─────────────────────────────
        val coreRad = R3 * breathe
        drawCircle(
            brush  = Brush.radialGradient(
                colors = listOf(ivory.copy(alpha = 0.18f), ivory.copy(alpha = 0.04f), Color.Transparent),
                center = c, radius = coreRad
            ),
            radius = coreRad, center = c
        )
        drawCircle(color = white.copy(alpha = 0.40f), radius = coreRad, center = c, style = Stroke(width = 0.8f))

        // ── Centre jewel ─────────────────────────────────────────────────
        val jewel = R4 * breathe

        // Multi-layer halo
        drawCircle(color = gold.copy(alpha = 0.08f), radius = jewel * 3.5f, center = c)
        drawCircle(color = white.copy(alpha = 0.12f), radius = jewel * 2.2f, center = c)

        // Jewel fill
        drawCircle(
            brush  = Brush.radialGradient(
                colors = listOf(PureWhite, ivory, goldDm.copy(alpha = 0.5f)),
                center = c, radius = jewel
            ),
            radius = jewel, center = c
        )

        // Jewel reflection (tiny bright arc at top-left)
        drawArc(
            color      = white.copy(alpha = 0.60f),
            startAngle = -145f,
            sweepAngle = 55f,
            useCenter  = false,
            topLeft    = Offset(cx - jewel * 0.75f, cy - jewel * 0.75f),
            size       = Size(jewel * 1.5f, jewel * 1.5f),
            style      = Stroke(width = 1.5f)
        )
    }
}
