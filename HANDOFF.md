# PM Pilot — Handoff (2026-06-15)

## What this project is

A personal PM dashboard that shows **what needs you today** — open questions,
blocked tasks, team activity from Slack + ClickUp, and an "Ask" bar for
querying the project brain. Runs at `localhost:3000`.

---

## How to start it

```bash
cd ~/Documents/Projects/pms-pilot
npm install          # only needed first time or after pulling changes
npm run dev:pilot    # opens http://localhost:3000
```

---

## What's fully working

| Feature | Where |
|---|---|
| Dashboard — hero, questions, tasks, activity, KPIs | `localhost:3000` |
| Settings page — gear icon in header | `localhost:3000/settings` |
| Slack connected — real messages sync | Settings → Connections |
| SQLite database — roles & hidden flags persist | `apps/pm-pilot/data/keystone.db` |
| People roles (client / qa / developer / pm) | Settings → People & Roles |
| Remove/restore people from portal | Settings → × button |
| Run sync button — pulls fresh data | Settings → Run sync |

---

## What's NOT done yet (do these in order)

### 1. Connect ClickUp → Tasks panel fills up
1. Go to `localhost:3000/settings`
2. Paste your ClickUp API token in the Connections section → **Save connections**
3. Hit **Run sync**
4. Tasks should now appear on the dashboard

> Tell Claude: **"Connect ClickUp so tasks appear on the dashboard"**

---

### 2. Wire the Ask bar to Claude
The Ask bar at top-right already does retrieval — it finds the relevant context
from your Slack + ClickUp data. It just doesn't reason over it yet.

> Tell Claude: **"Wire the Ask bar to Claude so it gives real answers"**

---

### 3. Add auth (optional but important)
This tool shows private PM data. Should be locked behind a password or env-var
gate before sharing the URL with anyone.

> Tell Claude: **"Add simple auth to lock the dashboard"**

---

## How the two apps are wired

```
Slack API ──┐
            ├─→ apps/context-engine  (sync pipeline)
ClickUp ────┘         │
                       ▼
              context-engine/data/context-store.json
                       │
                       ▼
              pm-pilot/lib/store-reader.ts  ← merges in SQLite roles/hidden
                       │
                       ▼
              Dashboard (app/page.tsx) + Ask bar (api/ask)
```

---

## Key files to know

| File | What it does |
|---|---|
| `apps/pm-pilot/lib/store-reader.ts` | Reads real data; falls back to samples if store missing |
| `apps/pm-pilot/lib/db.ts` | All database helpers (roles, hidden, tokens) |
| `apps/pm-pilot/app/settings/page.tsx` | Settings UI |
| `apps/pm-pilot/app/api/config/route.ts` | API for saving people + connections |
| `apps/pm-pilot/app/api/config/sync/route.ts` | API that triggers the engine sync |
| `apps/pm-pilot/app/api/ask/route.ts` | Ask bar — retrieval works, brain not wired yet |
| `apps/context-engine/.env` | Slack/ClickUp tokens (written by Settings save) |
| `apps/pm-pilot/data/keystone.db` | SQLite — person roles, hidden flags, token storage |

---

## Current data situation

- **Slack**: connected, syncing from channel `C0BAZ6QHGEL`
- **ClickUp**: not connected — no token entered yet
- **People**: roles assigned + ~57 people hidden via Settings

---

## Starting the next chat

Paste this at the start of your next conversation with Claude:

> "I'm continuing the PM Pilot project at `~/Documents/Projects/pms-pilot`.
> What was built last session is in `HANDOFF.md` at the project root.
> Today I want to: [pick one from the TODO list above]"
