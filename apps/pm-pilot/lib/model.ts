// Normalized model + sample data. In the real product this comes from the
// context engine's store; here it's seeded so the pilot runs standalone.

export type Role = "client" | "qa" | "developer" | "pm";
export type Source = "slack" | "clickup";
export type TaskStatus = "open" | "in_progress" | "blocked" | "in_review" | "done";

export interface Person { id: string; name: string; role: Role; }
export interface Item {
  id: string; source: Source; type: "message" | "comment";
  authorId: string; body: string; timestamp: string; taskId?: string;
}
export interface Task {
  id: string; title: string; status: TaskStatus;
  assigneeId: string | null; updatedAt: string;
  // optional richer fields (present once ClickUp Phase 2/3 sync runs)
  assigneeIds?: string[];
  createdAt?: string;
  closedAt?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  tags?: string[];
  priority?: string | null;
  area?: string | null;
  statusHistory?: { status: string; at: string }[];
}

export const PEOPLE: Record<string, Person> = {
  p_dana: { id: "p_dana", name: "Dana", role: "client" },
  p_sam: { id: "p_sam", name: "Sam", role: "qa" },
  p_priya: { id: "p_priya", name: "Priya", role: "developer" },
  p_bob: { id: "p_bob", name: "Bob", role: "developer" },
  p_you: { id: "p_you", name: "You", role: "pm" },
};

export const TASKS: Task[] = [
  { id: "CU-47", title: "Login flow — account lockout", status: "blocked", assigneeId: "p_bob", updatedAt: "2026-06-03T09:00:00Z" },
  { id: "CU-61", title: "Payment refunds", status: "in_review", assigneeId: "p_priya", updatedAt: "2026-06-02T14:00:00Z" },
  { id: "CU-2", title: "Project setup", status: "done", assigneeId: "p_priya", updatedAt: "2026-05-10T10:00:00Z" },
  { id: "CU-70", title: "Wallet payments — spike", status: "open", assigneeId: null, updatedAt: "2026-06-04T08:00:00Z" },
];

export const ITEMS: Item[] = [
  { id: "i1", source: "slack", type: "message", authorId: "p_dana", body: "Hey, any update on the login flow? The client demo is Friday.", timestamp: "2026-06-04T07:13:00Z", taskId: "CU-47" },
  { id: "i2", source: "slack", type: "message", authorId: "p_sam", body: "Login bug still reproduces on the third failed attempt — not locking the account.", timestamp: "2026-06-04T07:40:00Z", taskId: "CU-47" },
  { id: "i3", source: "clickup", type: "comment", authorId: "p_bob", body: "Blocked — need product to confirm the lockout threshold.", timestamp: "2026-06-03T09:05:00Z", taskId: "CU-47" },
  { id: "i4", source: "slack", type: "message", authorId: "p_priya", body: "Looking into the payment refund edge case now.", timestamp: "2026-06-04T08:02:00Z", taskId: "CU-61" },
  { id: "i5", source: "slack", type: "message", authorId: "p_dana", body: "Also — are wallet payments in scope for the first release?", timestamp: "2026-06-04T08:20:00Z", taskId: "CU-70" },
];

export const person = (id: string | null) => (id ? PEOPLE[id] ?? null : null);
