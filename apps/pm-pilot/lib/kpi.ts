import { loadData } from "./store-reader";
import type { Person } from "./model";

export type Flag = "good" | "watch" | "alert";
export interface Metric { label: string; value: string; flag?: Flag; }
export interface KpiRow { person: Person; metrics: Metric[]; }

export function getTeamKpis(): { developers: KpiRow[]; qa: KpiRow[] } {
  const { people, tasks } = loadData();

  const developers: KpiRow[] = Object.values(people)
    .filter((p) => p.role === "developer")
    .map((person) => {
      const assigned = tasks.filter((t) => t.assigneeId === person.id);
      const active = assigned.filter((t) => t.status !== "done").length;
      const done = assigned.filter((t) => t.status === "done").length;
      return {
        person,
        metrics: [
          { label: "active tasks", value: String(active) },
          { label: "completed", value: String(done) },
        ],
      };
    });

  const qa: KpiRow[] = Object.values(people)
    .filter((p) => p.role === "qa")
    .map((person) => {
      const raised = tasks.filter((t) =>
        t.status === "blocked" || t.status === "in_review",
      ).length;
      return {
        person,
        metrics: [
          { label: "tasks in review", value: String(raised) },
        ],
      };
    });

  return { developers, qa };
}
