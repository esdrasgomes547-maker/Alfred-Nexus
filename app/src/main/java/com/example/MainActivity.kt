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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.viewmodel.AlfredState
import com.example.viewmodel.AlfredViewModel
import com.example.viewmodel.ChatMessage
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

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
            val result = tts?.setLanguage(Locale("pt", "BR"))
            ttsReady = result != TextToSpeech.LANG_MISSING_DATA &&
                       result != TextToSpeech.LANG_NOT_SUPPORTED
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
// Root composable
// ---------------------------------------------------------------------------

@Composable
fun AlfredApp(viewModel: AlfredViewModel, speak: (String) -> Unit) {
    val messages     by viewModel.messages.collectAsState()
    val alfredState  by viewModel.alfredState.collectAsState()
    val listState     = rememberLazyListState()
    var inputText    by remember { mutableStateOf("") }
    val context       = LocalContext.current

    // Auto-read last assistant message aloud when it finishes streaming
    LaunchedEffect(messages) {
        val last = messages.lastOrNull()
        if (last != null && last.role == "assistant" && !last.isStreaming && last.content.isNotEmpty()) {
            speak(last.content)
        }
    }

    // Scroll to bottom whenever message list grows
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    val speechLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult(),
        onResult = { result ->
            val results = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            if (!results.isNullOrEmpty()) viewModel.send(results[0])
        }
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AlfredVoid)
            .systemBarsPadding()
            .imePadding()
    ) {
        AlfredTopBar(state = alfredState, onClear = { viewModel.clearHistory() })

        // Medallion section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp, bottom = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AlfredCoreView(state = alfredState, modifier = Modifier.size(156.dp))
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = when (alfredState) {
                    AlfredState.IDLE       -> "Aguardando, senhor."
                    AlfredState.PONDERING  -> "Ponderando..."
                    AlfredState.RESPONDING -> "A seu serviço..."
                },
                fontFamily    = FontFamily.Monospace,
                fontSize      = 11.sp,
                letterSpacing = 0.15.sp,
                color         = AlfredBrassDim,
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        // Separator
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(AlfredSteel))

        // Chat area
        if (messages.isEmpty()) {
            Box(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text          = "ALFRED",
                        fontFamily    = FontFamily.Monospace,
                        fontWeight    = FontWeight.Bold,
                        fontSize      = 26.sp,
                        letterSpacing = 0.6.sp,
                        color         = AlfredBrassDim,
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text       = "Seu mordomo digital",
                        fontFamily = FontFamily.Monospace,
                        fontSize   = 12.sp,
                        color      = AlfredGhost,
                    )
                }
            }
        } else {
            LazyColumn(
                state           = listState,
                modifier        = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp),
                contentPadding  = PaddingValues(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(messages, key = { it.id }) { msg ->
                    ChatBubble(msg)
                }
            }
        }

        // Input bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(AlfredObsidian)
                .drawBehind {
                    drawLine(AlfredBrassDim, Offset(0f, 0f), Offset(size.width, 0f), 1f)
                }
                .padding(horizontal = 12.dp, vertical = 10.dp)
                .navigationBarsPadding(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value         = inputText,
                onValueChange = { inputText = it },
                placeholder   = {
                    Text(
                        "Diga sua ordem, senhor...",
                        fontFamily = FontFamily.Monospace,
                        fontSize   = 13.sp,
                        color      = AlfredGhost
                    )
                },
                modifier  = Modifier.weight(1f),
                maxLines  = 4,
                textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp, color = AlfredText),
                colors    = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor      = AlfredBrass,
                    unfocusedBorderColor    = AlfredSteel,
                    focusedContainerColor   = AlfredPlate,
                    unfocusedContainerColor = AlfredPlate,
                    cursorColor             = AlfredBrass,
                ),
                shape           = RoundedCornerShape(8.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                    if (inputText.isNotBlank()) { viewModel.send(inputText); inputText = "" }
                }),
                enabled = alfredState == AlfredState.IDLE,
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Mic button
            IconButton(
                onClick = {
                    try {
                        speechLauncher.launch(
                            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                                putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale sua ordem...")
                            }
                        )
                    } catch (e: Exception) {
                        Toast.makeText(context, "Reconhecimento de voz indisponível", Toast.LENGTH_SHORT).show()
                    }
                },
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(AlfredPlate)
                    .border(1.dp, AlfredSteel, CircleShape),
            ) {
                Icon(Icons.Default.Mic, contentDescription = "Voz", tint = AlfredBrassDim, modifier = Modifier.size(20.dp))
            }

            Spacer(modifier = Modifier.width(6.dp))

            // Send button
            val sendEnabled = inputText.isNotBlank() && alfredState == AlfredState.IDLE
            IconButton(
                onClick  = { if (sendEnabled) { viewModel.send(inputText); inputText = "" } },
                enabled  = sendEnabled,
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(if (sendEnabled) AlfredBrass else AlfredSteel),
            ) {
                Icon(Icons.Default.Send, contentDescription = "Enviar",
                    tint = if (sendEnabled) AlfredVoid else AlfredGhost, modifier = Modifier.size(20.dp))
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

@Composable
fun AlfredTopBar(state: AlfredState, onClear: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AlfredObsidian)
            .drawBehind {
                drawLine(AlfredBrassDim, Offset(0f, size.height), Offset(size.width, size.height), 1f)
            }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment         = Alignment.CenterVertically,
        horizontalArrangement     = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val dotColor = when (state) {
                AlfredState.IDLE       -> AlfredBrassDim
                AlfredState.PONDERING  -> AlfredBrass
                AlfredState.RESPONDING -> AlfredBrassBright
            }
            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(dotColor))
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text          = "ALFRED",
                    fontFamily    = FontFamily.Monospace,
                    fontWeight    = FontWeight.Bold,
                    fontSize      = 18.sp,
                    letterSpacing = 0.4.sp,
                    color         = AlfredBrass,
                )
                Text(
                    text          = "MORDOMO DIGITAL",
                    fontFamily    = FontFamily.Monospace,
                    fontSize      = 9.sp,
                    letterSpacing = 0.18.sp,
                    color         = AlfredGhost,
                )
            }
        }
        IconButton(onClick = onClear) {
            Icon(Icons.Default.Delete, contentDescription = "Limpar",
                tint = AlfredBrassDim, modifier = Modifier.size(20.dp))
        }
    }
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
            Box(
                modifier = Modifier
                    .padding(end = 8.dp, top = 4.dp)
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(Brush.radialGradient(listOf(AlfredBrassBright, AlfredBrassDim))),
                contentAlignment = Alignment.Center
            ) {
                Text("A", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold,
                    fontSize = 12.sp, color = AlfredVoid)
            }
        }

        val bubbleShape = RoundedCornerShape(
            topStart    = if (isUser) 12.dp else 2.dp,
            topEnd      = if (isUser) 2.dp  else 12.dp,
            bottomStart = 12.dp,
            bottomEnd   = 12.dp
        )

        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(bubbleShape)
                .background(if (isUser) AlfredBrassDim.copy(alpha = 0.28f) else AlfredPlate)
                .border(1.dp, if (isUser) AlfredBrass.copy(alpha = 0.35f) else AlfredSteel, bubbleShape)
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            if (message.isStreaming && message.content.isEmpty()) {
                // Typing indicator — three pulsing dots
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                    repeat(3) { idx ->
                        val inf = rememberInfiniteTransition(label = "dot$idx")
                        val alpha by inf.animateFloat(
                            initialValue  = 0.2f,
                            targetValue   = 1f,
                            animationSpec = infiniteRepeatable(
                                animation  = tween(500, delayMillis = idx * 170),
                                repeatMode = RepeatMode.Reverse
                            ), label = "a$idx"
                        )
                        Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(AlfredBrass.copy(alpha = alpha)))
                    }
                }
            } else {
                Column {
                    Text(
                        text       = message.content,
                        fontFamily = FontFamily.Monospace,
                        fontSize   = 14.sp,
                        lineHeight = 21.sp,
                        color      = AlfredText,
                    )
                    if (message.isStreaming) {
                        val inf = rememberInfiniteTransition(label = "cursor")
                        val vis by inf.animateFloat(
                            initialValue  = 0f, targetValue = 1f,
                            animationSpec = infiniteRepeatable(tween(480), RepeatMode.Reverse),
                            label         = "cursorVis"
                        )
                        Text("▋", fontFamily = FontFamily.Monospace, fontSize = 14.sp,
                            color = AlfredBrass.copy(alpha = vis))
                    }
                }
            }
        }

        if (isUser) Spacer(modifier = Modifier.width(8.dp))
    }
}

