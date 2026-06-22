// KPI Builder report engine (PRD §F1, F2, F3, F7).
//
// Principles from the PRD encoded here:
//  - Context always beside the number  → every tile carries a `hint`.
//  - Honest about data quality         → signals we can't compute from the
//    current data model are listed in `deferred` (a quiet footnote) instead of
//    shown as fabricated numbers or loud "—" cells.
//  - Flags are transparent + configurable → thresholds live in THRESHOLDS,
//    and a fired flag explains itself in `hint`.
//
// The dashboard's getTeamKpis() (lib/kpi.ts) is left untouched.

import { loadData } from "./store-reader";
import { db_getKpiInputs } from "./db";
import type { Person, Task, Item } from "./model";

export type Flag = "watch" | "alert";
export type Confidence = "high" | "medium";
export type PeriodKey = "week" | "sprint" | "month" | "custom";

export interface Tile {
  key: string;
  label: string;
  value: string;
  raw: number | null;
  flag?: Flag; // only watch/alert — healthy values stay quiet
  confidence: Confidence; // medium = inferred signal (shown with a subtle marker)
  hint: string; // what it means + why a flag fired (hover)
  muted: boolean; // zero / no signal → rendered dim so empties recede
}

export interface PersonReport {
  person: Person;
  tiles: Tile[]; // the headline signals (auto, from data)
  ratings: Record<string, string>; // manual "your call" ratings, keyed by metricKey
  lastActive: { text: string; flag?: Flag; days: number | null };
  deferred: string[]; // signals that need richer ClickUp data (footnote)
  summary: string; // F7 one-liner
  hasSignal: boolean; // any non-zero number or recent activity
}

export interface ResolvedPeriod {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
}

export interface AreaRow {
  area: string;
  bugs: number;
  escalations: number;
  people: string[]; // names touching this area
}

export interface KpiReport {
  period: ResolvedPeriod;
  developers: PersonReport[];
  qa: PersonReport[];
  areas: AreaRow[]; // F4 — where bugs/escalations cluster (needs ClickUp area, P2)
  clickupConnected: boolean; // drives the connect CTA
  slackConnected: boolean;
}

// ---- Configurable thresholds (PRD: not hardcoded inline). ----

export const THRESHOLDS = {
  // "higher is worse" thresholds
  activeTasks: { watch: 6, alert: 10 },
  bugResponsibility: { watch: 3, alert: 6 },
  escalations: { watch: 2, alert: 4 },
  staleDays: { watch: 5, alert: 10 },
  openBugs: { watch: 4, alert: 8 },
  cycleTimeDays: { watch: 5, alert: 10 }, // P2
  reopenRatePct: { watch: 15, alert: 30 }, // P3
  avgVerifyDays: { watch: 3, alert: 6 }, // P3
  // "lower is worse" thresholds (use flagLow)
  onTimeRatePct: { watch: 80, alert: 60 }, // P2
  verifiedRatePct: { watch: 80, alert: 60 }, // P3
} as const;

// ---- Heuristics (documented assumptions) ----

// Bug detection: prefer real ClickUp tags when present (high confidence),
// otherwise fall back to title/status keywords (medium confidence).
const BUG_RE = /\b(bug|fix|error|crash|broke|broken|regression|hotfix|defect|fault)\b/i;
const BUG_TAG_RE = /bug|defect|hotfix|regression/i;
function isBugTask(t: Task): boolean {
  if (t.tags && t.tags.length) return t.tags.some((tag) => BUG_TAG_RE.test(tag));
  return BUG_RE.test(t.title) || t.status === "blocked";
}
const tagsPresent = (tasks: Task[]) => tasks.some((t) => t.tags && t.tags.length > 0);

const ESCALATION_RE =
  /\b(escalat|incident|urgent|asap|p0|p1|sev[ -]?\d|prod(uction)?\s+(down|issue|bug)|outage|fire|client\s+(reported|issue|down))\b/i;
const isEscalation = (i: Item) => ESCALATION_RE.test(i.body);

const DONE = "done";
const DAY = 86_400_000;
const isDoneStatus = (s: string) => /\b(done|closed|complete|completed|resolved)\b/i.test(s);

// ---- Phase 2/3 metric computations (return null when data is absent) ----

// When did a task finish? Prefer an explicit closedAt, else updatedAt if done.
function finishedAt(t: Task): string | undefined {
  if (t.closedAt) return t.closedAt;
  return t.status === DONE ? t.updatedAt : undefined;
}

