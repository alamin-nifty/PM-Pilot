# PM Pilot — Build Brief (for Claude Code)

> **How to use this:** save this file as `CLAUDE.md` in the root of the
> `pm-pilot-monorepo` so Claude Code reads it automatically. Build **one phase
> at a time**, and don't start the next phase until the current one's
> "Done when" is satisfied. Ask the user before doing anything that needs their
> accounts, tokens, or money.

---

## 1. What we're building

PM Pilot is a personal command center for a **single Project Manager** (the
user). It reads the team's **Slack** and **ClickUp** (read-only), understands
the project from the user's **own external documentation site**, and each day
surfaces *what needs the PM and from whom*, plus answers questions about project
state. The PM stays the safeguard and decision-maker — PM Pilot **suggests,
never acts on its own**.

## 2. Core principles (do not violate)

- **Single user.** This is the PM's private tool. No accounts/logins for clients, QA, or devs.
- **Read-only** to Slack and ClickUp through Phase 3. Never write to them early.
- **Suggest, don't decide.** Everything is a recommendation the PM accepts or rejects.
- **Cite sources.** Every answer links back to the message, task, or doc it came from.
- **KPIs are PM-only conversation-starters, not scorecards.** Never expose individual developer/QA metrics to anyone but the PM; always pair a number with context. Avoid crude metrics that create perverse incentives.
- **Docs are external.** The user's documentation lives on their **own website**, not in this repo. Docs are currently **bypassed** (dummy/none). Only wire them in Phase 3, via that site's content API.

## 3. Current state — what already exists

A monorepo using **npm workspaces**, two apps, both running on **sample data**:

```
pm-pilot-monorepo/
  apps/
    context-engine/   # Node + TypeScript (run via tsx). NO web UI.
      src/
        model.ts          # normalized types: Person, Item, Task, Link + detectTaskLinks()
        store.ts          # ContextStore: JSON-backed repository, reindexLinks()
        connectors/
          types.ts        # Connector interface + MOCK_PEOPLE; fixturesEnabled()
          slack.ts        # read-only Slack; real path gated by SLACK_BOT_TOKEN, else fixtures
          clickup.ts      # read-only ClickUp; real path gated by CLICKUP_API_TOKEN, else fixtures
        sync.ts           # backfill enabled connectors -> store (npm run sync)
        inspect.ts        # print store + agenda (npm run inspect)
        agenda.ts         # needsAttention() heuristic, buildAgenda(), gatherContext()
    pm-pilot/         # Next.js (App Router, TS) — the dashboard the PM opens
      lib/
        model.ts          # sample PEOPLE/TASKS/ITEMS (note: simpler than engine's model)
        agenda.ts         # getAgenda(), allTasks(), recentItems(), gatherContext()
        kpi.ts            # getTeamKpis() — developer & QA signals
      app/
        page.tsx          # dashboard: agenda by person, tasks, activity feed, KPI panel
        AskBrain.tsx      # client component: the "Ask" bar -> POST /api/ask
        api/{agenda,tasks,items,ask,kpi}/route.ts
  packages/             # empty; shared code goes here (Phase 2)
  package.json          # workspaces + root scripts: dev:pilot, build:pilot, sync, inspect
```

**The deliberate seams (where real wiring plugs in):**
1. `pm-pilot/app/api/ask/route.ts` — currently returns keyword retrieval over sample items. **This is where the brain plugs in.**
2. `pm-pilot/lib/agenda.ts` `getAgenda()` / engine `agenda.ts` `needsAttention()` — heuristics that **the brain's real inference replaces**, keeping the same return shapes.
3. `pm-pilot/lib/model.ts` sample arrays — **replaced by real data from the context engine.**

Run it: from repo root, `npm install`, then `npm run dev:pilot` (dashboard at :3000), `npm run sync` + `npm run inspect` (engine).

## 4. Architecture / data flow

```
Slack ─┐                              ┌─ (Phase 3) external docs site /api/docs
       ├─► context-engine ─► store ──►├─► THE BRAIN ─► pm-pilot (dashboard + Ask)
ClickUp┘   (read-only)                └─ store (live items/tasks/people) ┘
```