// ---------------------------------------------------------------------------
// Brass medallion — the signature AlfredCoreView
// ---------------------------------------------------------------------------

@Composable
fun AlfredCoreView(state: AlfredState, modifier: Modifier = Modifier) {
    val inf = rememberInfiniteTransition(label = "alfredCore")

    val ringMs    = when (state) { AlfredState.IDLE -> 22000; AlfredState.PONDERING -> 7000; AlfredState.RESPONDING -> 5000 }
    val breatheMs = when (state) { AlfredState.IDLE -> 4000;  AlfredState.PONDERING -> 1100; AlfredState.RESPONDING -> 800  }

    val ringAngle by inf.animateFloat(
        initialValue  = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(ringMs, easing = LinearEasing)),
        label         = "ringAngle"
    )
    val innerAngle by inf.animateFloat(
        initialValue  = 360f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween((ringMs * 1.5f).toInt(), easing = LinearEasing)),
        label         = "innerAngle"
    )
    val breathe by inf.animateFloat(
        initialValue  = 0.96f, targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(breatheMs, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label         = "breathe"
    )
    val rippleR by inf.animateFloat(
        initialValue  = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1600, easing = LinearEasing), RepeatMode.Restart),
        label         = "rippleR"
    )

    val brass       = Color(0xFFC09A3C)
    val brassBright = Color(0xFFD4AE52)
    val brassDim    = Color(0xFF8A6E28)

    Canvas(modifier = modifier) {
        val cx     = size.width  / 2f
        val cy     = size.height / 2f
        val outerR = size.minDimension / 2f * 0.88f
        val innerR = outerR * 0.70f
        val coreR  = outerR * 0.44f
        val orbR   = outerR * 0.18f
        val center = Offset(cx, cy)

        // Ripple waves (RESPONDING only)
        if (state == AlfredState.RESPONDING) {
            for (i in 0..1) {
                val phase = (rippleR + i * 0.5f) % 1f
                drawCircle(
                    color  = brass.copy(alpha = (1f - phase) * 0.55f),
                    radius = coreR + (outerR - coreR) * phase,
                    center = center,
                    style  = Stroke(width = 1.5f)
                )
            }
        }

        // Outer tick ring (rotates clockwise)
        rotate(degrees = ringAngle, pivot = center) {
            for (i in 0 until 48) {
                val rad      = ((i * 7.5f) - 90f) * (Math.PI / 180.0).toFloat()
                val isCard   = i % 12 == 0
                val isMajor  = i % 6  == 0
                val tickLen  = outerR * if (isCard) 0.10f else if (isMajor) 0.07f else 0.03f
                val alpha    = if (isCard) 1.0f else if (isMajor) 0.60f else 0.28f
                val thick    = if (isCard) 2.5f else 1.5f
                drawLine(
                    color       = brass.copy(alpha = alpha),
                    start       = Offset(cx + cos(rad) * (outerR - tickLen), cy + sin(rad) * (outerR - tickLen)),
                    end         = Offset(cx + cos(rad) * outerR,             cy + sin(rad) * outerR),
                    strokeWidth = thick,
                )
            }
        }

        // Outer ring border
        drawCircle(color = brass.copy(alpha = 0.72f), radius = outerR, center = center, style = Stroke(width = 1.5f))

        // Inner ring (counter-rotates)
        rotate(degrees = innerAngle, pivot = center) {
            drawCircle(color = brassDim.copy(alpha = 0.50f), radius = innerR, center = center, style = Stroke(width = 1f))
            for (i in 0 until 16) {
                val rad = ((i * 22.5f) - 90f) * (Math.PI / 180.0).toFloat()
                drawLine(
                    color       = brass.copy(alpha = 0.42f),
                    start       = Offset(cx + cos(rad) * (innerR - 5f), cy + sin(rad) * (innerR - 5f)),
                    end         = Offset(cx + cos(rad) * (innerR + 5f), cy + sin(rad) * (innerR + 5f)),
                    strokeWidth = 1.5f,
                )
            }
        }

        // Core glow halo
        drawCircle(
            brush  = Brush.radialGradient(
                colors = listOf(brassBright.copy(alpha = 0.22f), brassDim.copy(alpha = 0.04f), Color.Transparent),
                center = center, radius = coreR * breathe
            ),
            radius = coreR * breathe, center = center
        )
        drawCircle(color = brass.copy(alpha = 0.45f), radius = coreR * breathe, center = center, style = Stroke(width = 1.5f))

        // Center orb
        drawCircle(
            brush  = Brush.radialGradient(
                colors = listOf(brassBright, brass, brassDim),
                center = center, radius = orbR * breathe
            ),
            radius = orbR * breathe, center = center
        )
        // Orb soft halo
        drawCircle(color = brass.copy(alpha = 0.10f), radius = orbR * breathe * 2f, center = center)
    }
}
