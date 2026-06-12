import { ITEMS, TASKS, PEOPLE, person, type Item, type Task, type Person } from "./model";

/**
 * Heuristic "needs you" detection — the same placeholder the context engine
 * uses. The brain replaces this with real inference later; the shapes returned
 * here stay the same, so the UI never changes.
 */

export interface PersonGroup { person: Person; items: Item[]; }

export interface Agenda {
  date: string;
  openQuestions: PersonGroup[];
  attentionTasks: Task[];
  counts: { questions: number; tasks: number };
}

function isQuestionFromOutside(i: Item): boolean {
  const role = PEOPLE[i.authorId]?.role;
  return (role === "client" || role === "qa") && i.body.includes("?");
}

export function getAgenda(): Agenda {
  const flagged = ITEMS.filter(isQuestionFromOutside);

  const byPerson = new Map<string, Item[]>();
  for (const i of flagged) {
    const list = byPerson.get(i.authorId) ?? [];
    list.push(i);
    byPerson.set(i.authorId, list);
  }
  const openQuestions: PersonGroup[] = [...byPerson.entries()].map(([id, items]) => ({
    person: PEOPLE[id],
    items,
  }));

  const attentionTasks = TASKS.filter((t) => t.status === "blocked" || t.status === "in_review");

  return {
    date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    openQuestions,
    attentionTasks,
    counts: { questions: flagged.length, tasks: attentionTasks.length },
  };
}

export function allTasks(): Task[] {
  const rank: Record<string, number> = { blocked: 0, in_review: 1, in_progress: 2, open: 3, done: 4 };
  return [...TASKS].sort((a, b) => rank[a.status] - rank[b.status]);
}

export function recentItems(): Item[] {
  return [...ITEMS].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/** Retrieval seam the brain will use. For now: keyword match over live items. */
export function gatherContext(question: string): { items: Item[]; tasks: Task[] } {
  const terms = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hit = (text: string) => terms.some((t) => text.toLowerCase().includes(t));
  return {
    items: ITEMS.filter((i) => hit(i.body)),
    tasks: TASKS.filter((t) => hit(t.title)),
  };
}

export { person };
