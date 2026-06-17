# FactorIA

Plataforma desktop (Electron) para criar e gerenciar bots de WhatsApp com IA — self-hosted.

## Stack
- **Backend**: Node.js + Express (porta 4000) + Prisma + SQLite
- **Frontend**: React + Vite (porta 5173 em dev)
- **Desktop**: Electron
- **WhatsApp**: WAHA (1 container Docker por bot, portas 4100+)
- **LLM**: Groq (primário) / Ollama (fallback local) / Anthropic (opcional)
- **Segurança**: login JWT + RBAC, helmet, rate limit, validação Zod

## O que a plataforma faz

- **Agentes**: cada bot é uma sessão isolada de WhatsApp (container WAHA) com
  persona/prompt, comandos liga/desliga e memória de conversa próprios.
- **Atendimento virtual**: conversa por contato com handoff automático pra
  humano (palavra-chave ou pedido) e central pro operador assumir/responder.
- **Fluxo de trabalho**: roteiro configurável (menu, coleta de dados, IA,
  handoff) que o bot segue antes de cair no LLM.
- **Integrações (/v1)**: chaves de API com escopo + webhooks de saída assinados,
  pra plugar site/CRM/n8n. Inclui endpoint de chat com a IA do bot.
- **Autenticação e acesso**: login, papéis (admin/operator/viewer), gestão de
  usuários e cofre de segredos (Porão).

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
      routes/
        auth.js          ← setup/login/me + CRUD de usuários (RBAC)
        keys.js          ← chaves de API e webhooks de saída
        gateway.js       ← API pública /v1 (autenticada por chave)
        conversations.js ← central de atendimento
        flows.js         ← CRUD de fluxos de trabalho
      services/
        auth.js      ← bcrypt + JWT
        gateway.js   ← gera/resolve chaves, dispara webhooks (HMAC)
        atendimento.js ← conversas + detecção de handoff
        workflow.js  ← motor de fluxo (máquina de estados pura)
      middleware/
        auth.js      ← requireAuth + requireRole (viewer<operator<admin)
        apiKey.js    ← autenticação por chave de API (escopos)
      utils/http.js  ← AppError, asyncHandler, validação Zod
      db.js          ← PrismaClient singleton
      server.js      ← Express, init banco, graceful shutdown
    prisma/
      schema.prisma  ← User, Bot, Skill, Log, ApiKey, WebhookEndpoint,
                       Conversation, Flow
  frontend/
    src/
      lib/api.js     ← cliente HTTP com token JWT + tratamento de 401
      auth/AuthContext.jsx ← sessão (setup/login/logout)
      components/    ← Card, Badge, Button, Input, StatusDot
      pages/
        Gate.jsx        ← login / setup do 1º admin
        Dashboard.jsx   ← lista de agentes com status em tempo real
        AgentWizard.jsx ← criação de agente em 3 passos
        AgentDetail.jsx ← conexão, config, skills, fluxo, histórico
        Atendimento.jsx ← central de conversas (handoff humano)
        Integracoes.jsx ← chaves de API + webhooks
        InfraPage.jsx   ← containers Docker + chat IA interna
        Porao.jsx       ← cofre de chaves da plataforma
      App.jsx        ← roteamento + menu lateral (gated por login)
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

## Autenticação

Todas as rotas `/api/*` (exceto `/api/auth/setup` e `/api/auth/login`) exigem
`Authorization: Bearer <token>`. O primeiro acesso cria o admin via setup; depois
é login por e-mail/senha. Papéis: `viewer` < `operator` < `admin`.

```bash
# bootstrap headless (sem UI)
ADMIN_EMAIL=voce@ex.com ADMIN_PASSWORD=segredo123 npm --prefix backend run seed
```

## Rotas da API (painel — exige login)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/setup` · `/login` · GET `/me` | Sessão |
| GET/POST/PATCH/DELETE | `/api/auth/users` | Gestão de usuários (admin) |
| GET/POST | `/api/bots` (+ `/:id/connect`, `/qr`, `/status`, `/logs`) | Agentes |
| GET/POST/PATCH/DELETE | `/api/skills` | Habilidades fixas |
| GET/PUT/DELETE | `/api/flows/:botId` (+ `/validar`) | Fluxo de trabalho |
| GET/POST | `/api/conversations` (+ `/:id/assumir`, `/devolver`, `/encerrar`, `/responder`) | Atendimento |
| GET/POST/PATCH/DELETE | `/api/keys` e `/api/keys/webhooks` | Integrações |
| GET/POST | `/api/infra/status` · `/docker` · `/chat` | Infra + IA interna |

## Gateway de integração (`/v1` — exige chave de API)

Autenticado por `Authorization: Bearer fct_…` ou `X-API-Key`. Escopos: `send`,
`read`, `chat`. Webhooks de saída assinam o corpo em `X-FactorIA-Signature` (HMAC-SHA256).

| Método | Rota | Escopo | Descrição |
|---|---|---|---|
| GET  | `/v1/bots` | read | Bots acessíveis pela chave |
| POST | `/v1/messages` | send | Envia mensagem de WhatsApp |
| GET  | `/v1/messages` | read | Histórico de mensagens |
| POST | `/v1/chat` | chat | Resposta da IA do bot (sem enviar ao WhatsApp) |

```bash
curl -X POST http://127.0.0.1:4000/v1/chat \
  -H "Authorization: Bearer fct_xxxx_yyyy" \
  -H "Content-Type: application/json" \
  -d '{"message":"Quais os horários?","sessionId":"visitante-42"}'
```

## Webhook do WAHA

| Método | Rota | Descrição |
|---|---|---|
| POST | `/webhook/waha/:botId` | Recebe eventos do WAHA (sem auth — tráfego do container) |

## Fix @lev/@levoff (não reverter)

Em `backend/src/routes/webhook.js`, a detecção de comando usa **igualdade exata**:

```js
const isActivate   = normalized === cmdOn;
const isDeactivate = normalized === cmdOff;
```

**Nunca use `.includes()`** — a substring apareceria na confirmação do próprio bot
(que volta pelo webhook como evento) e causaria loop de desativação.

## Testes

```bash
npm --prefix backend test     # motor de fluxo (node --test)
```

## Pendências futuras

- [ ] Migrar de 1 container/bot (WAHA Core) → WAHA Plus multi-sessão
- [ ] Tool-calling na IA interna (executar ações na API via chat)
- [ ] Editor visual de fluxo (arrastar-soltar) além do JSON
- [ ] Persistir memória longa do cérebro em banco (hoje reidrata dos logs)
- [ ] Mover backend pra servidor 24h + frontend web (sair do Electron)