// P2 — avg days from start/created → finished, for tasks finished in the period.
function avgCycleDays(tasks: Task[], period: ResolvedPeriod): number | null {
  const durs: number[] = [];
  for (const t of tasks) {
    const end = finishedAt(t);
    const start = t.startDate ?? t.createdAt;
    if (!start || !end || !inRange(end, period)) continue;
    const d = (new Date(end).getTime() - new Date(start).getTime()) / DAY;
    if (d >= 0) durs.push(d);
  }
  return durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null;
}

// P2 — % of tasks finished in the period that landed on/before their due date.
function onTimeRatePct(tasks: Task[], period: ResolvedPeriod): number | null {
  let onTime = 0, total = 0;
  for (const t of tasks) {
    const end = finishedAt(t);
    if (!t.dueDate || !end || !inRange(end, period)) continue;
    total++;
    if (new Date(end).getTime() <= new Date(t.dueDate).getTime()) onTime++;
  }
  return total ? Math.round((onTime / total) * 100) : null;
}

// P3 — % of completed tasks that went done → not-done again (reopened).
function reopenRatePct(tasks: Task[]): number | null {
  let completed = 0, reopened = 0;
  for (const t of tasks) {
    const h = t.statusHistory;
    if (!h || h.length < 2) continue;
    let everDone = false, didReopen = false;
    for (const e of h) {
      if (isDoneStatus(e.status)) everDone = true;
      else if (everDone) didReopen = true;
    }
    if (everDone) { completed++; if (didReopen) reopened++; }
  }
  return completed ? Math.round((reopened / completed) * 100) : null;
}

// P3 — from status history of bug tasks: avg days review→done, and verified %.
function verifyStats(tasks: Task[]): { avgDays: number | null; verifiedPct: number | null } {
  const durs: number[] = [];
  let entered = 0, verified = 0;
  for (const t of tasks) {
    const h = t.statusHistory;
    if (!h || !h.length) continue;
    const ri = h.findIndex((e) => /review|verif|qa|test/i.test(e.status));
    if (ri === -1) continue;
    entered++;
    const done = h.slice(ri + 1).find((e) => isDoneStatus(e.status));
    if (done) {
      verified++;
      const d = (new Date(done.at).getTime() - new Date(h[ri].at).getTime()) / DAY;
      if (d >= 0) durs.push(d);
    }
  }
  return {
    avgDays: durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null,
    verifiedPct: entered ? Math.round((verified / entered) * 100) : null,
  };
}

// ---- period resolution ----

export function resolvePeriod(
  key: string | undefined,
  from?: string,
  to?: string,
): ResolvedPeriod {
  const now = new Date();
  const toIso = now.toISOString();

  if (key === "custom" && from) {
    const f = new Date(from);
    const t = to ? new Date(to) : now;
    return { key: "custom", label: `${fmtDay(f)} – ${fmtDay(t)}`, from: f.toISOString(), to: t.toISOString() };
  }

  const spans = {
    week: { days: 7, label: "This week" },
    sprint: { days: 14, label: "This sprint" },
    month: { days: 30, label: "This month" },
  } as const;
  const k = (key === "week" || key === "month" || key === "sprint" ? key : "sprint") as keyof typeof spans;
  const span = spans[k];
  return {
    key: k,
    label: span.label,
    from: new Date(now.getTime() - span.days * DAY).toISOString(),
    to: toIso,
  };
}

// ---- utils ----

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function inRange(iso: string | undefined, p: ResolvedPeriod): boolean {
  return !!iso && iso >= p.from && iso <= p.to;
}
function relativeTime(iso: string | null): { text: string; days: number | null } {
  if (!iso) return { text: "no activity", days: null };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return { text: "today", days: 0 };
  if (days === 1) return { text: "yesterday", days: 1 };
  if (days < 14) return { text: `${days}d ago`, days };
  if (days < 60) return { text: `${Math.floor(days / 7)}w ago`, days };
  return { text: `${Math.floor(days / 30)}mo ago`, days };
}
function flagHigh(v: number | null, t: { watch: number; alert: number }): Flag | undefined {
  if (v == null) return undefined;
  if (v >= t.alert) return "alert";
  if (v >= t.watch) return "watch";
  return undefined;
}
// For metrics where LOWER is worse (on-time %, verified %).
function flagLow(v: number | null, t: { watch: number; alert: number }): Flag | undefined {
  if (v == null) return undefined;
  if (v <= t.alert) return "alert";
  if (v <= t.watch) return "watch";
  return undefined;
}
function firstName(name: string) {
  return name.split(/\s+/)[0]?.toLowerCase() ?? "";
}

