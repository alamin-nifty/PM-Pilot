import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Role } from "./model";

export interface AppConfig {
  slack: { botToken: string; channelIds: string };
  clickup: { apiToken: string; listId: string };
  roles: Record<string, Role>; // personId → role
  hidden: string[];            // personIds removed from the portal
}

const CONFIG_PATH = join(process.cwd(), "data", "config.json");
const ENGINE_ENV_PATH = join(process.cwd(), "..", "context-engine", ".env");

const DEFAULT: AppConfig = {
  slack: { botToken: "", channelIds: "" },
  clickup: { apiToken: "", listId: "" },
  roles: {},
  hidden: [],
};

export function readConfig(): AppConfig {
  try {
    const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return {
      slack: { ...DEFAULT.slack, ...saved.slack },
      clickup: { ...DEFAULT.clickup, ...saved.clickup },
      roles: saved.roles ?? {},
      hidden: saved.hidden ?? [],
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeConfig(config: AppConfig): void {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  syncEngineEnv(config);
}

function syncEngineEnv(config: AppConfig): void {
  const lines = [
    `SLACK_BOT_TOKEN=${config.slack.botToken}`,
    `SLACK_CHANNEL_IDS=${config.slack.channelIds}`,
    `CLICKUP_API_TOKEN=${config.clickup.apiToken}`,
    `CLICKUP_LIST_ID=${config.clickup.listId}`,
    `USE_FIXTURES=false`,
  ];
  try {
    writeFileSync(ENGINE_ENV_PATH, lines.join("\n") + "\n");
  } catch {
    // engine dir may not exist in some setups — non-fatal
  }
}
