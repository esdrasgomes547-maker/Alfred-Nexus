# Alfred — Brief de Build para Android

> Este documento contém TUDO que um agente de IA precisa para construir o cliente Android nativo do Alfred.  
> Leia-o inteiro antes de escrever uma linha de código.

---

## 1. O que é o Alfred

**Alfred** é um orquestrador de IA pessoal com personalidade de mordomo britânico. Ele roda como um servidor Python (FastAPI) no notebook do usuário (Esdras) e é acessado por clientes. Já existe um console web em React/TypeScript. Este documento descreve o **cliente Android nativo**.

O Alfred responde **sempre em português brasileiro**, se dirige ao usuário como **"senhor"**, e tem voz formal, serena e ligeiramente irônica — no espírito de Alfred Pennyworth.

**O cliente Android deve:**
- Conectar ao servidor Alfred (URL configurável pelo usuário)
- Enviar mensagens e receber respostas em **streaming real** (SSE)
- Mostrar os estados do sistema (qual LLM está ativo, latência, etc.)
- Ter identidade visual própria — **não um chat genérico de IA**

---

## 2. Arquitetura do sistema

```
[Celular Android] ←→ HTTP/SSE ←→ [Alfred Backend — notebook do Esdras]
                                         │
                              ┌──────────┴──────────┐
                         [Groq API]           [Ollama local]
                      llama-3.3-70b-versatile  qwen2.5-coder:3b
                         (primário)              (fallback)
```

O backend já está pronto e rodando. O Android só precisa consumir a API.

---

## 3. API Contract completo

### Base URL
Configurável pelo usuário. Exemplos:
- Mesma WiFi: `http://192.168.1.42:8000`
- Tailscale: `http://100.x.x.x:8000`
- Ngrok/túnel: `https://xxxxx.ngrok.io`

### Autenticação
Header opcional: `Authorization: Bearer {token}`  
Se `ALFRED_TOKEN` não estiver configurado no servidor, nenhum header é necessário.

---

### `GET /api/health`
Verifica se o servidor está vivo. Use para testar a conexão antes de salvar.

**Response 200:**
```json
{ "status": "ok" }
```

---

### `GET /api/status`
Telemetria real do sistema — atualizar a cada 10–15 segundos.

**Response 200:**
```json
{
  "brain": "groq",
  "quota": "ok",
  "scope_locked": true,
  "eval": "0/0",
  "calls_today": 7,
  "avg_latency_ms": 1243.5,
  "last_latency_ms": 891.2
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `brain` | string | `"groq"` \| `"ollama"` \| `"offline"` |
| `quota` | string | Estado da quota Groq (sempre `"ok"` por ora) |
| `scope_locked` | bool | Módulo de segurança travado |
| `eval` | string | Ferramentas aprovadas/total no Forge |
| `calls_today` | int | Chamadas ao LLM hoje |
| `avg_latency_ms` | float | Latência média em ms |
| `last_latency_ms` | float | Latência da última chamada |

---

### `POST /api/chat` — **SSE Streaming**
Este é o endpoint principal. Envia a conversa e recebe a resposta token-a-token.

**Request:**
```json
{
  "messages": [
    { "role": "user",      "content": "Olá Alfred!" },
    { "role": "assistant", "content": "Boa noite, senhor..." },
    { "role": "user",      "content": "Como você está?" }
  ]
}
```

**Regras do payload:**
- `role` aceita APENAS `"user"` ou `"assistant"` — nunca `"system"`
- `content` máximo de 8.000 caracteres por mensagem
- Array `messages` máximo de 50 itens
- Content-Type: `application/json`

**Response:** `text/event-stream` (SSE)

O servidor faz stream de eventos SSE. Cada linha começa com `data: ` seguido de JSON:

```
data: {"token": "Boa", "session_id": "uuid-aqui"}

data: {"token": " noite", "session_id": "uuid-aqui"}

data: {"token": ",", "session_id": "uuid-aqui"}

data: {"token": " senhor", "session_id": "uuid-aqui"}

data: {"done": true, "session_id": "uuid-aqui"}
```

Em caso de erro:
```
data: {"error": "Falha interna. Tente novamente."}
```

**Como ler SSE no Android (OkHttp):**
```kotlin
val request = Request.Builder()
    .url("$baseUrl/api/chat")
    .addHeader("Content-Type", "application/json")
    .addHeader("Authorization", "Bearer $token") // se configurado
    .post(body)
    .build()

