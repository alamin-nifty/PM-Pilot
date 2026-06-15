import { readFileSync } from "fs";
import { join } from "path";
import { db_getPeople } from "./db";
import {
  PEOPLE as SAMPLE_PEOPLE,
  TASKS as SAMPLE_TASKS,
  ITEMS as SAMPLE_ITEMS,
  type Person,
  type Task,
  type Item,
  type Role,
  type TaskStatus,
  type Source,
} from "./model";

interface RawStore {
  people: Record<string, { id: string; name: string; role: string }>;
  tasks: Record<string, {
    id: string; source: string; title: string; status: string;
    assigneeId: string | null; updatedAt: string; rawRef: string;
  }>;
  items: Record<string, {
    id: string; source: string; type: string; authorId: string;
    body: string; timestamp: string;
    links: Array<{ kind: string; id: string }>;
  }>;
}

export interface AppData {
  people: Record<string, Person>;
  tasks: Task[];
  items: Item[];
}

// Simple cache — avoids re-reading files on every inline person() call per render
let _cache: { data: AppData; at: number } | null = null;
const TTL_MS = 10_000;

function readRealData(): AppData | null {
  try {
    const raw = readFileSync(
      join(process.cwd(), "..", "context-engine", "data", "context-store.json"),
      "utf-8",
    );
    const store: RawStore = JSON.parse(raw);

    // Enrich people with roles + hidden from SQLite
    const dbPeople = db_getPeople();
    const roleMap = new Map(dbPeople.map((p) => [p.id, p.role]));
    const hiddenSet = new Set(dbPeople.filter((p) => p.hidden === 1).map((p) => p.id));

    const people: Record<string, Person> = {};
    for (const [id, p] of Object.entries(store.people ?? {})) {
      if (hiddenSet.has(id)) continue;
      people[id] = { id, name: p.name, role: (roleMap.get(id) ?? "") as Role };
    }

    const tasks: Task[] = Object.values(store.tasks ?? {}).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as TaskStatus,
      assigneeId: t.assigneeId ?? null,
      updatedAt: t.updatedAt,
    }));

    const items: Item[] = Object.values(store.items ?? {})
      .filter((i) => !hiddenSet.has(i.authorId))
      .map((i) => ({
        id: i.id,
        source: i.source as Source,
        type: (i.type === "comment" ? "comment" : "message") as "message" | "comment",
        authorId: i.authorId,
        body: i.body,
        timestamp: i.timestamp,
        taskId: i.links?.[0]?.id,
      }));

    return { people, tasks, items };
  } catch {
    return null; // store not readable — caller falls back to sample data
  }
}

export function loadData(): AppData {
  const now = Date.now();
  if (_cache && now - _cache.at < TTL_MS) return _cache.data;

  const real = readRealData();
  const data: AppData = real ?? {
    people: SAMPLE_PEOPLE,
    tasks: SAMPLE_TASKS,
    items: SAMPLE_ITEMS,
  };

  _cache = { data, at: now };
  return data;
}

/** Invalidate cache — call after a sync so the dashboard picks up fresh data */
export function invalidateCache() {
  _cache = null;
}