function tile(t: Omit<Tile, "muted"> & { muted?: boolean }): Tile {
  return { ...t, muted: t.muted ?? (t.raw === 0 || t.raw == null) };
}

// ---- developer card (F1) ----

function developerReport(
  person: Person,
  tasks: Task[],
  items: Item[],
  byAuthor: Map<string, Item[]>,
  period: ResolvedPeriod,
  ratings: Record<string, string>,
): PersonReport {
  const assigned = tasks.filter(
    (t) => t.assigneeId === person.id || (t.assigneeIds?.includes(person.id) ?? false),
  );
  const active = assigned.filter((t) => t.status !== DONE).length;
  const completed = assigned.filter((t) => t.status === DONE && inRange(t.updatedAt, period)).length;
  const bugs = assigned.filter((t) => isBugTask(t) && inRange(t.updatedAt, period)).length;
  const bugConf: Confidence = tagsPresent(assigned) ? "high" : "medium";

  const fn = firstName(person.name);
  const mine = byAuthor.get(person.id) ?? [];
  const escalations = items.filter(
    (i) =>
      isEscalation(i) &&
      inRange(i.timestamp, period) &&
      (i.authorId === person.id || (fn.length > 1 && i.body.toLowerCase().includes(fn))),
  ).length;

  const lastItem = mine.reduce<string | null>((m, i) => (!m || i.timestamp > m ? i.timestamp : m), null);
  const lastTask = assigned.reduce<string | null>((m, t) => (!m || t.updatedAt > m ? t.updatedAt : m), null);
  const lastIso = [lastItem, lastTask].filter(Boolean).sort().pop() ?? null;
  const last = relativeTime(lastIso);

  const activeFlag = flagHigh(active, THRESHOLDS.activeTasks);
  const bugFlag = flagHigh(bugs, THRESHOLDS.bugResponsibility);
  const escFlag = flagHigh(escalations, THRESHOLDS.escalations);
  const staleFlag = flagHigh(last.days, THRESHOLDS.staleDays);

  const tiles: Tile[] = [
    tile({
      key: "active", label: "active", value: String(active), raw: active, flag: activeFlag, confidence: "high",
      hint: activeFlag ? `${active} open tasks — at/over the ${THRESHOLDS.activeTasks.watch}-task watch line; possible overload or stalled work.` : "Open tasks assigned, not yet done. Direct from ClickUp.",
    }),
    tile({
      key: "completed", label: "done", value: String(completed), raw: completed, confidence: "high",
      hint: `Tasks marked done in ${period.label.toLowerCase()}.`,
    }),
    tile({
      key: "bugs", label: "bug load", value: String(bugs), raw: bugs, flag: bugFlag, confidence: bugConf,
      hint: bugConf === "high"
        ? (bugFlag ? `${bugs} bug-tagged tasks in their area — confirm it isn't just one complex area.` : "Bug-tagged tasks in their area this period (from ClickUp tags).")
        : (bugFlag ? `${bugs} bug-type tasks — inferred from titles/status; confirm it isn't one complex area.` : "Bug-type tasks in their area this period. Inferred from titles/status."),
    }),
    tile({
      key: "escalations", label: "escalations", value: String(escalations), raw: escalations, flag: escFlag, confidence: "medium",
      hint: escFlag ? `Pulled into ${escalations} incident/urgent threads — are they the go-to firefighter?` : "Times pulled into incident/urgent Slack threads. Inferred from wording.",
    }),
  ];

  // Phase 2/3 metrics — appear as tiles when data exists, else as a deferred footnote.
  const deferred: string[] = [];

  const cycle = avgCycleDays(assigned, period);
  if (cycle != null) {
    const f = flagHigh(cycle, THRESHOLDS.cycleTimeDays);
    tiles.push(tile({
      key: "cycle", label: "cycle time", value: `${cycle.toFixed(1)}d`, raw: cycle, flag: f, confidence: "high", muted: false,
      hint: f ? `Avg ${cycle.toFixed(1)} days start → done — over the ${THRESHOLDS.cycleTimeDays.watch}d watch line.` : "Avg days from task start to done.",
    }));
  } else deferred.push("cycle time");

  const onTime = onTimeRatePct(assigned, period);
  if (onTime != null) {
    const f = flagLow(onTime, THRESHOLDS.onTimeRatePct);
    tiles.push(tile({
      key: "ontime", label: "on-time", value: `${onTime}%`, raw: onTime, flag: f, confidence: "high", muted: false,
      hint: f ? `Only ${onTime}% of due-dated tasks landed on time.` : `${onTime}% of due-dated tasks closed on/before their due date.`,
    }));
  } else deferred.push("on-time delivery");

  const reopen = reopenRatePct(assigned);
  if (reopen != null) {
    const f = flagHigh(reopen, THRESHOLDS.reopenRatePct);
    tiles.push(tile({
      key: "reopen", label: "reopen rate", value: `${reopen}%`, raw: reopen, flag: f, confidence: "high", muted: false,
      hint: f ? `${reopen}% of completed tasks were reopened — rework signal.` : `${reopen}% of completed tasks were later reopened.`,
    }));
  } else deferred.push("reopen rate");

  const bugBit = bugs ? ` · ${bugs} bug${bugs === 1 ? "" : "s"}` : "";
  const escBit = escalations ? ` · ${escalations} escalation${escalations === 1 ? "" : "s"}` : "";
  return {
    person,
    tiles,
    ratings,
    lastActive: { text: last.text, flag: staleFlag, days: last.days },
    deferred,
    summary: `${active} active · ${completed} done${bugBit}${escBit}`,
    hasSignal: active + completed + bugs + escalations > 0 || (last.days != null && last.days < 14),
  };
}

