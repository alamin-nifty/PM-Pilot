import { loadData, type AppData } from "./store-reader";
import type { Item, Task, Person } from "./model";

export interface PersonGroup { person: Person; items: Item[]; }

export interface Agenda {
  date: string;
  openQuestions: PersonGroup[];
  attentionTasks: Task[];
  counts: { questions: number; tasks: number };
}

function isQuestionFromOutside(i: Item, people: AppData["people"]): boolean {
  const role = people[i.authorId]?.role;
  return (role === "client" || role === "qa") && i.body.includes("?");
}

export function getAgenda(): Agenda {
  const { people, tasks, items } = loadData();

  const flagged = items.filter((i) => isQuestionFromOutside(i, people));

  const byPerson = new Map<string, Item[]>();
  for (const i of flagged) {
    const list = byPerson.get(i.authorId) ?? [];
    list.push(i);
    byPerson.set(i.authorId, list);
  }
  const openQuestions: PersonGroup[] = [...byPerson.entries()]
    .map(([id, items]) => ({ person: people[id], items }))
    .filter((g) => g.person != null);

  const attentionTasks = tasks.filter(
    (t) => t.status === "blocked" || t.status === "in_review",
  );

  return {
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    }),
    openQuestions,
    attentionTasks,
    counts: { questions: flagged.length, tasks: attentionTasks.length },
  };
}

export function allTasks(): Task[] {
  const { tasks } = loadData();
  const rank: Record<string, number> = {
    blocked: 0, in_review: 1, in_progress: 2, open: 3, done: 4,
  };
  return [...tasks].sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5));
}

export function recentItems(): Item[] {
  const { items } = loadData();
  return [...items].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function gatherContext(question: string): { items: Item[]; tasks: Task[] } {
  const { items, tasks } = loadData();
  const terms = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hit = (text: string) => terms.some((t) => text.toLowerCase().includes(t));
  return {
    items: items.filter((i) => hit(i.body)),
    tasks: tasks.filter((t) => hit(t.title)),
  };
}

export function person(id: string | null): Person | null {
  if (!id) return null;
  return loadData().people[id] ?? null;
}
