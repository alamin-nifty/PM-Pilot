import { PEOPLE, TASKS, type Person } from "./model";

/**
 * Team performance signals for developers and QAs.
 *
 * IMPORTANT (read before trusting these): crude developer/QA metrics create
 * perverse incentives. These are PM-only conversation-starters, not scorecards.
 * Task counts are derived from the store; the softer signals (reopen rate,
 * escalations) would come from the context engine's KPI engine in production —
 * here they're seeded so you can see the shape.
 */

export type Flag = "good" | "watch" | "alert";
export interface Metric { label: string; value: string; flag?: Flag; }
export interface KpiRow { person: Person; metrics: Metric[]; }

const DEV_SIGNALS: Record<string, { reopenRate: number; escalations: number }> = {
  p_priya: { reopenRate: 0.08, escalations: 1 },
  p_bob: { reopenRate: 0.22, escalations: 3 },
};

const QA_SIGNALS: Record<string, { raised: number; verified: number; escalations: number }> = {
  p_sam: { raised: 14, verified: 11, escalations: 2 },
};

export function getTeamKpis(): { developers: KpiRow[]; qa: KpiRow[] } {
  const developers: KpiRow[] = Object.values(PEOPLE)
    .filter((p) => p.role === "developer")
    .map((person) => {
      const assigned = TASKS.filter((t) => t.assigneeId === person.id);
      const active = assigned.filter((t) => t.status !== "done").length;
      const done = assigned.filter((t) => t.status === "done").length;
      const sig = DEV_SIGNALS[person.id] ?? { reopenRate: 0, escalations: 0 };
      return {
        person,
        metrics: [
          { label: "active tasks", value: String(active) },
          { label: "completed", value: String(done) },
          { label: "reopen rate", value: `${Math.round(sig.reopenRate * 100)}%`, flag: sig.reopenRate > 0.15 ? "watch" : "good" },
          { label: "escalations", value: String(sig.escalations), flag: sig.escalations >= 3 ? "alert" : undefined },
        ],
      };
    });

  const qa: KpiRow[] = Object.values(PEOPLE)
    .filter((p) => p.role === "qa")
    .map((person) => {
      const sig = QA_SIGNALS[person.id] ?? { raised: 0, verified: 0, escalations: 0 };
      const openBugs = sig.raised - sig.verified;
      return {
        person,
        metrics: [
          { label: "bugs raised", value: String(sig.raised) },
          { label: "verified", value: String(sig.verified) },
          { label: "open", value: String(openBugs), flag: openBugs > 5 ? "watch" : undefined },
          { label: "escalations", value: String(sig.escalations) },
        ],
      };
    });

  return { developers, qa };
}
