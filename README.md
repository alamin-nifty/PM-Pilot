# Keystone (monorepo)

One repository, two apps. Each is its own separate project — the monorepo just
keeps them together and lets you run either from the root.

```
keystone/
  apps/
    context-engine/   # read-only Slack + ClickUp -> context store (Node)
    pm-pilot/         # the dashboard you open, with the KPI panel (Next.js)
  packages/           # shared code goes here later
  package.json        # workspaces + the root commands below
```

**Your docs site lives outside this repo** — it's your own site. The brain will
read it later through its content API (see the Docs Portal conventions doc). For
now the docs are bypassed, so you don't need it to run anything here.

## One-time setup

```bash
npm install
```

Installs both apps at once (shared dependencies stored once at the root).

## Run things — from the root

```bash
npm run dev:pilot     # the dashboard           -> http://localhost:3000
npm run sync          # pull Slack/ClickUp into the store (sample data for now)
npm run inspect       # see the store + agenda
npm run build:pilot   # production build of the dashboard
```

## What each app is

- pm-pilot — the screen you open. Runs on its own sample data today, so it works
  with nothing else wired up. Start here.
- context-engine — pulls Slack + ClickUp into one store. Runs on sample data now;
  point it at real read-only tokens when you're ready, then feed its data into
  the pilot. This is your next real build after you've seen the pilot run.

## Order of work

1. npm install, then npm run dev:pilot — see the dashboard.
2. Give the context-engine real Slack/ClickUp tokens and npm run sync.
3. Point the pilot at the engine's real data instead of its samples.
4. Later: add a content API to your docs site and wire the brain to read it.

The docs stay on dummy/bypassed until step 4 — don't let them block you.
