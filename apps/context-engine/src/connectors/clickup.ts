import type { Connector } from "./types";
import { fixturesEnabled, MOCK_PEOPLE } from "./types";
import { detectTaskLinks, type ConnectorResult, type Item, type Task } from "../model";

/**
 * Read-only ClickUp connector.
 * Real mode requires a personal API token and a list ID.
 * Fetches tasks + comments; paginates automatically.
 */

// ---- ClickUp API types ----

interface CUAssignee { id: number; username: string }
interface CUStatus  { status: string; type?: string } // type: "closed"|"done"|"open"|...
interface CUTag     { name: string }
interface CUPriority { priority: string } // "urgent"|"high"|"normal"|"low"
interface CURef     { id: string; name: string }
interface CUTask {
  id: string;
  name: string;
  status: CUStatus;
  assignees: CUAssignee[];
  date_updated: string; // ms epoch string
  date_created?: string; // ms epoch string
  date_closed?: string | null; // ms epoch string
  due_date?: string | null; // ms epoch string
  start_date?: string | null; // ms epoch string
  tags?: CUTag[];
  priority?: CUPriority | null;
  list?: CURef;
  folder?: CURef;
  space?: CURef;
  url: string;
}
interface CUComment {
  id: string;
  user: { id: number };
  comment_text: string;
  date: string; // ms epoch string
}

// ---- helpers ----

async function cuGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://api.clickup.com/api/v2/${path}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`ClickUp HTTP ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function fetchAllTasks(token: string, listId: string): Promise<CUTask[]> {
  const all: CUTask[] = [];
  let page = 0;
  while (true) {
    const data = await cuGet<{ tasks: CUTask[] }>(
      token,
      `list/${listId}/task?include_closed=true&page=${page}`,
    );
    const batch = data.tasks ?? [];
    all.push(...batch);
    if (batch.length < 100) break; // ClickUp page size is 100
    page++;
  }
  return all;
}

async function fetchComments(token: string, taskId: string): Promise<CUComment[]> {
  try {
    const data = await cuGet<{ comments: CUComment[] }>(token, `task/${taskId}/comment`);
    return data.comments ?? [];
  } catch {
    return []; // non-fatal if comments fail for one task
  }
}

// ---- normalisation ----

// ClickUp gives ms-epoch strings; turn one into ISO (or null/undefined cleanly).
function msToIso(ms: string | null | undefined): string | undefined {
  if (ms == null || ms === "") return undefined;
  const n = Number(ms);
  return Number.isFinite(n) ? new Date(n).toISOString() : undefined;
}

function normalizeTask(t: CUTask): Task {
  const assigneeIds = (t.assignees ?? []).map((a) => `clickup:${a.id}`);
  // A task is "closed" when ClickUp marks its status type as closed/done.
  const closedByType = t.status?.type === "closed" || t.status?.type === "done";
  return {
    id: t.id,
    source: "clickup",
    title: t.name,
    status: t.status?.status ?? "open",
    assigneeId: assigneeIds[0] ?? null,
    linkedItemIds: [],
    updatedAt: new Date(Number(t.date_updated)).toISOString(),
    rawRef: t.url,
    assigneeIds,
    createdAt: msToIso(t.date_created),
    closedAt: msToIso(t.date_closed) ?? (closedByType ? new Date(Number(t.date_updated)).toISOString() : null),
    dueDate: msToIso(t.due_date) ?? null,
    startDate: msToIso(t.start_date) ?? null,
    tags: (t.tags ?? []).map((tag) => tag.name.toLowerCase()),
    priority: t.priority?.priority ?? null,
    area: t.list?.name ?? t.folder?.name ?? t.space?.name ?? null,
  };
}

function normalizeComment(c: CUComment, taskId: string): Item {
  return {
    id: `clickup:comment:${c.id}`,
    source: "clickup",
    type: "comment",
    authorId: `clickup:${c.user.id}`,
    body: c.comment_text,
    timestamp: new Date(Number(c.date)).toISOString(),
    links: [{ kind: "task", id: taskId }, ...detectTaskLinks(c.comment_text)],
    rawRef: `https://app.clickup.com/t/${taskId}`,
  };
}

// ---- fixture data ----

interface FixtureTask {
  id: string; title: string; status: string;
  assigneeClickupId?: string; updatedAt: string;
  // Phase 2/3 fields, so fixture mode exercises the full metric set.
  createdAt?: string; closedAt?: string | null; dueDate?: string | null;
  tags?: string[]; area?: string | null;
  statusHistory?: { status: string; at: string }[];
  comments?: { id: string; authorClickupId: string; text: string; at: string }[];
}

