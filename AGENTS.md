# AGENTS.md — AI Agent Guide

This file is the authoritative reference for AI agents (Claude Code, GitHub Copilot, etc.) working on this codebase. **Update this file whenever you add a feature, change architecture, or modify conventions.**

---

## Project Identity

| Item | Value |
|------|-------|
| Name | jira-telegram-bot |
| Purpose | Telegram bot for technical teams to manage Jira issues |
| Jira type | Self-hosted Jira Server / Data Center |
| Jira URL | https://jira.lfdesk.ir/ |
| Jira API | REST API v2 (`/rest/api/2/...`) |
| Runtime | Node.js (CommonJS, `"type": "commonjs"`) |
| Language | TypeScript (`"module": "NodeNext"`, strict mode) |
| Telegram | grammY ^1.45.1 |
| Database | SQLite via Prisma 7 + `@prisma/adapter-libsql` |

---

## Critical Architecture Decisions

### 1. Jira Authentication: Bearer Token (NOT Basic Auth)

Jira Server/Data Center Personal Access Tokens (PAT) use **Bearer auth**:

```ts
// CORRECT
headers: { Authorization: `Bearer ${token}` }

// WRONG — only works for Jira Cloud API tokens
auth: { username, password: token }
```

This is a non-obvious distinction. Do not revert to Basic Auth.

### 2. Per-User JiraClient

`JiraClient` is instantiated **per request**, not shared globally. Each handler:
1. Calls `userService.getJiraCredentials(ctx.from.id)`
2. Creates `jiraClientFactory.createForUser(credentials)`
3. Creates service (`new IssueService(jiraClient)`)
4. Executes the operation

Never cache or share a `JiraClient` instance between users.

### 3. Token Encryption

PATs are encrypted (AES-256-GCM) before writing to the database and decrypted when read. The decrypted token only lives in memory during a request — it is never logged.

Encryption boundary: **`DatabaseUserRepository`**. The `UserService` and handlers deal with plaintext tokens only.

### 4. Conversation State is In-Memory

`ConversationStateManager` uses a `Map<number, ConversationState>` keyed by Telegram user ID. It is intentionally ephemeral — losing state on restart is acceptable for a conversation flow. Do NOT persist conversation state to the database.

### 5. Handler Registration Order Matters

In `src/bot/register-handlers.ts`, `registerConnectJiraHandler` **must be first** because it registers a `bot.on("message:text")` handler that intercepts text messages during auth flow and calls `next()` when idle.

---

## File Map

```
src/
├── index.ts                       Entry point — loads dotenv, starts bot
├── app.ts                         Application factory — wires all dependencies
│
├── user/
│   ├── user.types.ts              User, JiraCredentials interfaces
│   ├── user.repository.ts         UserRepository interface + InMemoryUserRepository
│   ├── user.repository.database.ts  Prisma implementation (encrypts token on save)
│   └── user.service.ts            Business logic — getJiraCredentials, connectJira, etc.
│
├── crypto/
│   └── token-encryption.ts        TokenEncryptionService interface + AesGcmEncryptionService
│
├── jira/
│   ├── jira.client.ts             HTTP client — Bearer auth, 30s timeout
│   ├── jira.client.factory.ts     Creates JiraClient per user
│   ├── jira.types.ts              JiraIssue, JiraTransition, JiraSearchResult, etc.
│   └── services/
│       ├── issue.service.ts       getMyTasks (paginated), getIssue
│       ├── transition.service.ts  getAvailable, transition, transitionTo
│       └── search.service.ts      search (JQL), searchText (full-text)
│
└── bot/
    ├── bot.ts                     createBot() — reads BOT_TOKEN from env
    ├── register-handlers.ts       Registers all handlers (order matters — see above)
    ├── conversation-state.ts      ConversationStateManager — per-user state Map
    ├── handlers/
    │   ├── start.handler.ts       /start — checks auth, shows main menu or connect prompt
    │   ├── connect-jira.handler.ts  Auth flow + text interceptor + error classification
    │   ├── settings.handler.ts    Settings page, back_to_main, disconnect_jira
    │   ├── my-tasks.handler.ts    Paginated task list
    │   ├── issue-detail.handler.ts  Issue detail view
    │   └── transition.handler.ts  Status transitions (show → confirm → execute)
    ├── keyboards/
    │   ├── main.keyboard.ts       Main menu (My Tasks, Search, Settings)
    │   ├── connect-jira.keyboard.ts  Connect / Retry buttons
    │   ├── settings.keyboard.ts   Settings page buttons
    │   ├── issue.keyboard.ts      Issue list keyboard (pagination)
    │   └── issue-detail.keyboard.ts  Issue detail buttons (Transition, Comment, Worklog, Back)
    └── formatters/
        └── issue.formatter.ts     formatIssue, formatIssueCard, formatIssueList

prisma/
├── schema.prisma                  SQLite schema — User model
├── prisma.config.ts               Prisma 7 config (datasource URL for migrations)
└── migrations/                    Migration history

scripts/
└── test-jira-auth.ts              Diagnostic — tests Bearer vs Basic auth against /myself

src/jira/test-*.ts                 Manual debug scripts (not for production)
```

