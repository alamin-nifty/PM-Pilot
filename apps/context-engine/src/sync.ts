import { ContextStore } from "./store";
import { slackConnector } from "./connectors/slack";
import { clickupConnector } from "./connectors/clickup";

/** Read-only backfill from every enabled connector into the context store. */
export async function sync(): Promise<void> {
  const store = new ContextStore();
  store.reset(); // backfill rebuilds; incremental sync via webhooks comes later

  const connectors = [slackConnector(), clickupConnector()];
  for (const c of connectors) {
    if (!c.enabled()) {
      console.log(`- ${c.name}: disabled (no token, fixtures off)`);
      continue;
    }
    const r = await c.backfill();
    r.people.forEach((p) => store.upsertPerson(p));
    r.tasks.forEach((t) => store.upsertTask(t));
    r.items.forEach((i) => store.upsertItem(i));
    console.log(`+ ${c.name}: ${r.items.length} items, ${r.tasks.length} tasks, ${r.people.length} people`);
  }

  store.reindexLinks();
  store.persist();
  console.log("\nContext store written to data/context-store.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  sync().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
