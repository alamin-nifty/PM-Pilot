import { ContextStore } from "./store";
import type { Item, Task } from "./model";

/**
 * The agenda is the payoff: "what needs you today, grouped by who and what."
 *
 * IMPORTANT: the detection below is a HEURISTIC placeholder. It's deliberately
 * simple and deterministic so the engine is useful before the brain exists.
 * When you add the brain, replace `needsAttention` with real inference (the
 * brain reads the same store via the queries here) — the rest stays the same.
 */

export interface Attention {
  items: Item[]; // questions from client/QA that look unanswered
  tasks: Task[]; // tasks in a state that usually needs the PM
}

export function needsAttention(store: ContextStore): Attention {
  const items = store.items().filter((i) => {
    const author = store.person(i.authorId);
    const fromOutside = author?.role === "client" || author?.role === "qa";
    const looksLikeQuestion = i.body.includes("?");
    return Boolean(fromOutside && looksLikeQuestion);
  });
  const tasks = store.tasks().filter((t) => t.status === "blocked" || t.status === "in_review");
  return { items, tasks };
}

/** Plain-text agenda grouped by person. */
export function buildAgenda(store: ContextStore): string {
  const { items, tasks } = needsAttention(store);
  const lines: string[] = ["TODAY — needs your attention", ""];

  // Group flagged items by their author (who you'd reply to).
  const byPerson = new Map<string, Item[]>();
  for (const i of items) {
    const name = store.person(i.authorId)?.name ?? i.authorId;
    (byPerson.get(name) ?? byPerson.set(name, []).get(name)!).push(i);
  }

  if (byPerson.size === 0) lines.push("  (no open questions from client/QA)");
  for (const [name, msgs] of byPerson) {
    lines.push(`▸ ${name}`);
    for (const m of msgs) {
      const taskTag = m.links.find((l) => l.kind === "task")?.id;
      lines.push(`    – ${m.body}${taskTag ? `   [${taskTag}]` : ""}`);
    }
    lines.push("");
  }

  lines.push("Tasks that usually need you:");
  if (tasks.length === 0) lines.push("  (none)");
  for (const t of tasks) {
    const who = t.assigneeId ? store.person(t.assigneeId)?.name ?? t.assigneeId : "unassigned";
    lines.push(`  • ${t.id} ${t.title} — ${t.status} (assignee: ${who})`);
  }
  return lines.join("\n");
}

/**
 * The retrieval seam the BRAIN will use later. Given a question, gather the
 * relevant live context from the store. The brain combines this with the
 * docs-portal knowledge base, then reasons. For now it does keyword matching;
 * swap in embeddings/retrieval when you build the brain.
 */
export function gatherContext(store: ContextStore, question: string): { items: Item[]; tasks: Task[] } {
  const terms = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const match = (text: string) => terms.some((t) => text.toLowerCase().includes(t));
  return {
    items: store.items().filter((i) => match(i.body)),
    tasks: store.tasks().filter((t) => match(t.title)),
  };
}
