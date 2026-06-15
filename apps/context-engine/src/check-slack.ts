/**
 * Diagnostic: prints a breakdown of what the Slack API actually returns
 * for each configured channel so you can see whether the bot can read
 * and why messages might be getting filtered.
 *
 * Run: npm run check-slack
 */

const token = process.env.SLACK_BOT_TOKEN?.trim();
const channelIds = (process.env.SLACK_CHANNEL_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!token) {
  console.error("SLACK_BOT_TOKEN is not set.");
  process.exit(1);
}

if (channelIds.length === 0) {
  console.error("SLACK_CHANNEL_IDS is empty — nothing to check.");
  process.exit(1);
}

async function slackGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://slack.com/api/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as T & { ok: boolean; error?: string };
  if (!(data as any).ok) throw new Error((data as any).error ?? "unknown error");
  return data;
}

for (const channel of channelIds) {
  console.log(`\nChannel: ${channel}`);
  try {
    const data = await slackGet<{
      messages: Array<{
        user?: string;
        bot_id?: string;
        subtype?: string;
        text: string;
        ts: string;
      }>;
    }>(`conversations.history?channel=${channel}&limit=200`);

    const messages = data.messages ?? [];
    const human   = messages.filter((m) => !m.bot_id && !m.subtype && m.user);
    const bot     = messages.filter((m) => m.bot_id);
    const subtype = messages.filter((m) => m.subtype);
    const noUser  = messages.filter((m) => !m.bot_id && !m.subtype && !m.user);

    console.log(`  Total fetched : ${messages.length}`);
    console.log(`  Human messages: ${human.length}   ← these reach the context store`);
    console.log(`  Bot messages  : ${bot.length}   (filtered out)`);
    console.log(`  Subtypes      : ${subtype.length}   (filtered out — join/leave events etc.)`);
    console.log(`  No user field : ${noUser.length}   (filtered out)`);

    if (human.length > 0) {
      console.log(`\n  Most recent human messages:`);
      for (const m of human.slice(0, 5)) {
        const ts = new Date(Number(m.ts) * 1000).toISOString();
        console.log(`    [${ts}] ${m.text.slice(0, 80)}`);
      }
    } else {
      console.log(`\n  No human messages found in the last ${messages.length} messages.`);
    }
  } catch (err: any) {
    console.error(`  ERROR: ${err.message}`);
    if (err.message === "not_in_channel") {
      console.error("  → Bot is not a member of this channel. Run /invite @your-bot in Slack.");
    } else if (err.message === "missing_scope") {
      console.error("  → Token is missing required scopes (channels:history or groups:history).");
    } else if (err.message === "channel_not_found") {
      console.error("  → Channel ID is wrong or the bot can't see this workspace.");
    }
  }
}
