// Weekly manual scorecard engine. For a given week, reads each person's 0–5
// scores per index from the database, totals them, and computes a trend vs. last week.

import { db_getScores, db_getPeople } from "./db";
import { SCALE, indexesFor } from "./indexes";

// People come straight from the database (person_config) — the source of truth.
export interface Person { id: string; name: string; role: string; }

// ---- week helpers (a "week" is its Monday as YYYY-MM-DD, in local time) ----

const DAY = 86_400_000;

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
/** Parse "YYYY-MM-DD" into a local Date (avoids UTC off-by-one). */
function parse(week: string): Date {
  const [y, m, d] = week.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
export function mondayOf(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay(); // 0=Sun..6=Sat
  date.setDate(date.getDate() + ((dow === 0 ? -6 : 1) - dow));
  return fmt(date);
}
export function currentWeek(): string {
  return mondayOf(new Date());
}
export function shiftWeek(week: string, deltaWeeks: number): string {
  return fmt(new Date(parse(week).getTime() + deltaWeeks * 7 * DAY));
}
/** "Jun 22 – 28" (adds year only when it helps). */
export function weekLabel(week: string): string {
  const mon = parse(week);
  const sun = new Date(mon.getTime() + 6 * DAY);
  const mo = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const sameMonth = mon.getMonth() === sun.getMonth();
  return `${mo(mon)} – ${sameMonth ? sun.getDate() : mo(sun)}`;
}

// ---- scorecard ----

export type Trend = "up" | "down" | "flat" | "new";

export interface PersonScore {
  person: Person;
  scores: Record<string, number>; // indexKey -> 0..5 (only scored indexes)
  scoredCount: number;
  applicableCount: number;
  total: number;
  maxTotal: number;
  prevTotal: number | null; // last week's total (null = nothing scored last week)
  delta: number | null; // total - prevTotal
  trend: Trend;
}

export interface Scorecard {
  week: string;
  developers: PersonScore[];
  qa: PersonScore[];
  hasPeople: boolean;
}

export async function getScorecard(week: string): Promise<Scorecard> {
  const prevWeek = shiftWeek(week, -1);

  // People (with roles) come purely from the database now.
  const peopleRows = await db_getPeople();
  const people: Person[] = peopleRows
    .filter((p) => p.hidden === 0)
    .map((p) => ({ id: p.id, name: p.name, role: p.role }));

  const index = (rows: { person_id: string; index_key: string; value: number }[]) => {
    const m = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const o = m.get(r.person_id) ?? {};
      o[r.index_key] = r.value;
      m.set(r.person_id, o);
    }
    return m;
  };
  const [curRows, prevRows] = await Promise.all([db_getScores(week), db_getScores(prevWeek)]);
  const cur = index(curRows);
  const prev = index(prevRows);

  const build = (p: Person): PersonScore => {
    const applicable = indexesFor(p.role);
    const saved = cur.get(p.id) ?? {};
    const prevSaved = prev.get(p.id) ?? null;

    const scores: Record<string, number> = {};
    let total = 0, scoredCount = 0;
    for (const idx of applicable) {
      if (idx.key in saved) { scores[idx.key] = saved[idx.key]; total += saved[idx.key]; scoredCount++; }
    }

    let prevTotal: number | null = null;
    if (prevSaved) {
      prevTotal = 0;
      for (const idx of applicable) if (idx.key in prevSaved) prevTotal += prevSaved[idx.key];
    }
    const delta = prevTotal == null ? null : total - prevTotal;
    const trend: Trend =
      prevTotal == null ? "new" : delta! > 0 ? "up" : delta! < 0 ? "down" : "flat";

    return {
      person: p, scores, scoredCount, applicableCount: applicable.length,
      total, maxTotal: applicable.length * SCALE.max, prevTotal, delta, trend,
    };
  };

  const roster = Object.values(people);
  const sort = (a: PersonScore, b: PersonScore) => a.person.name.localeCompare(b.person.name);
  const developers = roster.filter((p) => p.role === "developer").map(build).sort(sort);
  const qa = roster.filter((p) => p.role === "qa").map(build).sort(sort);

  return { week, developers, qa, hasPeople: developers.length + qa.length > 0 };
}
