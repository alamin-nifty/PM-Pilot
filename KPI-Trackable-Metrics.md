# Trackable KPIs — what our system can measure per person

**Purpose:** a menu of the performance signals the KPI tool can track for developers
and QA, so we can agree on which ones to use. Metrics aren't picked at random — each
belongs to one of **six dimensions** that together describe how a person's work is going:

> **Output** · **Flow/Speed** · **Quality** · **Reliability** · **Communication** · **Presence/Load**

Readiness key:
- **🟢 Live now** — works today, no extra setup (the manual judgment ratings).
- **🔵 Auto on data** — populates automatically the moment ClickUp tasks are syncing.
- **🟠 Needs extra setup** — needs ClickUp status-history (via webhooks); a follow-up.
- All "auto" metrics also depend on connecting our data sources — see the note at the end.

---

## Developer metrics

| Dimension | Metric | What it measures | Source | Readiness |
|---|---|---|---|---|
| Output | **Completed** | tasks finished in the period | ClickUp | 🔵 Auto on data |
| Presence/Load | **Active tasks** | open tasks assigned (current workload) | ClickUp | 🔵 Auto on data |
| Flow | **Cycle time** | avg days from start → done | ClickUp | 🔵 Auto on data |
| Quality | **Bug load** | bug-type tasks in their area | ClickUp (tags) | 🔵 Auto on data |
| Quality | **Reopen rate** | % of finished tasks later reopened (rework) | ClickUp history | 🟠 Needs setup |
| Reliability | **On-time delivery** | % of tasks closed on/before their due date | ClickUp | 🔵 Auto on data |
| Reliability | **Delivery rating** | PM's call: reliable / mixed / slipping | PM judgment | 🟢 Live now |
| Communication | **Communication rating** | PM's call: strong / ok / watch | PM judgment | 🟢 Live now |
| Communication | **Escalation load** | how often pulled into incident/urgent threads | Slack | 🔵 Auto on data |
| Presence/Load | **Last active** | last message or task update | Slack + ClickUp | 🔵 Auto on data |

## QA metrics

| Dimension | Metric | What it measures | Source | Readiness |
|---|---|---|---|---|
| Output | **Bugs flagged** | bug reports they raised in the period | ClickUp/Slack | 🔵 Auto on data |
| Reliability | **Open bugs (team)** | bug tasks still open across the team | ClickUp | 🔵 Auto on data |
| Quality | **Verified / closed** | bugs confirmed fixed vs. reopened | ClickUp history | 🟠 Needs setup |
| Flow | **Avg time to verify** | days from a fix filed → verified | ClickUp history | 🟠 Needs setup |
| Presence/Load | **Coverage breadth** | how many task areas/features they touched | ClickUp | 🔵 Auto on data |
| Reliability / Comm | **Delivery & Communication ratings** | PM's judgment calls | PM judgment | 🟢 Live now |
| Communication | **Escalation load** | pulled into client-reported issues | Slack | 🔵 Auto on data |
| Presence/Load | **Last active** | last message or task update | Slack + ClickUp | 🔵 Auto on data |

## Team-health view (not per person)

| Metric | What it measures | Source | Readiness |
|---|---|---|---|
| **Area / feature breakdown** | where bugs & escalations cluster (by ClickUp list/folder) | ClickUp | 🔵 Auto on data |

Every metric carries a **confidence label** (high = direct from the source, medium =
inferred) and a **flag** (green = fine, amber = watch, red = alert) with configurable
thresholds, and hovering any number explains why it flagged.

---

## What we deliberately do NOT track (and why)

- **Lines of code / number of commits** — rewards volume, not value; misleading.
- **Story-point velocity as a target** — gets gamed the moment it's a goal.
- **Ranking people against each other** — breaks trust, fuels blame.

These are intentional exclusions, not gaps.

---

## Note on getting real data flowing

The metrics above are what the tool *can* compute. Today the cards are empty because:

1. **ClickUp isn't feeding tasks yet.** The API token works, but the account it belongs
   to currently has no access to any space/list in our workspaces — so there are no tasks
   to read. Fix: give that account access to the relevant ClickUp list(s), then point the
   tool at a List ID. After that, every 🔵 metric populates automatically.
2. **Slack has one low-activity channel connected.** Adding the channels where the team
   actually works gives richer escalation / last-active signals.
3. The 🟠 metrics (reopen rate, verify time) additionally need ClickUp **status-history**,
   which requires a webhook hookup — a small follow-up once the basics are flowing.

**Bottom line for the senior:** the 🟢 ratings work today; the 🔵 set (most of the list —
output, cycle time, on-time, bug load, escalations, coverage, area breakdown) all come
online automatically as soon as ClickUp access is sorted; the 🟠 two need one extra step.