---

## Database Schema

```sql
CREATE TABLE "User" (
    "id"              TEXT PRIMARY KEY,    -- cuid
    "telegramId"      BIGINT UNIQUE,       -- Telegram user ID (64-bit safe)
    "jiraUsername"    TEXT,                -- from /myself.name
    "jiraDisplayName" TEXT,               -- from /myself.displayName
    "jiraAccountId"   TEXT,               -- null for Jira Server
    "jiraToken"       TEXT,               -- AES-256-GCM encrypted PAT
    "createdAt"       DATETIME,
    "updatedAt"       DATETIME
);
```

**Why BigInt for telegramId?** Telegram user IDs can exceed 32-bit integer range. JavaScript `number` handles them safely at runtime; Prisma BigInt ensures correct storage in SQLite.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | ✅ | Telegram bot token from BotFather |
| `JIRA_BASE_URL` | ✅ | Jira base URL, no trailing slash |
| `DATABASE_URL` | ✅ | SQLite path, e.g. `file:./dev.db` |
| `JIRA_TOKEN_ENCRYPTION_KEY` | ✅ | 64 hex chars (32 bytes) for AES-256-GCM |
| `NODE_ENV` | — | `development` or `production` |
| `TEST_JIRA_TOKEN` | — | Only for `scripts/test-jira-auth.ts` |
| `TEST_JIRA_USERNAME` | — | Only for `scripts/test-jira-auth.ts` |

Generate an encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Prisma 7 Notes

Prisma 7 has a breaking change: `url` is no longer allowed in the `datasource` block of `schema.prisma`. Configuration lives in `prisma.config.ts`:

```ts
// prisma.config.ts
export default defineConfig({
    datasource: { url: process.env.DATABASE_URL },
});
```

Runtime: `PrismaClient` receives a driver adapter:
```ts
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });
```

---

## How to Add a New Feature

### New Telegram Command

1. Create `src/bot/handlers/<feature>.handler.ts`
2. Export `register<Feature>Handler(bot, ...deps)`
3. Import and call it in `src/bot/register-handlers.ts`
4. If the handler needs Jira access:
   - Accept `userService: UserService` and `jiraClientFactory: JiraClientFactory`
   - Call `await userService.getJiraCredentials(ctx.from.id)` at the start
   - Create `jiraClientFactory.createForUser(credentials)` for the HTTP call
5. If new keyboard buttons are needed, create `src/bot/keyboards/<feature>.keyboard.ts`
6. **Update** `README.md` feature table and `AGENTS.md` file map

### New Jira Service

1. Create `src/jira/services/<feature>.service.ts`
2. Accept `JiraClient` in the constructor
3. If new API types are needed, add them to `src/jira/jira.types.ts`
4. **Update** `AGENTS.md` file map

### New Database Field

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Update `src/user/user.types.ts` if the field is part of the `User` model
4. Update `src/user/user.repository.database.ts` to read/write the new field
5. **Update** `AGENTS.md` database schema section

### New Environment Variable

1. Add to `.env.example` with a comment
2. Read it where needed (validate at startup if required)
3. **Update** `README.md` and `AGENTS.md` environment variables table

---

## Security Rules (Non-Negotiable)

- **Never log a PAT** — not in console.error, not in debug output
- **Never echo a PAT back** in a Telegram message
- **Never use one user's credentials for another user** — always key by `ctx.from.id`
- **Always validate** Jira credentials with `/myself` before saving
- **Fail at startup** if `JIRA_TOKEN_ENCRYPTION_KEY` is missing — never silently use a default key
- **Token is plaintext only during a request** — never store decrypted token outside the repository boundary

---

## Conventions

### TypeScript

- `"module": "NodeNext"` — all imports must use `.js` extension (e.g., `./jira.client.js`)
- `"noUncheckedIndexedAccess": true` — array/tuple index access returns `T | undefined`
- `"strict": true` — no implicit any, strict null checks

### grammY Patterns

- Use `bot.callbackQuery(pattern, handler)` for inline keyboard buttons
- Use `bot.command("name", handler)` for slash commands
- Call `await ctx.answerCallbackQuery()` before any long operation to dismiss the loading spinner
- Edit messages with `ctx.editMessageText()` for in-place updates; use `ctx.reply()` only for new messages

### Services

- Services are stateless — instantiate per request, not per application
- `JiraClient` is the dependency boundary — services never import axios directly
- Handler → Service → JiraClient (never skip layers)

### JSDoc

- Write JSDoc in Persian (فارسی) for all exported functions, classes, and interfaces
- Document non-obvious behavior, not obvious names
- Keep comments short — one line for simple things, a paragraph for complex contracts

---

## Out of Scope (Do Not Add Without Explicit Request)

- Comments (Jira)
- Worklog / time tracking
- Create / Delete Issue
- LLM / OpenRouter integration
- Search handler (SearchService exists, but no Telegram handler yet)
- Notifications / webhooks
- Admin panel
- Multi-language support
- Attachment upload
