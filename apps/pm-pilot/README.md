# Keystone — PM Pilot

The screen the PM actually opens. A working dashboard that shows **what needs
you today**: open questions from the client/QA grouped by person, the tasks
waiting on you, and the combined Slack + ClickUp activity — plus an "ask" bar
that's already wired to the brain's retrieval seam.

Runs on sample data out of the box.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

## What you're looking at

- **Hero** — a count of everything that needs you today.
- **Open questions, by person** — client/QA questions grouped by who you'd reply
  to, each tagged with the task it relates to.
- **Tasks** — sorted so the ones that usually need you (blocked, in review) come
  first, with status and assignee.
- **Activity** — the normalized Slack + ClickUp feed.
- **Ask bar** (top right) — type a question; it returns the live context the
  brain *would* reason over. Retrieval works today; the reasoning step is the
  brain, built next.

## How it's wired

```
lib/model.ts     normalized people / tasks / items  (+ sample data)
lib/agenda.ts    getAgenda(), allTasks(), recentItems(), gatherContext()
app/page.tsx     the dashboard (reads lib directly, server-rendered)
app/AskBrain.tsx the ask bar (client) → POST /api/ask
app/api/*        agenda · tasks · items · ask  (JSON over the same lib)
```

Two seams are deliberate and honest:

1. **Data source.** `lib/model.ts` holds sample data so the pilot runs alone. In
   production this reads from the context engine's store instead — swap the data
   source, the UI doesn't change.
2. **The brain.** `/api/ask` runs real retrieval (`gatherContext`) but returns
   the matched context rather than a reasoned answer. When you build the brain,
   it consumes that same context (plus your docs) and produces the answer — the
   UI and the seam are already in place.

## Going real

- Point `lib/agenda.ts` at the context engine's store/API instead of the sample
  arrays.
- Replace the body of `/api/ask` with a call to the brain.
- Add auth (this is a single-user PM tool — keep it private).

Everything the PM sees is already here; what's left is feeding it real data and
adding the reasoning step.

## Team performance (developer & QA KPIs)

The dashboard includes a **Team performance** panel: per-developer signals
(active tasks, completed, reopen rate, escalations) and per-QA signals (bugs
raised, verified, open, escalations), served from `/api/kpi` (`lib/kpi.ts`).

Task counts derive from the store; the softer signals (reopen rate, escalations)
are seeded here and would come from the context engine's KPI engine in
production. **These are PM-only conversation-starters, not scorecards** — crude
individual metrics create bad incentives, so the panel pairs every number with
context and stays private to you.