val client = OkHttpClient.Builder()
    .readTimeout(120, TimeUnit.SECONDS) // streaming pode ser longo
    .build()

client.newCall(request).enqueue(object : Callback {
    override fun onResponse(call: Call, response: Response) {
        val source = response.body!!.source()
        while (!source.exhausted()) {
            val line = source.readUtf8Line() ?: break
            if (line.startsWith("data: ")) {
                val json = line.removePrefix("data: ")
                val obj = JSONObject(json)
                when {
                    obj.has("token") -> appendToken(obj.getString("token"))
                    obj.has("done")  -> onStreamComplete()
                    obj.has("error") -> onError(obj.getString("error"))
                }
            }
        }
    }
    override fun onFailure(call: Call, e: IOException) = onError(e.message ?: "Erro de rede")
})
```

---

### `GET /api/tools`
Lista de ferramentas no catálogo.

**Response 200:**
```json
{
  "tools": [
    {
      "id": 1,
      "name": "read_file",
      "description": "Lê arquivo no workspace",
      "status": "approved",
      "eval_score": null,
      "created_at": 1718200000.0
    }
  ]
}
```

---

## 4. Estados do Alfred durante uma conversa

O cliente deve manter e exibir estes estados:

| Estado | Quando | Como exibir |
|---|---|---|
| `IDLE` | Aguardando input | Indicador sereno |
| `SENDING` | Enviou, aguarda 1º token | Loading sutil |
| `STREAMING` | Recebendo tokens | Cursor piscando na mensagem |
| `DONE` | `done: true` recebido | Volta para IDLE |
| `ERROR` | Campo `error` no SSE | Mensagem de erro inline |
| `OFFLINE` | Falha de conexão | Banner de offline |

---

## 5. Design — Direção obrigatória

**O problema a evitar:** mais um chat de IA genérico com bolhas azuis/cinzas, fundo branco, botão verde de enviar.

**A direção:** Alfred é um **instrumento de precisão**, não um app. Pense em aviônica de luxo encontrando terminal de computador. Físico, tátil, com personalidade.

### Paleta de cores (usar EXATAMENTE estas)

```xml
<!-- cores.xml -->
<color name="alfred_void">#08080B</color>          <!-- fundo principal -->
<color name="alfred_surface">#0F0F13</color>       <!-- superfícies -->
<color name="alfred_surface_raised">#161619</color><!-- cards levantados -->
<color name="alfred_border">#1E1E26</color>        <!-- divisórias -->
<color name="alfred_brass">#C09A3C</color>         <!-- ÚNICO acento quente — latão -->
<color name="alfred_brass_bright">#D4AE52</color>  <!-- latão luminoso -->
<color name="alfred_brass_dim">#7A6228</color>     <!-- latão escuro -->
<color name="alfred_brass_muted">#3D300F</color>   <!-- latão muito escuro -->
<color name="alfred_text_primary">#DDDDD8</color>  <!-- texto principal -->
<color name="alfred_text_secondary">#7A7A88</color><!-- texto secundário -->
<color name="alfred_text_muted">#404050</color>    <!-- texto apagado -->
<color name="online_green">#4A8A5A</color>         <!-- indicador online -->
<color name="offline_red">#6B3A3A</color>          <!-- indicador offline -->
```

**Regras invioláveis:**
- Fundo: sempre `alfred_void` ou `alfred_surface`. Nunca branco, nunca cinza claro.
- Acento: APENAS `alfred_brass` e suas variações. Sem azul, sem roxo, sem verde.
- Sem gradientes exceto os do núcleo reativo.

### Tipografia

```gradle
// build.gradle
implementation "com.google.android.material:material:1.11.0"
```

```xml
<!-- Fontes via Google Fonts — baixar como recursos offline -->
<!-- Display/marca: Space Grotesk -->
<!-- Dados/telemetria: IBM Plex Mono -->  
<!-- Corpo: Inter -->
```

Use `Space Grotesk` em títulos e na palavra "ALFRED".  
Use `IBM Plex Mono` em latências, contadores, status técnicos.  
Use `Inter` nas mensagens de chat.

### Estilo dos textos de rótulo (labels "gravados")

```xml
<!-- Estilo de label de instrumento — small caps, tracking aberto -->
<style name="TextAppearance.Alfred.Label">
    <item name="android:fontFamily">@font/ibm_plex_mono</item>
    <item name="android:textSize">10sp</item>
    <item name="android:textColor">@color/alfred_text_muted</item>
    <item name="android:letterSpacing">0.18</item>
    <item name="android:textAllCaps">true</item>
