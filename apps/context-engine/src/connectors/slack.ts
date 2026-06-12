import type { Connector } from "./types";
import { fixturesEnabled, MOCK_PEOPLE } from "./types";
import { detectTaskLinks, type ConnectorResult, type Item, type Person } from "../model";

/**
 * Read-only Slack connector.
 * Real mode requires: channels:history, groups:history, users:read
 */

// ---- Slack API types ----

interface SlackMessage {
  user?: string;      // absent on bot messages
  bot_id?: string;    // present on bot messages
  subtype?: string;   // e.g. "bot_message", "channel_join"
  text: string;
  ts: string;
  channel: string;
}

interface SlackUser {
  id: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string };
  is_bot?: boolean;
}

// ---- helpers ----

async function slackGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://slack.com/api/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Slack HTTP ${res.status} on ${path}`);
  const data = (await res.json()) as T & { ok: boolean; error?: string };
  if (!(data as any).ok) throw new Error(`Slack API error on ${path}: ${(data as any).error}`);
  return data;
}

async function fetchUsers(token: string): Promise<Person[]> {
  const data = await slackGet<{ members: SlackUser[] }>(token, "users.list?limit=200");
  return data.members
    .filter((u) => !u.is_bot && u.id !== "USLACKBOT")
    .map((u) => ({
      id: `slack:${u.id}`,
      name: u.profile?.display_name || u.profile?.real_name || u.real_name || u.id,
      role: "unknown" as const,
      sourceIds: { slack: u.id },
    }));
}

async function fetchHistory(token: string): Promise<SlackMessage[]> {
  const channels = (process.env.SLACK_CHANNEL_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (channels.length === 0) {
    console.warn("  [slack] SLACK_CHANNEL_IDS is empty — no channels to fetch");
    return [];
  }

  const out: SlackMessage[] = [];
  for (const channel of channels) {
    const data = await slackGet<{ messages: Omit<SlackMessage, "channel">[] }>(
      token,
      `conversations.history?channel=${channel}&limit=200`,
    );
    for (const m of data.messages ?? []) {
      // skip bot messages, channel events, and messages without a human author
      if (m.bot_id || m.subtype || !m.user) continue;
      out.push({ ...m, channel });
    }
  }
  return out;
}

function normalizeMessage(m: SlackMessage): Item {
  return {
    id: `slack:${m.channel}:${m.ts}`,
    source: "slack",
    type: "message",
    authorId: `slack:${m.user}`,
    body: m.text,
    timestamp: new Date(Number(m.ts) * 1000).toISOString(),
    links: detectTaskLinks(m.text),
    rawRef: `https://slack.com/archives/${m.channel}/p${m.ts.replace(".", "")}`,
  };
}

// ---- fixture data (used when USE_FIXTURES != "false") ----

const MOCK_MESSAGES: SlackMessage[] = [
  { user: "U_DANA", channel: "C_PROJ", ts: "1717400000.0001", text: "Hey, any update on the login flow? The client demo is Friday. CU-47" },
  { user: "U_SAM",  channel: "C_PROJ", ts: "1717410000.0002", text: "Login bug still reproduces on the third failed attempt — not locking the account. CU-47" },
  { user: "U_PRIYA",channel: "C_PROJ", ts: "1717420000.0003", text: "Looking into the payment refund edge case now. CU-61" },
  { user: "U_DANA", channel: "C_PROJ", ts: "1717430000.0004", text: "Also — are wallet payments in scope for the first release?" },
];

// ---- connector ----

export function slackConnector(): Connector {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  return {
    name: "slack",
    enabled: () => Boolean(token) || fixturesEnabled(),

    async backfill(): Promise<ConnectorResult> {
      if (!token) {
        // fixture path
        const items = MOCK_MESSAGES.map(normalizeMessage);
        const people = Object.values(MOCK_PEOPLE).filter((p) => p.sourceIds.slack);
        return { people, tasks: [], items };
      }

      // real path
      const [messages, people] = await Promise.all([
        fetchHistory(token),
        fetchUsers(token),
      ]);
      return { people, tasks: [], items: messages.map(normalizeMessage) };
    },
  };
}
