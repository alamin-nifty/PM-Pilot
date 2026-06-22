/**
 * The normalized model. Connectors translate vendor-specific payloads INTO
 * these shapes; nothing downstream (store, agenda, the brain later) needs to
 * know whether something came from Slack or ClickUp.
 * Mirrors Keystone-Architecture §3.
 */

export type Source = "slack" | "clickup";
export type ItemType = "message" | "comment" | "task" | "status_change";
export type Role = "client" | "qa" | "developer" | "pm" | "unknown";

export interface Person {
  id: string; // canonical, stable across sources
  name: string;
  role: Role;
  sourceIds: Partial<Record<Source, string>>; // e.g. { slack: "U123", clickup: "42" }
}

export interface Link {
  kind: "task" | "doc";
  id: string;
}

export interface Item {
  id: string;
  source: Source;
  type: ItemType;
  authorId: string; // → Person.id
  body: string;
  timestamp: string; // ISO
  links: Link[]; // correlations to tasks / docs
  rawRef: string; // deep link back to the source
}

export type TaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done"
  | (string & {});

export interface Task {
  id: string; // canonical task id, e.g. "CU-47"
  source: Source;
  title: string;
  status: TaskStatus;
  assigneeId: string | null; // → Person.id (primary assignee)
  linkedItemIds: string[];
  updatedAt: string; // ISO
  rawRef: string;
  // --- optional richer fields (Phase 2; absent on Slack/older syncs) ---
  assigneeIds?: string[]; // all assignees → Person.id
  createdAt?: string; // ISO
  closedAt?: string | null; // ISO, when moved to a closed/done status
  dueDate?: string | null; // ISO
  startDate?: string | null; // ISO
  tags?: string[]; // ClickUp tag names (lowercased)
  priority?: string | null; // "urgent" | "high" | "normal" | "low"
  area?: string | null; // ClickUp list/folder/space name — the "where"
  // --- Phase 3: status transition log, oldest → newest ---
  statusHistory?: { status: string; at: string }[]; // { status, ISO time }
}

export interface ConnectorResult {
  people: Person[];
  tasks: Task[];
  items: Item[];
}

/** Detect ClickUp task references inside free text (the MVP linking strategy). */
export function detectTaskLinks(body: string): Link[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(/\bCU-\d+\b/g)) ids.add(m[0]);
  for (const m of body.matchAll(/clickup\.com\/t\/([a-z0-9]+)/gi)) ids.add(`CU-${m[1]}`);
  return [...ids].map((id) => ({ kind: "task" as const, id }));
}
