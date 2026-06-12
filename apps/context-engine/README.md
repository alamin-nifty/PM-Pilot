# Keystone — Context Engine (starter)

The **senses + memory** layer: read-only connectors that pull from Slack and
ClickUp, normalize everything into one shared model, and store it as the
project's live state. This is the layer the brain reads from. It assumes the
docs-portal foundation already exists elsewhere.

It runs on **built-in sample data with no credentials**, so you can see the
whole pipeline before wiring real tokens.

## Quick start

```bash
npm install
npm run sync      # backfill connectors → context store (sample data by default)
npm run inspect   # show the store + today's agenda
```

You'll see normalized items from both sources, tasks with their linked
messages, and a generated agenda grouping open client/QA questions by person.

## What it does

```
src/model.ts            normalized model: Person, Item, Task, Link  (+ task-link detection)
src/store.ts            context store (JSON now, swap to Postgres later — one file)
src/connectors/
  types.ts              the Connector interface + mock people directory
  slack.ts              read-only Slack (real path gated by token; mock path default)
  clickup.ts            read-only ClickUp (same pattern)
src/sync.ts             backfill every enabled connector into the store
src/agenda.ts           heuristic "needs your attention" + the retrieval seam for the brain
src/inspect.ts          print the store + agenda
```

The one rule that keeps it clean: **only `connectors/*` knows a vendor's
format.** Everything else works on the normalized model, so adding Jira/Linear
later is one new file.

## Going from sample data to real

Copy `.env.example` → `.env` and fill in:

- `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_IDS` — read-only scopes: `channels:history`, `groups:history`, `users:read`.
- `CLICKUP_API_TOKEN` + `CLICKUP_LIST_ID` — read-only.
- Set `USE_FIXTURES=false` once real tokens are in.

A connector flips from mock to real automatically when its token is present.
The real fetch paths are intentionally minimal — confirm scopes and wire your
channel/list ids. (The verified path in this starter is the sample-data path.)

## Two things to know

**Linking is explicit for now.** A message is tied to a task when it mentions
the task id (`CU-47`) or a ClickUp task URL — the MVP strategy from the
architecture. Inferred linking comes later. `reindexLinks()` rebuilds all links
after a sync so connector order never matters.

**The agenda is a heuristic placeholder.** `needsAttention()` in `agenda.ts`
flags questions from client/QA and tasks that are blocked/in-review. It's
deliberately dumb so the engine is useful *now*. When you build the brain, you
replace that one function with real inference — the brain reads the same store
through the query methods, and `gatherContext()` is the retrieval seam it plugs
into. Nothing else changes.

## Where this sits in the build

1. Docs portal — the ground truth *(done, your side)*.
2. **Context engine — this** *(senses + memory)*.
3. The brain — retrieval + reasoning over the portal's docs **and** this store,
   replacing the heuristics with real inference, plus the scheduled daily agenda.

Don't wire the brain until this store reflects real project activity you trust.
