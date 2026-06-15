import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import {
  db_getPeople,
  db_upsertPerson,
  db_setRole,
  db_setHidden,
  db_getConfig,
  db_setConfig,
  syncPeopleFromStore,
} from "@/lib/db";
import { writeFileSync } from "fs";

// ---- helpers ----

function readStorePeople(): { id: string; name: string }[] {
  try {
    const raw = readFileSync(
      join(process.cwd(), "..", "context-engine", "data", "context-store.json"),
      "utf-8",
    );
    const store = JSON.parse(raw) as { people: Record<string, { id: string; name: string }> };
    return Object.values(store.people);
  } catch {
    return [];
  }
}

function getConnections() {
  return {
    slack: {
      botToken: db_getConfig("slack.botToken"),
      channelIds: db_getConfig("slack.channelIds"),
    },
    clickup: {
      apiToken: db_getConfig("clickup.apiToken"),
      listId: db_getConfig("clickup.listId"),
    },
  };
}

function syncEngineEnv() {
  const lines = [
    `SLACK_BOT_TOKEN=${db_getConfig("slack.botToken")}`,
    `SLACK_CHANNEL_IDS=${db_getConfig("slack.channelIds")}`,
    `CLICKUP_API_TOKEN=${db_getConfig("clickup.apiToken")}`,
    `CLICKUP_LIST_ID=${db_getConfig("clickup.listId")}`,
    `USE_FIXTURES=false`,
  ];
  try {
    writeFileSync(
      join(process.cwd(), "..", "context-engine", ".env"),
      lines.join("\n") + "\n",
    );
  } catch {
    // non-fatal
  }
}

// ---- routes ----

export async function GET() {
  // Sync any new people from the context store into the DB (preserves roles/hidden)
  syncPeopleFromStore(readStorePeople());

  const people = db_getPeople();
  const connections = getConnections();

  return NextResponse.json({ people, connections });
}

export async function POST(req: Request) {
  const body = await req.json();

  // Save connection tokens
  if (body.connections) {
    db_setConfig.run({ key: "slack.botToken",    value: body.connections.slack?.botToken    ?? "" });
    db_setConfig.run({ key: "slack.channelIds",  value: body.connections.slack?.channelIds  ?? "" });
    db_setConfig.run({ key: "clickup.apiToken",  value: body.connections.clickup?.apiToken  ?? "" });
    db_setConfig.run({ key: "clickup.listId",    value: body.connections.clickup?.listId    ?? "" });
    syncEngineEnv();
  }

  // Save individual person updates (role and/or hidden)
  if (Array.isArray(body.people)) {
    for (const p of body.people) {
      if (p.id && p.name !== undefined) {
        db_upsertPerson.run({ id: p.id, name: p.name, role: p.role ?? "", hidden: p.hidden ? 1 : 0 });
      } else if (p.id && p.role !== undefined) {
        db_setRole.run({ id: p.id, role: p.role });
      } else if (p.id && p.hidden !== undefined) {
        db_setHidden.run({ id: p.id, hidden: p.hidden ? 1 : 0 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