// ---- QA card (F2) ----

function qaReport(
  person: Person,
  tasks: Task[],
  items: Item[],
  byAuthor: Map<string, Item[]>,
  period: ResolvedPeriod,
  ratings: Record<string, string>,
): PersonReport {
  const mine = byAuthor.get(person.id) ?? [];
  const mineInPeriod = mine.filter((i) => inRange(i.timestamp, period));
  const flagged = mineInPeriod.filter((i) => BUG_RE.test(i.body)).length;
  const touched = new Set(mineInPeriod.map((i) => i.taskId).filter(Boolean)).size;
  const bugTasks = tasks.filter((t) => isBugTask(t));
  const openBugs = bugTasks.filter((t) => t.status !== DONE).length;
  const openBugsConf: Confidence = tagsPresent(tasks) ? "high" : "medium";

  const fn = firstName(person.name);
  const escalations = items.filter(
    (i) =>
      isEscalation(i) &&
      inRange(i.timestamp, period) &&
      (i.authorId === person.id || (fn.length > 1 && i.body.toLowerCase().includes(fn))),
  ).length;

  const lastIso = mine.reduce<string | null>((m, i) => (!m || i.timestamp > m ? i.timestamp : m), null);
  const last = relativeTime(lastIso);

  const escFlag = flagHigh(escalations, THRESHOLDS.escalations);
  const openFlag = flagHigh(openBugs, THRESHOLDS.openBugs);
  const staleFlag = flagHigh(last.days, THRESHOLDS.staleDays);

  const tiles: Tile[] = [
    tile({
      key: "flagged", label: "bugs flagged", value: String(flagged), raw: flagged, confidence: "medium",
      hint: "Bug-type reports they raised in Slack/comments this period. Inferred from wording.",
    }),
    tile({
      key: "openBugs", label: "open bugs", value: String(openBugs), raw: openBugs, flag: openFlag, confidence: openBugsConf,
      hint: openFlag ? `${openBugs} bug tasks still open team-wide — the verification queue is building up.` : "Bug tasks still open across the team.",
    }),
    tile({
      key: "coverage", label: "coverage", value: String(touched), raw: touched, confidence: "medium",
      hint: "Distinct task areas their comments touched this period.",
    }),
    tile({
      key: "escalations", label: "escalations", value: String(escalations), raw: escalations, flag: escFlag, confidence: "medium",
      hint: escFlag ? `Pulled into ${escalations} client-reported / incident threads.` : "Times pulled into client-reported issue threads. Inferred from wording.",
    }),
  ];

  // Phase 3 — verification metrics from bug-task status history (team-level).
  const deferred: string[] = [];
  const { avgDays, verifiedPct } = verifyStats(bugTasks);

  if (verifiedPct != null) {
    const f = flagLow(verifiedPct, THRESHOLDS.verifiedRatePct);
    tiles.push(tile({
      key: "verified", label: "verified", value: `${verifiedPct}%`, raw: verifiedPct, flag: f, confidence: "high", muted: false,
      hint: f ? `Only ${verifiedPct}% of bugs that reached review got verified done.` : `${verifiedPct}% of bugs that reached review were verified done.`,
    }));
  } else deferred.push("verified / closed");

  if (avgDays != null) {
    const f = flagHigh(avgDays, THRESHOLDS.avgVerifyDays);
    tiles.push(tile({
      key: "verifyTime", label: "avg verify", value: `${avgDays.toFixed(1)}d`, raw: avgDays, flag: f, confidence: "high", muted: false,
      hint: f ? `Avg ${avgDays.toFixed(1)} days from review → verified — slow verification.` : "Avg days from a fix reaching review to being verified done.",
    }));
  } else deferred.push("avg verify time");

  const escBit = escalations ? ` · ${escalations} escalation${escalations === 1 ? "" : "s"}` : "";
  return {
    person,
    tiles,
    ratings,
    lastActive: { text: last.text, flag: staleFlag, days: last.days },
    deferred,
    summary: `${flagged} bug${flagged === 1 ? "" : "s"} flagged · ${touched} area${touched === 1 ? "" : "s"} covered${escBit}`,
    hasSignal: flagged + touched + escalations > 0 || (last.days != null && last.days < 14),
  };
}

