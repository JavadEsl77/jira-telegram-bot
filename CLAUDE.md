# CLAUDE.md — Jira Telegram Bot

## Project Overview

A Telegram bot (grammY) that integrates with a **self-hosted Jira Server** instance.
Each user authenticates with their own Jira credentials. The bot supports viewing tasks,
issue details, transitions, comments, and worklogs with Persian (Jalali) calendar support.

**Stack:** Node.js · TypeScript · grammY · Prisma + libsql (SQLite) · Axios · Vitest  
**Entry point:** `src/index.ts` → `src/app.ts` (DI wiring) → `src/bot/register-handlers.ts`

---

## Architecture Map

```
src/
  index.ts                     # Entry point
  app.ts                       # Dependency wiring (Prisma, services, bot)
  bot/
    bot.ts                     # grammY Bot instance creation
    register-handlers.ts       # All handler registration (order matters)
    conversation-state.ts      # Per-user conversation state machine
    handlers/                  # One file per feature (start, my-tasks, issue-detail, ...)
    keyboards/                 # Inline keyboard builders per feature
    formatters/                # Message text formatters
    utils/                     # timezone.ts, duration-parser.ts, calendar.ts
  jira/
    jira.client.ts             # Low-level Jira HTTP client (axios)
    jira.client.factory.ts     # Creates JiraClient per user from stored credentials
    jira.types.ts              # Jira domain types
    services/                  # issue, search, sprint, transition, comment, worklog
  user/
    user.service.ts            # User business logic
    user.repository.ts         # Repository interface
    user.repository.database.ts# Prisma implementation
    user.types.ts              # User domain types
  crypto/
    token-encryption.ts        # AES-GCM encryption for stored Jira tokens
prisma/
  schema.prisma                # DB schema
  migrations/                  # Auto-generated — do not edit manually
tests/                         # Vitest test files
scripts/                       # Utility scripts
dist/                          # Build output — never read
```

---

## Repository Navigation Rules

**Start targeted, not broad.**

1. If the user names a file or feature, open that file directly.
2. To find where a feature lives: `Grep` for the handler/command name in `src/bot/handlers/`.
3. To understand a Jira operation: look in `src/jira/services/` first.
4. To understand state flow: read `src/bot/conversation-state.ts`.
5. Follow only direct imports needed for the task — do not spider the whole tree.
6. Before opening a file, confirm it is relevant to the current task.

**Never scan for context you can infer from this map.**

---

## Files and Directories to NEVER Read

- `node_modules/` — never
- `dist/` — build output, never
- `dev.db` — binary SQLite file
- `package-lock.json` — only read if diagnosing dependency conflicts
- `prisma/migrations/` — only read if the task is about schema changes
- `src/jira/test-*.ts` — ad-hoc test scripts, not production code
- `prisma/test-jira-auth.ts` — one-off script

---

## Change Rules

- Make the **smallest possible change** that solves the task.
- Do not refactor, rename, or reorganize unrelated code.
- Reuse existing services and utilities — check `src/jira/services/` and `src/bot/utils/` before writing new logic.
- Preserve existing patterns (handler registration style, keyboard builder pattern, formatter pattern).
- Do not change handler registration order in `register-handlers.ts` without explicit reason — order is load-bearing.
- Do not modify unrelated handlers, keyboards, or services.

---

## Validation Rules

- Run only the test(s) directly related to the changed file: `npx vitest run <test-file>`
- For type safety: `npx tsc --noEmit`
- Full test suite (`npm test`) only when explicitly requested or when touching shared infrastructure (app.ts, conversation-state.ts, jira.client.ts).
- Do not investigate unrelated test failures unless they block the task.
- Dev server: `npm run dev`

---

## Security Rules

These values must **never** appear in output, commits, or logs:

- `.env` contents
- `TELEGRAM_BOT_TOKEN`
- `JIRA_BASE_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN` (or any stored per-user Jira credentials)
- `ENCRYPTION_KEY` / `ENCRYPTION_IV`
- `DATABASE_URL`
- Any Authorization header values

If a task requires inspecting credentials, show structure only — never the value.

---

## Git Rules

- Do not commit or push without explicit user request.
- Do not stage unrelated files.
- Do not overwrite files the user modified before the task began.
- Prefer a single focused commit per task.
- Never `--no-verify` or `--force-push` to `master` without explicit instruction.

---

## Response Format

After completing a task, respond with:

1. **Changed files** — list with paths
2. **What changed** — one line per file
3. **Validation** — command run and result
4. **Remaining issues** — only if any

No lengthy summaries. No repeating the changed code unless asked.
