import fs from "node:fs";
import path from "node:path";
import type { Item, Person, Task } from "./model";

/**
 * The context store: the durable, normalized record of project state — the
 * externalized version of what currently lives only in the PM's head.
 *
 * This starter persists to a JSON file so it runs anywhere with zero setup.
 * The interface is deliberately a repository so swapping to Postgres (per
 * Keystone-Architecture §6) is a one-file change — callers don't change.
 */

interface DB {
  people: Record<string, Person>;
  tasks: Record<string, Task>;
  items: Record<string, Item>;
}

const FILE = path.join(process.cwd(), "data", "context-store.json");
const empty = (): DB => ({ people: {}, tasks: {}, items: {} });

export class ContextStore {
  private db: DB;

  constructor() {
    try {
      this.db = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
    } catch {
      this.db = empty();
    }
  }

  reset() {
    this.db = empty();
  }

  upsertPerson(p: Person) {
    this.db.people[p.id] = { ...this.db.people[p.id], ...p };
  }

  upsertTask(t: Task) {
    const prev = this.db.tasks[t.id];
    const linkedItemIds = [...new Set([...(prev?.linkedItemIds ?? []), ...t.linkedItemIds])];
    this.db.tasks[t.id] = { ...prev, ...t, linkedItemIds };
  }

  upsertItem(i: Item) {
    this.db.items[i.id] = i;
    // Maintain the reverse link: a task knows which items reference it.
    for (const link of i.links) {
      if (link.kind !== "task") continue;
      const task = this.db.tasks[link.id];
      if (task && !task.linkedItemIds.includes(i.id)) task.linkedItemIds.push(i.id);
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(this.db, null, 2));
  }

  /** Rebuild every task's linked-item list from scratch. Run after a sync so
   *  links are complete no matter what order connectors ran in. */
  reindexLinks() {
    for (const t of Object.values(this.db.tasks)) t.linkedItemIds = [];
    for (const i of Object.values(this.db.items)) {
      for (const link of i.links) {
        if (link.kind !== "task") continue;
        const task = this.db.tasks[link.id];
        if (task && !task.linkedItemIds.includes(i.id)) task.linkedItemIds.push(i.id);
      }
    }
  }

  // ---- queries: the seam the agenda and (later) the brain read through ----
  people(): Person[] { return Object.values(this.db.people); }
  tasks(): Task[] { return Object.values(this.db.tasks); }
  items(): Item[] { return Object.values(this.db.items); }
  person(id: string): Person | null { return this.db.people[id] ?? null; }
  task(id: string): Task | null { return this.db.tasks[id] ?? null; }
  itemsByPerson(id: string): Item[] { return this.items().filter((i) => i.authorId === id); }
  itemsForTask(id: string): Item[] {
    return this.items().filter((i) => i.links.some((l) => l.kind === "task" && l.id === id));
  }
}
