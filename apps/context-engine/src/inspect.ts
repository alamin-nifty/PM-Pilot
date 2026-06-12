import { ContextStore } from "./store";
import { buildAgenda } from "./agenda";

/** Show what's in the context store, then the generated agenda. */
function inspect(): void {
  const store = new ContextStore();
  const tasks = store.tasks();
  const items = store.items();
  const people = store.people();

  if (tasks.length + items.length === 0) {
    console.log("Context store is empty. Run `npm run sync` first.");
    return;
  }

  console.log(`Store: ${people.length} people · ${tasks.length} tasks · ${items.length} items\n`);

  console.log("Tasks:");
  for (const t of tasks) {
    const who = t.assigneeId ? store.person(t.assigneeId)?.name ?? t.assigneeId : "unassigned";
    console.log(`  ${t.id}  ${t.title}  [${t.status}]  → ${who}  (${t.linkedItemIds.length} linked items)`);
  }

  console.log("\nItems (normalized from all sources):");
  for (const i of items) {
    const who = store.person(i.authorId)?.name ?? i.authorId;
    const links = i.links.map((l) => l.id).join(", ");
    console.log(`  [${i.source}/${i.type}] ${who}: ${i.body}${links ? `   (${links})` : ""}`);
  }

  console.log("\n" + "─".repeat(60) + "\n");
  console.log(buildAgenda(store));
}

inspect();
