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
interface CUStatus  { status: string }
interface CUTask {
  id: string;
  name: string;
  status: CUStatus;
  assignees: CUAssignee[];
  date_updated: string; // ms epoch string
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

function normalizeTask(t: CUTask): Task {
  return {
    id: t.id,
    source: "clickup",
    title: t.name,
    status: t.status?.status ?? "open",
    assigneeId: t.assignees?.[0] ? `clickup:${t.assignees[0].id}` : null,
    linkedItemIds: [],
    updatedAt: new Date(Number(t.date_updated)).toISOString(),
    rawRef: t.url,
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
  comments?: { id: string; authorClickupId: string; text: string; at: string }[];
}

const MOCK_TASKS: FixtureTask[] = [
  {
    id: "CU-47", title: "Login flow — account lockout", status: "blocked",
    assigneeClickupId: "202", updatedAt: "2026-06-03T09:00:00Z",
    comments: [{ id: "c1", authorClickupId: "202", text: "Blocked — need product to confirm lockout threshold.", at: "2026-06-03T09:05:00Z" }],
  },
  {
    id: "CU-61", title: "Payment refunds", status: "in_review",
    assigneeClickupId: "201", updatedAt: "2026-06-02T14:00:00Z",
  },
  {
    id: "CU-2", title: "Project setup", status: "done",
    assigneeClickupId: "201", updatedAt: "2026-05-10T10:00:00Z",
  },
];

function normalizeFixtureTask(f: FixtureTask): { task: Task; items: Item[] } {
  const assigneeId = f.assigneeClickupId
    ? (Object.values(MOCK_PEOPLE).find((p) => p.sourceIds.clickup === f.assigneeClickupId)?.id ?? `clickup:${f.assigneeClickupId}`)
    : null;
  const task: Task = {
    id: f.id, source: "clickup", title: f.title, status: f.status,
    assigneeId, linkedItemIds: [],
    updatedAt: f.updatedAt,
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