</style>

<style name="TextAppearance.Alfred.Value">
    <item name="android:fontFamily">@font/ibm_plex_mono</item>
    <item name="android:textSize">12sp</item>
    <item name="android:textColor">@color/alfred_text_secondary</item>
</style>
```

---

## 6. Layout da tela principal

```
┌─────────────────────────────────┐
│ ◆ ALFRED          [●] GROQ  [⚙] │  ← TopBar
├─────────────────────────────────┤
│                                 │
│         ●●●●●●●●●●              │
│       ●●          ●●            │  ← AlfredCoreView
│      ●    ◆ ALFRED  ●           │     (canvas animado)
│       ●●          ●●            │
│         ●●●●●●●●●●              │
│                                 │
│    EM REPOUSO · GROQ ATIVO      │  ← label de estado
├─────────────────────────────────┤
│ ALFRED                          │
│ Boa noite, senhor. Alfred ao    │  ← Mensagem do Alfred
│ seu inteiro dispor...           │     (fundo levantado, borda latão)
│                                 │
│                    Olá Alfred!  │  ← Mensagem do usuário
│                                 │     (alinhada à direita)
│ ALFRED                          │
│ Com prazer, senhor...█          │  ← Streaming (cursor piscando)
├─────────────────────────────────┤
│ TRANSMISSÃO                     │
│ ┌─────────────────────────────┐ │  ← Input area
│ │ Digite sua mensagem...      │ │
│ └─────────────────────────────┘ │
│                        [▶ ENVIAR]│
└─────────────────────────────────┘
```

---

## 7. O núcleo reativo (AlfredCoreView)

Este é o **elemento mais importante** do design. É uma View customizada desenhada em Canvas que reage ao estado da conversa.

### Anatomia do núcleo (do exterior ao centro):

1. **Anel externo com 48 traços** — gira muito devagar (1 RPM em idle)
2. **Anel intermediário** — gira no sentido contrário
3. **Halo difuso de latão** — brilha e pulsa
4. **Círculo central** — gradiente de latão (ouro escuro → latão → âmbar)
5. **Orbe central** — ponto luminoso

### Comportamento por estado:

| Estado | Velocidade rotação | Halo | Animação principal |
|---|---|---|---|
| `IDLE` | Muito lenta (2 RPM) | Suave, ~30% opacidade | `breathe` — scale 1.0↔1.03, 4s |
| `SENDING` | Média (8 RPM) | Médio, ~50% | `pulse` — scale 1.0↔1.05, 2s |
| `STREAMING` | Rápida (15 RPM) | Forte, ~70% | `rapid_pulse` — 0.9s, com ripples |
| `OFFLINE` | Parada | Apagado, ~10% | Sem animação |

### Implementação em Kotlin/Canvas:

```kotlin
class AlfredCoreView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    private val brassPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#C09A3C")
    }
    private val tickPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#8A6E28")
        strokeWidth = 2f
        style = Paint.Style.STROKE
    }

    private var outerRotation = 0f
    private var innerRotation = 0f
    private var glowScale = 1f
    private var glowAlpha = 0.3f
    private var coreState: CoreState = CoreState.IDLE

    private val animator = ValueAnimator.ofFloat(0f, 360f).apply {
        duration = 30_000
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.RESTART
        interpolator = LinearInterpolator()
        addUpdateListener {
            outerRotation = it.animatedValue as Float
            innerRotation = -(it.animatedValue as Float) * 0.6f
            invalidate()
        }
    }

    fun setState(state: CoreState) {
        coreState = state
        animator.duration = when (state) {
            CoreState.IDLE      -> 30_000L
            CoreState.SENDING   -> 8_000L
            CoreState.STREAMING -> 4_000L
            CoreState.OFFLINE   -> { animator.cancel(); return }
        }
        if (!animator.isRunning) animator.start()
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val size = minOf(width, height) / 2f * 0.9f

        // 1. Halo difuso
        val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(cx, cy, size * 0.55f,
                intArrayOf(Color.parseColor("#44C09A3C"), Color.TRANSPARENT),
                floatArrayOf(0f, 1f), Shader.TileMode.CLAMP)
        }
        canvas.drawCircle(cx, cy, size * 0.55f * glowScale, glowPaint)

        // 2. Anel externo — 48 traços
        canvas.save()
        canvas.rotate(outerRotation, cx, cy)
        for (i in 0 until 48) {
            val angle = Math.toRadians((i * 360.0 / 48))
            val isCardinal = i % 12 == 0
            val isMajor = i % 6 == 0
            val outerR = size * 0.95f
            val innerR = when {
                isCardinal -> size * 0.83f
                isMajor    -> size * 0.87f
                else       -> size * 0.91f
            }
            tickPaint.color = when {
                isCardinal -> Color.parseColor("#C09A3C")
                isMajor    -> Color.parseColor("#7A6228")
                else       -> Color.parseColor("#2A2420")
            }
            tickPaint.strokeWidth = if (isCardinal) 3f else if (isMajor) 2f else 1.5f
            canvas.drawLine(
                cx + outerR * Math.cos(angle).toFloat(),
                cy + outerR * Math.sin(angle).toFloat(),
                cx + innerR * Math.cos(angle).toFloat(),
                cy + innerR * Math.sin(angle).toFloat(),
                tickPaint
            )
        }
        canvas.restore()

        // 3. Círculo central com gradiente
        canvas.save()
        canvas.rotate(innerRotation, cx, cy)
        brassPaint.shader = RadialGradient(cx, cy * 0.9f, size * 0.5f,
            intArrayOf(
                Color.parseColor("#E8C46A"),
                Color.parseColor("#C09A3C"),
                Color.parseColor("#6B4F1A")
            ),
            floatArrayOf(0f, 0.4f, 1f),
            Shader.TileMode.CLAMP)
        canvas.drawCircle(cx, cy, size * 0.5f, brassPaint)
        canvas.restore()

        // 4. Orbe central
        val orbPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#FFFBE8")
        }
        canvas.drawCircle(cx, cy, size * 0.06f, orbPaint)
    }
}