- **context-engine** = senses + memory (read Slack/ClickUp, normalize, store).
- **brain** = reasoning: retrieves relevant docs (from the external site's API) + relevant live items (from the store), calls an LLM, returns a grounded, cited answer. Built in Phase 3.
- **pm-pilot** = the only UI.

## 5. Build plan — do in order, one at a time

### Phase 1 — Real Slack + ClickUp data
Goal: the context engine holds the user's real project instead of samples.
- Guide the user through creating **read-only** access: Slack token (`channels:history`, `groups:history`, `users:read`) + channel IDs; ClickUp API token + List ID.
- Put them in `apps/context-engine/.env`; set `USE_FIXTURES=false`.
- Harden the real fetch code in `slack.ts` and `clickup.ts` (pagination, error handling, mapping real Slack/ClickUp users to canonical Person records, fetching ClickUp comments).
- **Done when:** `npm run sync` pulls the user's real messages/tasks and `npm run inspect` shows a real "needs you" agenda.

### Phase 2 — Pilot on real data
Goal: the dashboard shows the real store, not sample arrays.
- Extract the normalized model into `packages/model` (the engine's fuller `Item` with `links[]` is the source of truth) and have **both** apps import it, so they can't drift. Reconcile the pilot's simpler model to it (e.g. `Item.taskId` → `links[]`).
- Give the engine a way for the pilot to read the store (a small read API, or have the pilot import the store package).
- Replace `pm-pilot/lib/model.ts` sample data with reads from the store.
- **Done when:** the running dashboard reflects real Slack/ClickUp activity, with agenda/tasks/activity/KPIs all live.

### Phase 3 — The brain
Goal: real, grounded answers + real agenda inference.
- Build a `brain` module: given a question (or the daily-agenda job), retrieve relevant docs from the **user's external docs site API** (`GET /api/docs`, `GET /api/docs/:id` — see §6) and relevant live items from the store, send both to an LLM, return `{ answer, citations[] }`.
- Wire it into seam #1 (`/api/ask`) and seam #2 (replace `needsAttention()` inference), keeping return shapes.
- Add a retrieval index (pgvector) if doc volume warrants; otherwise keyword + direct fetch is fine to start.
- **Done when:** the Ask bar returns grounded, cited answers, and the agenda is generated by the brain rather than the heuristic.

### Phase 4 — Make it a real, private app
- Add authentication (single-user gate — it holds client data; never deploy open).
- Move config to env (LLM key, DB, docs API base URL).
- Deploy privately; prefer a host appropriate for client data.
- Optionally: a scheduled daily agenda that DMs the PM in Slack.
- **Done when:** the PM can reach a private, authenticated, deployed instance with real data.

### Phase 5 — Drift detection (the differentiator)
- Compare recent client/QA activity against the docs (use the docs site's change feed + version history) and flag divergence: "client asked for X, but the spec still says Y."
- Surface flags in the dashboard.
- **Done when:** real divergences are detected and shown to the PM.

## 6. Key contracts

**The user's external docs site must expose (Phase 3 input):**
```
GET /api/docs        -> [{ id, title, status, updated_at }, ...]   (JSON, not HTML)
GET /api/docs/:id    -> { id, title, content, sections: [{ id, title }] }
```
`content` is the raw text the brain ingests. (A change feed + `/versions` endpoint are needed for Phase 5.)

**Brain interface (suggested):**
```
ask(question: string) -> { answer: string, citations: { source: string, ref: string }[] }
buildAgenda() -> the same shape pm-pilot's getAgenda() already returns
```

## 7. Non-goals
- Not a shared workspace; not a Slack/ClickUp replacement.
- No autonomous actions; no writing back to Slack/ClickUp before Phase 4+.
- Don't rebuild the docs site — it's the user's own, external.

## 8. Tech
- **pm-pilot:** Next.js (App Router) + TypeScript.
- **context-engine:** Node + TypeScript, run via tsx.
- **Monorepo:** npm workspaces.
- **Store:** JSON now; move to Postgres (+ pgvector for the brain) when going real.
- **Brain:** an LLM via API. Be deliberate about what context leaves the system, given client data.

## 9. Working style with the user
- Explain in plain language; the user is a PM, not a web-infra specialist.
- Make reasonable choices and proceed; show changes before applying them.
- Prefer one working piece over several half-built ones. Keep docs bypassed until Phase 3.
