# FactorIA

Plataforma desktop (Electron) para criar e gerenciar bots de WhatsApp com IA — self-hosted.

## Stack
- **Backend**: Node.js + Express (porta 4000) + Prisma + SQLite
- **Frontend**: React + Vite (porta 5173 em dev)
- **Desktop**: Electron
- **WhatsApp**: WAHA (1 container Docker por bot, portas 4100+)
- **LLM**: Groq (primário) / Ollama (fallback local) / Anthropic (opcional)

## Início rápido

```bash
cd factoria
cp .env.example .env   # preencher GROQ_API_KEY e CRYPTO_SECRET

npm run install:all    # instala dependências de tudo
npm run db:generate    # gera o Prisma client
npm run db:migrate     # cria o banco SQLite

npm run dev            # sobe backend + frontend + Electron simultaneamente
```

As chaves sensíveis (API keys, URLs do WAHA, etc.) não precisam mais ficar só no
`.env` — podem ser preenchidas direto na UI, na tela **🔐 Porão** (acessível pelo
rodapé do menu lateral). Elas são encriptadas no keychain do sistema operacional
via Electron `safeStorage` e injetadas no backend ao reiniciar.

## Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe tudo em modo dev (hot reload) |
| `npm start` | Build do frontend + abre Electron em produção |
| `npm run db:studio` | Interface visual do banco (Prisma Studio) |
| `npm run db:migrate` | Aplica migrações pendentes |

## Arquitetura

```
factoria/
  backend/
    src/
      routes/
        webhook.js   ← eventos WAHA por bot (fix @lev/@levoff exato aqui)
        bots.js      ← CRUD, connect, QR, status, logs
        skills.js    ← habilidades (gatilho→resposta fixa)
        infra.js     ← Docker, chat da IA interna, status
      services/
        waha.js      ← cliente WAHA + TTLMap anti-loop/leak
        docker.js    ← criar/parar/remover containers
        brain.js     ← LLM (Anthropic > Groq > Ollama)
        crypto.js    ← AES-256-GCM para dados sensíveis
      server.js      ← Express, init banco, graceful shutdown
    prisma/
      schema.prisma  ← Bot (cmdOn/cmdOff por bot), Skill, Log
  frontend/
    src/
      components/
        Card.jsx, Badge.jsx, Button.jsx, Input.jsx, StatusDot.jsx
      hooks/
        useApi.js    ← wrapper de fetch com loading/error
      pages/
        Dashboard.jsx   ← lista de agentes com status em tempo real
        AgentWizard.jsx ← criação de agente em 3 passos
        AgentDetail.jsx ← conexão, configurações, skills, histórico
        InfraPage.jsx   ← containers Docker + chat IA interna
        Porao.jsx       ← cofre de chaves da plataforma
      App.jsx        ← roteamento + menu lateral
      index.html     ← design system obsidian / black piano (CSS vars)
  electron/
    main.js          ← sobe backend como filho, serve frontend, registra IPC
    preload.js       ← expõe electronAPI (porão, versão, logs do backend)
    store.js         ← cofre encriptado (Electron safeStorage)
```

## Porão — cofre de chaves

Tela de configurações avançadas (`/porao`) onde ficam as credenciais pesadas da
plataforma: chaves de LLM (Groq/Anthropic), WAHA, ElevenLabs, WhatsApp do dono e
URL do banco. Nunca tocam o disco em texto puro:

- `electron/store.js` usa `safeStorage.isEncryptionAvailable()` + `safeStorage.encryptString`
  para gravar um arquivo encriptado em `app.getPath("userData")`.
- A renderer só vê valores mascarados (`••••••••`) via IPC (`porao:get`) — nunca o valor real.
- Salvar (`porao:set`) só atualiza os campos que o usuário de fato editou.
- "Reiniciar backend" mata o processo filho do Express e sobe de novo já com as
  novas chaves injetadas via `env`.

## Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| GET  | `/api/bots` | Lista todos os bots |
| POST | `/api/bots` | Cria bot + container WAHA |
| GET  | `/api/bots/:id/status` | Status WAHA + Docker |
| POST | `/api/bots/:id/connect` | Conecta sessão WhatsApp |
| GET  | `/api/bots/:id/qr` | QR Code para escanear |
| GET  | `/api/bots/:id/logs` | Histórico de mensagens |
| POST | `/webhook/waha/:botId` | Recebe eventos do WAHA |
| GET  | `/api/infra/status` | Status geral da plataforma |
| POST | `/api/infra/chat` | Chat da IA interna |

## Fix @lev/@levoff (não reverter)

Em `backend/src/routes/webhook.js`, a detecção de comando usa **igualdade exata**:

```js
const isActivate   = normalized === cmdOn;
const isDeactivate = normalized === cmdOff;
```

**Nunca use `.includes()`** — a substring apareceria na confirmação do próprio bot
(que volta pelo webhook como evento) e causaria loop de desativação.

## Pendências futuras

- [ ] Migrar de 1 container/bot (WAHA Core) → WAHA Plus multi-sessão
- [ ] Tool-calling na IA interna (executar ações na API via chat)
- [ ] Mover backend pra servidor 24h + frontend web (sair do Electron)
