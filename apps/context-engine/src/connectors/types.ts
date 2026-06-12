import type { ConnectorResult, Person } from "../model";

/**
 * Every source implements this same small interface. Adding Jira, Linear, or a
 * wiki later means writing one module that emits normalized data — nothing
 * downstream changes.
 */
export interface Connector {
  name: string;
  /** True if this connector can run (real token present, or fixtures enabled). */
  enabled(): boolean;
  /** Read-only pull of recent activity, normalized into the shared model. */
  backfill(): Promise<ConnectorResult>;
}

/** Run on sample data unless explicitly turned off. Lets the engine work with
 *  no credentials so you can see it end-to-end before wiring real tokens. */
export const fixturesEnabled = () => process.env.USE_FIXTURES !== "false";

/**
 * Canonical people, shared by the mock connectors so the same person is one
 * record across Slack and ClickUp. In production you'd build this map from a
 * real directory or a config file; role assignment is what lets the agenda
 * tell "client/QA asking me something" from "a teammate chatting."
 */
export const MOCK_PEOPLE: Record<string, Person> = {
  p_dana: { id: "p_dana", name: "Dana (client)", role: "client", sourceIds: { slack: "U_DANA" } },
  p_sam: { id: "p_sam", name: "Sam (QA)", role: "qa", sourceIds: { slack: "U_SAM" } },
  p_priya: { id: "p_priya", name: "Priya", role: "developer", sourceIds: { slack: "U_PRIYA", clickup: "201" } },
  p_bob: { id: "p_bob", name: "Bob", role: "developer", sourceIds: { slack: "U_BOB", clickup: "202" } },
  p_you: { id: "p_you", name: "You (PM)", role: "pm", sourceIds: { slack: "U_YOU", clickup: "100" } },
};
