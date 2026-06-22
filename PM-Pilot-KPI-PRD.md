# PM Pilot — KPI Builder: Product Requirements Document

**Route:** `/kpi` inside `apps/pm-pilot`
**Version:** 0.1
**Owner:** PM (the only user)
**Status:** draft

---

## 1. Problem

The dashboard's KPI panel gives a quick pulse — a few numbers per person. But
when the PM needs to investigate ("why has this sprint been slow?", "who's being
pulled into every fire?", "which area keeps producing bugs?") there's no place to
go deeper. The PM ends up piecing it together manually from ClickUp filters and
Slack threads. The KPI Builder is the dedicated page for that deeper view.

---

## 2. What it is

A **PM-only, read-only performance intelligence page** at `/kpi`. It surfaces
structured signals about how the team — developers and QA — is actually
performing, grouped, filterable, and always paired with enough context that the
numbers can't be misread. It is not a scorecard and not visible to anyone but
the PM.

---

## 3. Core principles

- **Context always beside the number.** Every metric shows what it means and why
  it matters, not just a raw figure. A reopen rate of 20% reads differently if
  the developer owns the most complex area.
- **Team health over individual blame.** Where possible, prefer signals that
  point to *where work is piling up* over signals that single out a person.
- **PM-only, always.** This page is never shared, never emailed, never
  exported to a format the team can see.
- **Conversation-starter, not verdict.** The PM uses these signals to ask better
  questions, not to make automated decisions.
- **Honest about data quality.** If a metric is based on thin data or inference,
  say so — a labeled "low confidence" beats a confident wrong number.

---

## 4. Who uses it

**Only the PM.** No other role accesses this page. Developers and QA never see
their own or each other's signals here.

---

## 5. Features

### The basis — six dimensions

Metrics aren't chosen because they're easy to count; each one earns its place by
belonging to **one of six dimensions** that together describe how a person's work
is going. A dimension with no real metric yet is shown as a *visible gap*, never
faked. This is the answer to "on what basis were these chosen."

| Dimension | What it tells the PM |
|---|---|
| **Output** | Is work actually crossing the line? |
| **Flow / Speed** | How long does work take? Slow flow exposes hidden blockers. |
| **Quality** | Does it hold up, or come back as rework? |
| **Reliability** | Does it land when promised? |
| **Communication** | Are they engaged, unblocking others, not a black box? |
| **Presence / Load** | Are they active, and is the load survivable? |

**How to read the tables below.** *Source* = where the value comes from.
*Type* = `auto` (computed from data) or `manual` (the PM's "your call" rating).
*Tier* = data readiness: **NOW** works today · **P2** needs a small ClickUp
connector change · **P3** needs ClickUp status history. *Confidence* = how much to
trust it (`high` = direct field, `medium` = inferred). See §7 and §9.

### F1 — Developer KPI cards
One card per developer, organised by dimension:

| Dimension | Metric | Source | Type | Tier | Confidence |
|---|---|---|---|---|---|
| Output | Completed (period) | ClickUp | auto | NOW | high |
| Flow | Cycle time (start → done) | ClickUp | auto | P2 | — until P2 |
| Quality | Bug load (bugs in their area) | ClickUp | auto | NOW → P2 | medium → high (tags) |
| Quality | Reopen rate | ClickUp | auto | P3 | — until P3 |
| Reliability | On-time delivery (vs due date) | ClickUp | auto | P2 | — until P2 |
| Reliability | **Delivery rating** | PM | manual | NOW | your call |
| Communication | **Communication rating** | PM | manual | NOW | your call |
| Presence / Load | Active tasks · Last active | ClickUp + Slack | auto | NOW | high |
| Presence / Load | Escalation load | Slack | auto | NOW | medium |

**Status flags** — each auto metric carries a flag: `good` (green, invisible),
`watch` (amber), `alert` (red) — thresholds are configurable, not hardcoded
(`THRESHOLDS` in `lib/kpi-report.ts`). Flag logic is transparent: hovering a
metric shows why it fired.

### F2 — QA KPI cards
One card per QA, organised by the same dimensions:

| Dimension | Metric | Source | Type | Tier | Confidence |
|---|---|---|---|---|---|
| Output | Bugs flagged (period) | ClickUp/Slack | auto | NOW → P2 | medium → high (tags) |
| Flow | Avg time to verify | ClickUp | auto | P3 | — until P3 |
| Quality | Verified / closed | ClickUp | auto | P3 | — until P3 |
| Reliability | Open bugs (team) | ClickUp | auto | NOW | medium |
| Reliability | **Delivery rating** | PM | manual | NOW | your call |
| Communication | **Communication rating** | PM | manual | NOW | your call |
| Presence / Load | Coverage breadth · Last active | ClickUp + Slack | auto | NOW → P2 | medium → high (area) |
| Presence / Load | Escalation load | Slack | auto | NOW | medium |

### F3 — Period selector
Filter all signals by: **this week / this sprint / this month / custom range.**
All cards update together. Default: current sprint (or last 14 days if sprint
isn't defined).

### F4 — Area / feature breakdown
A secondary view showing **where** bugs cluster and where escalations are coming
from — by task area, feature, or ClickUp folder/list — rather than just by
person. This is the team-health lens that avoids individual blame while still
showing where the fire is.

### F5 — Trend sparklines
Small inline charts (one per metric per person) showing the last 4–6 periods at
a glance, so the PM can see whether a signal is improving, stable, or getting
worse — not just what it is today.

### F6 — Context notes (PM-only annotations)
The PM can attach a private text note to any card or metric — e.g. "Bob's
reopen rate is high this sprint because he's carrying the auth refactor, which
has unpredictable scope." Notes are stored locally (or in the store) and visible
only to the PM. They appear inline alongside the metric so the PM doesn't lose
the context they've built up.

### F7 — At-a-glance summary row
At the top of the page: a one-line summary per person: "Priya: 3 active, 5
done, 8% reopen, 1 escalation — trending stable." This is the TL;DR the PM
reads in 10 seconds before diving into cards. Manual ratings (F8) appear here as
small pills.

### F8 — Manual ratings (the hybrid "your call" layer)
Some dimensions can't be measured from data — no feed knows whether someone
*communicates* well or *reliably* delivers. For those, the PM rates each person
directly. Built now: **Communication** (Strong / OK / Watch) and **Delivery**
(Reliable / Mixed / Slipping). Ratings are stored in SQLite (`kpi_input` table,
keyed by person + metric), shown on each card under a dashed divider labelled
"your call", and never blended into an automatic number — they sit beside the
auto metrics as the PM's explicit judgment. The mechanism is generic, so adding
more manual ratings (e.g. Quality) later is a config change, not a rebuild.

---

## 6. What it is NOT

- Not a leaderboard — no ranking of developers against each other.
- Not automated consequences — no alerts sent to developers based on their KPIs.
- Not a replacement for 1:1s — numbers spark the conversation, they don't replace it.
- Not public — no sharing, exporting, or making visible to the team.

### Excluded by principle
These look like common "metrics" but are deliberately **not** measured, because
they mislead more than they inform:

- **Lines of code / number of commits** — rewards volume and typing, not value.
- **Story-point velocity as a target** — gameable the moment it's a goal.
- **Cross-person ranking / leaderboards** — breaks trust, fuels blame.

Leaving these out is a design decision, not an oversight.

---

## 7. Data sources and confidence

Confidence is shown on every metric (the Tier/Confidence columns in §5). The rule:

- **`high`** — a direct ClickUp/Slack field (e.g. completed, active, last active).
- **`medium`** — inferred (bug load from title/status keywords, escalations from
  Slack wording, coverage from task links). Carries a subtle marker + an honest hint.
- **`— / deferred`** — can't be computed with the data we have yet; shown as a
  quiet "needs ClickUp history" footnote, **never** as a fake number.

| Signal | Confidence now | What promotes it |
|---|---|---|
| Active / completed / last active | High | — |
| Bug load · bugs flagged | Medium | ClickUp **tags** instead of keyword guessing (P2 → high) |
| Escalation load | Medium | Consistent naming in Slack incident threads |
| Coverage breadth | Medium | ClickUp folder/space as the area (P2 → high) |
| Cycle time · on-time delivery | deferred | ClickUp `date_created` / `date_closed` / `due_date` (P2) |
| Reopen rate · verified-closed · avg verify time | deferred | ClickUp **status history** (P3) |

When confidence is medium or deferred, the card says so. The PM always sees what
the number is *based on*, not just what it is.

---

## 8. UI layout (the page)

```
/kpi

[ Period selector: This week / This sprint / This month / Custom ]

[ Summary row: one line per person — quick overview ]

─── Developers ──────────────────────────────────────────────────
[ Card: Priya ]          [ Card: Bob ]          [ Card: ... ]
  Active: 2                Active: 3
  Done: 5                  Done: 1
  Cycle time: 3.2d         Cycle time: 6.1d ▲ watch
  Reopen: 8% ✓             Reopen: 22% ⚠ watch
  Bugs: 1                  Bugs: 3
  Escalations: 1           Escalations: 3 🔴 alert
  [PM note: ...]           [PM note: ...]

─── QA ──────────────────────────────────────────────────────────
[ Card: Sam ]
  Raised: 14  Verified: 11  Open: 3
  Reopen rate: 9% ✓
  Escalations: 2
  Avg verify time: 1.4d

─── Area / Feature breakdown ────────────────────────────────────
[ Auth ]   5 bugs  2 escalations  → Bob, Sam
[ Payments ] 3 bugs  1 escalation → Priya, Sam
```

Cards are scannable top-to-bottom. Flags draw the eye; green is invisible so
the PM focuses on amber and red. PM notes fold open on click.

---

## 9. Roadmap

The roadmap is driven by **data availability**, not feature numbers — most metrics
are blocked only by which fields the ClickUp sync captures, not by being impossible.

**Phase 1 — now (no connector change).** Built: developer + QA cards (F1, F2),
period selector (F3), summary row (F7), and the manual ratings layer (F8 —
Communication + Delivery). Live auto metrics: active, completed, bug load
(inferred), escalations (inferred), coverage, open bugs, last active. Deferred
metrics show as an honest footnote. *Action to light up the auto side: connect
ClickUp in Settings → Run sync.*

**Phase 2 — small ClickUp connector upgrade.** Capture `date_created`,
`date_closed`, `due_date`, `start_date`, `tags`, `priority`, and folder/space
(area) from ClickUp. Unlocks **cycle time**, **on-time delivery**, accurate bug
typing (tags instead of keywords → bug metrics go medium → high), and the **area /
feature breakdown (F4)**. Files: `connectors/clickup.ts`, both `model.ts`,
`store-reader.ts`, `lib/kpi-report.ts`.

**Phase 3 — status history.** Ingest ClickUp status transitions (history endpoint
or webhooks). The only thing that unlocks **reopen rate**, **verified / closed**,
and **avg time to verify**. Heavier (one history call per task on sync), so it's
last. Trend sparklines (F5) also land here, once 2+ periods of history exist.

**Later / optional** — F6 (PM free-form notes) and more manual ratings (e.g.
Quality) — trivial additions on the existing `kpi_input` table when wanted.

---

## 10. Success metrics (for the PM)

- PM opens the KPI page before a sprint retro or 1:1 and finds it saves
  reconstruction time.
- At least one meaningful conversation is started from a KPI signal that the PM
  would have missed in the normal Slack/ClickUp flow.
- No metric is ever presented to anyone other than the PM.

---

## 11. Open questions

- What does a "sprint" mean in your ClickUp setup — is there a sprint field, or
  do you use date ranges? (Decides how the period selector works.)
- Are bugs a separate task type/label in ClickUp, or just tasks with a certain
  status? (Decides how bug metrics are computed.)
- Do you want the summary row as an email/Slack DM before standups, or just
  visible on the page?