enum class CoreState { IDLE, SENDING, STREAMING, OFFLINE }
```

---

## 8. Componentes de UI detalhados

### 8.1 — TopBar

```xml
<!-- Sem AppBar padrão do Material. Construir manualmente. -->
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="56dp"
    android:background="@color/alfred_surface"
    android:orientation="horizontal"
    android:paddingHorizontal="20dp"
    android:gravity="center_vertical">

    <!-- Losango + nome -->
    <TextView
        android:text="◆"
        android:textColor="@color/alfred_brass"
        android:textSize="14sp"
        android:layout_marginEnd="8dp"/>

    <TextView
        android:text="ALFRED"
        android:fontFamily="@font/space_grotesk_semibold"
        android:textSize="16sp"
        android:letterSpacing="0.25"
        android:textColor="@color/alfred_brass"/>

    <Space android:layout_width="0dp" android:layout_weight="1" android:layout_height="wrap_content"/>

    <!-- Indicador de brain -->
    <View
        android:id="@+id/brain_dot"
        android:layout_width="8dp"
        android:layout_height="8dp"
        android:background="@drawable/circle_green"
        android:layout_marginEnd="6dp"/>

    <TextView
        android:id="@+id/brain_label"
        android:text="GROQ"
        style="@style/TextAppearance.Alfred.Label"
        android:textColor="@color/alfred_brass_dim"
        android:layout_marginEnd="16dp"/>

    <!-- Botão de configuração -->
    <ImageView
        android:id="@+id/btn_settings"
        android:src="@drawable/ic_settings_outline"
        android:tint="@color/alfred_text_muted"
        android:layout_width="24dp"
        android:layout_height="24dp"/>
</LinearLayout>
```

### 8.2 — Mensagem do Alfred

```xml
<LinearLayout
    android:orientation="horizontal"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginVertical="8dp">

    <!-- Badge lateral de latão -->
    <TextView
        android:text="◆"
        android:textColor="@color/alfred_brass"
        android:textSize="10sp"
        android:layout_marginTop="16dp"
        android:layout_marginEnd="8dp"/>

    <!-- Bloco da mensagem -->
    <LinearLayout
        android:orientation="vertical"
        android:background="@drawable/bg_alfred_message"
        android:padding="14dp"
        android:layout_width="0dp"
        android:layout_weight="1">

        <TextView
            android:text="ALFRED"
            style="@style/TextAppearance.Alfred.Label"
            android:textColor="@color/alfred_brass_dim"
            android:layout_marginBottom="4dp"/>

        <TextView
            android:id="@+id/message_text"
            android:fontFamily="@font/inter"
            android:textSize="14sp"
            android:lineSpacingMultiplier="1.6"
            android:textColor="@color/alfred_text_primary"/>
    </LinearLayout>