// ---- public entry point ----

export function getKpiReport(opts?: { period?: string; from?: string; to?: string }): KpiReport {
  const { people, tasks, items } = loadData();
  const period = resolvePeriod(opts?.period, opts?.from, opts?.to);

  const byAuthor = new Map<string, Item[]>();
  for (const i of items) {
    const list = byAuthor.get(i.authorId) ?? [];
    list.push(i);
    byAuthor.set(i.authorId, list);
  }

  // Manual PM inputs (read fresh — page is force-dynamic, no caching needed here).
  // Keyed person -> { metricKey -> value } so any manual rating flows through.
  const ratingsByPerson = new Map<string, Record<string, string>>();
  for (const row of db_getKpiInputs()) {
    if (!row.value) continue;
    const r = ratingsByPerson.get(row.person_id) ?? {};
    r[row.metric_key] = row.value;
    ratingsByPerson.set(row.person_id, r);
  }
  const ratingsFor = (id: string) => ratingsByPerson.get(id) ?? {};

  const roster = Object.values(people);
  const developers = roster
    .filter((p) => p.role === "developer")
    .map((p) => developerReport(p, tasks, items, byAuthor, period, ratingsFor(p.id)))
    .sort((a, b) => Number(b.hasSignal) - Number(a.hasSignal) || a.person.name.localeCompare(b.person.name));
  const qa = roster
    .filter((p) => p.role === "qa")
    .map((p) => qaReport(p, tasks, items, byAuthor, period, ratingsFor(p.id)))
    .sort((a, b) => Number(b.hasSignal) - Number(a.hasSignal) || a.person.name.localeCompare(b.person.name));

  return {
    period,
    developers,
    qa,
    areas: buildAreas(tasks, items, people),
    clickupConnected: tasks.length > 0,
    slackConnected: items.length > 0,
  };
}

// F4 — cluster bugs & escalations by ClickUp area (needs P2 `area` field).
function buildAreas(tasks: Task[], items: Item[], people: Record<string, Person>): AreaRow[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const map = new Map<string, { bugs: number; escalations: number; people: Set<string> }>();
  for (const t of tasks) {
    if (!t.area) continue;
    const a = map.get(t.area) ?? { bugs: 0, escalations: 0, people: new Set<string>() };
    if (isBugTask(t)) a.bugs++;
    if (t.assigneeId && people[t.assigneeId]) a.people.add(people[t.assigneeId].name);
    map.set(t.area, a);
  }
  for (const i of items) {
    if (!isEscalation(i) || !i.taskId) continue;
    const t = taskById.get(i.taskId);
    if (!t?.area) continue;
    map.get(t.area)!.escalations++;
  }
  return [...map.entries()]
    .map(([area, v]) => ({ area, bugs: v.bugs, escalations: v.escalations, people: [...v.people] }))
    .filter((a) => a.bugs > 0 || a.escalations > 0)
    .sort((a, b) => b.bugs + b.escalations - (a.bugs + a.escalations));
}
