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
      pages/
        Factory.jsx  ← lista e cria bots
        BotDetail.jsx ← status, QR, skills, logs, edição
        Infra.jsx    ← containers Docker + chat IA interna
      App.jsx        ← roteamento
  electron/
    main.js          ← sobe backend como filho, serve frontend
    preload.js
```

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