</LinearLayout>
```

```xml
<!-- res/drawable/bg_alfred_message.xml -->
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/alfred_surface_raised"/>
    <!-- Borda esquerda de latão simulada via layer-list -->
</shape>
```

### 8.3 — Campo de entrada

```xml
<LinearLayout
    android:orientation="vertical"
    android:background="@color/alfred_surface_raised"
    android:padding="16dp">

    <!-- Divisória superior -->
    <View
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:background="@color/alfred_border"
        android:layout_marginBottom="10dp"/>

    <!-- Rótulo gravado -->
    <TextView
        android:text="TRANSMISSÃO"
        style="@style/TextAppearance.Alfred.Label"
        android:layout_marginBottom="6dp"/>

    <!-- Input + botão -->
    <LinearLayout android:orientation="horizontal">
        <EditText
            android:id="@+id/input_message"
            android:hint="Digite sua mensagem..."
            android:hintTextColor="@color/alfred_text_muted"
            android:textColor="@color/alfred_text_primary"
            android:background="@drawable/bg_input"
            android:padding="10dp"
            android:fontFamily="@font/inter"
            android:textSize="14sp"
            android:minLines="1"
            android:maxLines="4"
            android:inputType="textMultiLine|textCapSentences"
            android:imeOptions="actionNone"
            android:layout_width="0dp"
            android:layout_weight="1"
            android:layout_marginEnd="8dp"/>

        <Button
            android:id="@+id/btn_send"
            android:text="▶  ENVIAR"
            android:fontFamily="@font/ibm_plex_mono"
            android:textSize="10sp"
            android:letterSpacing="0.1"
            android:backgroundTint="@color/alfred_surface"
            android:textColor="@color/alfred_brass"
            android:strokeColor="@color/alfred_brass_muted"
            android:strokeWidth="1dp"
            style="@style/Widget.Material3.Button.OutlinedButton"/>
    </LinearLayout>
</LinearLayout>
```

---

## 9. Tela de configuração (Settings)

Campos necessários:
- **URL do servidor** (ex: `http://192.168.1.42:8000`) — EditText com botão "Testar conexão"
- **Token de auth** (opcional) — EditText password
- **Modo escuro** — sempre ativado, apenas para consistência

Ao salvar, chamar `GET /api/health` para validar. Se retornar `{"status":"ok"}`, confirma. Se falhar, mostra erro em vermelho.

```kotlin
// Testar conexão
fun testConnection(url: String, token: String, callback: (Boolean, String) -> Unit) {
    val client = OkHttpClient.Builder().connectTimeout(5, TimeUnit.SECONDS).build()
    val request = Request.Builder()
        .url("$url/api/health")
        .apply { if (token.isNotBlank()) addHeader("Authorization", "Bearer $token") }
        .build()
    try {
        val response = client.newCall(request).execute()
        val body = response.body?.string()
        if (response.isSuccessful && body?.contains("ok") == true) {
            callback(true, "Conexão estabelecida com sucesso.")
        } else {
            callback(false, "Servidor respondeu com erro ${response.code}.")
        }
    } catch (e: Exception) {
        callback(false, "Não foi possível alcançar o servidor: ${e.message}")
    }
}
```

---

## 10. Estrutura de arquivos Android sugerida

```
app/src/main/
├── java/com/alfred/nexus/
│   ├── MainActivity.kt              # tela principal
│   ├── SettingsActivity.kt          # configuração da URL/token
│   ├── ui/
│   │   ├── AlfredCoreView.kt        # canvas animado do núcleo
│   │   ├── ChatAdapter.kt           # RecyclerView adapter
│   │   └── StatusView.kt            # barra de telemetria
│   ├── network/
│   │   ├── AlfredApi.kt             # cliente HTTP + SSE
│   │   └── SseParser.kt             # parser de eventos SSE
│   ├── model/
│   │   ├── Message.kt               # data class
│   │   ├── AlfredStatus.kt          # data class
│   │   └── CoreState.kt             # enum
│   └── viewmodel/
│       └── ChatViewModel.kt         # estado da conversa
├── res/
│   ├── font/
│   │   ├── space_grotesk_semibold.ttf
│   │   ├── ibm_plex_mono.ttf
│   │   └── inter.ttf
│   ├── values/
│   │   ├── colors.xml               # paleta completa acima
│   │   ├── themes.xml               # tema escuro customizado
│   │   └── strings.xml
│   └── layout/
│       ├── activity_main.xml
│       ├── activity_settings.xml
│       ├── item_message_alfred.xml
│       └── item_message_user.xml
```