const MOCK_TASKS: FixtureTask[] = [
  {
    id: "CU-47", title: "Login flow — account lockout", status: "blocked",
    assigneeClickupId: "202", updatedAt: "2026-06-03T09:00:00Z",
    createdAt: "2026-05-28T09:00:00Z", tags: ["bug"], area: "Auth",
    statusHistory: [
      { status: "open", at: "2026-05-28T09:00:00Z" },
      { status: "blocked", at: "2026-06-03T09:00:00Z" },
    ],
    comments: [{ id: "c1", authorClickupId: "202", text: "Blocked — need product to confirm lockout threshold.", at: "2026-06-03T09:05:00Z" }],
  },
  {
    id: "CU-61", title: "Payment refunds", status: "in_review",
    assigneeClickupId: "201", updatedAt: "2026-06-02T14:00:00Z",
    createdAt: "2026-05-30T10:00:00Z", dueDate: "2026-06-05T00:00:00Z", area: "Payments",
    statusHistory: [
      { status: "open", at: "2026-05-30T10:00:00Z" },
      { status: "in_review", at: "2026-06-02T14:00:00Z" },
    ],
  },
  {
    id: "CU-2", title: "Project setup", status: "done",
    assigneeClickupId: "201", updatedAt: "2026-05-10T10:00:00Z",
    createdAt: "2026-05-08T10:00:00Z", closedAt: "2026-05-10T10:00:00Z",
    dueDate: "2026-05-12T00:00:00Z", area: "Platform",
    statusHistory: [
      { status: "open", at: "2026-05-08T10:00:00Z" },
      { status: "done", at: "2026-05-10T10:00:00Z" },
    ],
  },
  {
    id: "CU-88", title: "Checkout total rounding bug", status: "done",
    assigneeClickupId: "202", updatedAt: "2026-06-10T16:00:00Z",
    createdAt: "2026-06-06T09:00:00Z", closedAt: "2026-06-10T16:00:00Z",
    dueDate: "2026-06-09T00:00:00Z", tags: ["bug"], area: "Payments",
    // reopened once before final done — exercises reopen rate + verify time
    statusHistory: [
      { status: "open", at: "2026-06-06T09:00:00Z" },
      { status: "in_review", at: "2026-06-08T11:00:00Z" },
      { status: "done", at: "2026-06-08T15:00:00Z" },
      { status: "in_progress", at: "2026-06-09T09:00:00Z" },
      { status: "done", at: "2026-06-10T16:00:00Z" },
    ],
  },
];

function normalizeFixtureTask(f: FixtureTask): { task: Task; items: Item[] } {
  const assigneeId = f.assigneeClickupId
    ? (Object.values(MOCK_PEOPLE).find((p) => p.sourceIds.clickup === f.assigneeClickupId)?.id ?? `clickup:${f.assigneeClickupId}`)
    : null;
  const task: Task = {
    id: f.id, source: "clickup", title: f.title, status: f.status,
    assigneeId, assigneeIds: assigneeId ? [assigneeId] : [], linkedItemIds: [],
    updatedAt: f.updatedAt,
    createdAt: f.createdAt,
    closedAt: f.closedAt ?? null,
    dueDate: f.dueDate ?? null,
    tags: f.tags ?? [],
    area: f.area ?? null,
    statusHistory: f.statusHistory,
    rawRef: `https://app.clickup.com/t/${f.id}`,
  };
  const items: Item[] = (f.comments ?? []).map((c) => ({
    id: `clickup:comment:${c.id}`,
    source: "clickup" as const,
    type: "comment" as const,
    authorId: Object.values(MOCK_PEOPLE).find((p) => p.sourceIds.clickup === c.authorClickupId)?.id ?? `clickup:${c.authorClickupId}`,
    body: c.text,
    timestamp: c.at,
    links: [{ kind: "task" as const, id: f.id }, ...detectTaskLinks(c.text)],
    rawRef: `https://app.clickup.com/t/${f.id}`,
  }));
  return { task, items };
}

// ---- connector ----

export function clickupConnector(): Connector {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  const listId = process.env.CLICKUP_LIST_ID?.trim();

  return {
    name: "clickup",
    enabled: () => (Boolean(token) && Boolean(listId)) || fixturesEnabled(),

    async backfill(): Promise<ConnectorResult> {
      if (!token || !listId) {
        // fixture path
        const tasks: Task[] = [];
        const items: Item[] = [];
        for (const f of MOCK_TASKS) {
          const { task, items: fItems } = normalizeFixtureTask(f);
          tasks.push(task);
          items.push(...fItems);
        }
        const people = Object.values(MOCK_PEOPLE).filter((p) => p.sourceIds.clickup);
        return { people, tasks, items };
      }

      // real path
      // Phase 2 fields (created/closed/due dates, tags, priority, list/area) come
      // back on the list-task endpoint, so normalizeTask() populates them directly.
      // Phase 3 `statusHistory` is NOT exposed by the ClickUp v2 list endpoint — a
      // full transition log needs webhooks (taskStatusUpdated) accumulated over time,
      // or the limited time-in-status endpoint. Until that's wired, statusHistory is
      // left undefined and reopen-rate / verify-time stay in the deferred footnote.
      const rawTasks = await fetchAllTasks(token, listId);
      const tasks: Task[] = [];
      const items: Item[] = [];

      for (const t of rawTasks) {
        tasks.push(normalizeTask(t));
        const comments = await fetchComments(token, t.id);
        for (const c of comments) items.push(normalizeComment(c, t.id));
      }

      // Derive people from assignees seen across all tasks
      const seen = new Map<string, { id: number; username: string }>();
      for (const t of rawTasks) {
        for (const a of t.assignees) seen.set(String(a.id), a);
      }
      const people = [...seen.values()].map((a) => ({
        id: `clickup:${a.id}`,
        name: a.username,
        role: "unknown" as const,
        sourceIds: { clickup: String(a.id) },
      }));

      return { people, tasks, items };
    },
  };
}
