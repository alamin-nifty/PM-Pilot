// The manual scorecard "indexes" — the criteria the PM scores each person on.
// Pure config (no server imports) so the client control and the server can both
// import it. Add a new index here and it appears everywhere automatically.

export const SCALE = { min: 0, max: 5 } as const;

export type ScoreRole = "developer" | "qa";

export interface ScoreIndex {
  key: string; // stored in kpi_input.metric_key
  name: string;
  description: string; // what you're scoring; higher is always better
  roles: ScoreRole[]; // which roles this index applies to
}

export const INDEXES: ScoreIndex[] = [
  {
    key: "requirement_insight",
    name: "Requirement insight",
    description:
      "When a feature is requested, did they catch the unstated needs and the full scope — not just the literal ask?  (5 = caught everything · 0 = only built the literal ask)",
    roles: ["developer"],
  },
  {
    key: "recurring_bugs",
    name: "Recurring bugs",
    description:
      "Do the same bugs keep coming back from them, or do their fixes hold?  (5 = fixes hold, nothing recurs · 0 = the same bugs keep returning)",
    roles: ["developer"],
  },
  {
    key: "communication",
    name: "Communication",
    description: "Do they flag blockers early and keep you updated?  (5 = always · 0 = goes dark)",
    roles: ["developer", "qa"],
  },
  {
    key: "delivery",
    name: "Delivery",
    description: "Do they deliver what they committed, on time?  (5 = reliably · 0 = often slips)",
    roles: ["developer", "qa"],
  },
];

export function indexesFor(role: string): ScoreIndex[] {
  return INDEXES.filter((i) => i.roles.includes(role as ScoreRole));
}