---

## 11. Dependências (build.gradle)

```gradle
dependencies {
    implementation "androidx.core:core-ktx:1.12.0"
    implementation "androidx.appcompat:appcompat:1.6.1"
    implementation "com.google.android.material:material:1.11.0"
    implementation "androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0"
    implementation "androidx.lifecycle:lifecycle-livedata-ktx:2.7.0"
    implementation "com.squareup.okhttp3:okhttp:4.12.0"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
    implementation "com.google.code.gson:gson:2.10.1"
    
    // Fontes (alternativa ao download manual)
    implementation "androidx.core:core-ktx:1.12.0"
}
```

```gradle
// AndroidManifest.xml — permissões
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

---

## 12. Saudação inicial

Na primeira abertura (ou quando não há mensagens), mostrar a saudação do Alfred:

```
"Boa noite, senhor. Alfred ao seu inteiro dispor.
Tudo nos conformes por aqui — em que posso servi-lo?"
```

Esta mensagem aparece como uma mensagem do Alfred sem nunca ter sido enviada pelo usuário — é o Alfred se apresentando.

---

## 13. Tratamento do streaming no ViewModel

```kotlin
class ChatViewModel : ViewModel() {

    private val _messages = MutableLiveData<List<Message>>(emptyList())
    val messages: LiveData<List<Message>> = _messages

    private val _coreState = MutableLiveData(CoreState.IDLE)
    val coreState: LiveData<CoreState> = _coreState

    fun sendMessage(text: String, baseUrl: String, token: String) {
        val userMsg = Message("user", text)
        val currentList = _messages.value!!.toMutableList()
        currentList.add(userMsg)

        // Adiciona placeholder vazio para o Alfred
        val alfredMsg = Message("assistant", "", streaming = true)
        currentList.add(alfredMsg)
        _messages.postValue(currentList)

        _coreState.postValue(CoreState.SENDING)

        viewModelScope.launch(Dispatchers.IO) {
            AlfredApi.streamChat(
                baseUrl = baseUrl,
                token = token,
                messages = currentList.filter { !it.streaming }.map {
                    mapOf("role" to it.role, "content" to it.content)
                },
                onToken = { token ->
                    _coreState.postValue(CoreState.STREAMING)
                    val updated = _messages.value!!.toMutableList()
                    val lastIdx = updated.indexOfLast { it.streaming }
                    if (lastIdx >= 0) {
                        updated[lastIdx] = updated[lastIdx].copy(
                            content = updated[lastIdx].content + token
                        )
                        _messages.postValue(updated)
                    }
                },
                onDone = {
                    val updated = _messages.value!!.toMutableList()
                    val lastIdx = updated.indexOfLast { it.streaming }
                    if (lastIdx >= 0) {
                        updated[lastIdx] = updated[lastIdx].copy(streaming = false)
                        _messages.postValue(updated)
                    }
                    _coreState.postValue(CoreState.IDLE)
                },
                onError = { error ->
                    _coreState.postValue(CoreState.IDLE)
                    // remover placeholder e mostrar erro
                }
            )
        }
    }
}

data class Message(
    val role: String,
    val content: String,
    val streaming: Boolean = false
)
```

---

## 14. Checklist de entrega

- [ ] AlfredCoreView animado com 4 estados
- [ ] Chat com streaming SSE real (não mock)
- [ ] Histórico de conversa mantido na sessão
- [ ] Tela de configuração com teste de conexão
- [ ] Paleta de cores exata (preto profundo + latão como único acento)
- [ ] Tipografia tripartite (Space Grotesk + IBM Plex Mono + Inter)
- [ ] Saudação inicial do Alfred em português
- [ ] Indicador de brain (Groq/Ollama/offline) na TopBar
- [ ] Suporte a tema escuro completo (sem tela branca em nenhum momento)
- [ ] `minSdk 26` (Android 8.0+)

---

## 15. O que NÃO fazer

- ❌ Bolhas de chat azuis/verdes no estilo WhatsApp
- ❌ Fundo branco ou cinza claro em qualquer tela
- ❌ Material Design padrão com cores primárias coloridas
- ❌ Ícones genéricos de robô ou IA
- ❌ Spinner de loading padrão — usar o AlfredCoreView no estado SENDING
- ❌ Toast para erros — usar mensagem inline no chat
- ❌ Qualquer cor além de preto/cinza + latão
