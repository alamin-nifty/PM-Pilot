"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Role = "client" | "qa" | "developer" | "pm" | "";

interface Connections {
  slack: { botToken: string; channelIds: string };
  clickup: { apiToken: string; folderId: string; listId: string };
}

interface SprintList {
  id: string;
  name: string;
}

interface PersonRow {
  id: string;
  name: string;
  role: string;
  hidden: number;
}

const ROLES: Role[] = ["", "client", "qa", "developer", "pm"];

async function patch(body: object) {
  await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function SettingsPage() {
  const [connections, setConnections] = useState<Connections>({
    slack: { botToken: "", channelIds: "" },
    clickup: { apiToken: "", folderId: "", listId: "" },
  });
  const [sprintLists, setSprintLists] = useState<SprintList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [listsError, setListsError] = useState("");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [connDirty, setConnDirty] = useState(false);
  const [connSaving, setConnSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(({ people: p, connections: c }) => {
        setPeople(p ?? []);
        if (c) setConnections(c);
      })
      .catch(() => setError("Could not load settings."));
  }, []);

  // Warn before close if connection tokens are unsaved
  useEffect(() => {
    if (!connDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [connDirty]);

  const setSlack = (k: keyof Connections["slack"], v: string) => {
    setConnections((c) => ({ ...c, slack: { ...c.slack, [k]: v } }));
    setConnDirty(true);
  };
  const setClickup = (k: keyof Connections["clickup"], v: string) => {
    setConnections((c) => ({ ...c, clickup: { ...c.clickup, [k]: v } }));
    setConnDirty(true);
  };

  async function loadSprints() {
    setLoadingLists(true);
    setListsError("");
    try {
      const folderId = connections.clickup.folderId.trim();
      if (!folderId) { setListsError("Enter a folder ID first."); return; }
      const r = await fetch(`/api/clickup/lists?folderId=${folderId}`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setSprintLists(data.lists ?? []);
    } catch (e: any) {
      setListsError(e.message);
    } finally {
      setLoadingLists(false);
    }
  }

  async function saveConnections() {
    setConnSaving(true);
    try {
      await patch({ connections });
      setConnDirty(false);
    } catch {
      setError("Save failed.");
    } finally {
      setConnSaving(false);
    }
  }

  // Role and hidden changes save immediately to the DB — no bulk save needed
  const setRole = useCallback(async (person: PersonRow, role: string) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, role } : p)),
    );
    await patch({ people: [{ id: person.id, role }] });
  }, []);

  const hidePerson = useCallback(async (person: PersonRow) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, hidden: 1 } : p)),
    );
    await patch({ people: [{ id: person.id, hidden: true }] });
  }, []);

  const restorePerson = useCallback(async (person: PersonRow) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, hidden: 0 } : p)),
    );
    await patch({ people: [{ id: person.id, hidden: false }] });
  }, []);

  async function runSync() {
    setSyncing(true);
    setSyncMsg("");
    setError("");
    try {
      const r = await fetch("/api/config/sync", { method: "POST" });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error ?? "Sync failed");
      // Refresh people list (sync may have added new workspace members)
      const fresh = await fetch("/api/config").then((r) => r.json());
      setPeople(fresh.people ?? []);
      setSyncMsg("Sync complete — reload the dashboard to see fresh data.");
    } catch (e: any) {
      setError(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const active = people.filter(
    (p) =>
      p.hidden === 0 &&
      (filter === "" || p.name.toLowerCase().includes(filter.toLowerCase())),
  );
  const hidden = people.filter(
    (p) =>
      p.hidden === 1 &&
      (filter === "" || p.name.toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <p className="brand">Keystone</p>
          <span className="spacer" />
          <Link href="/" className="settings-back">← Dashboard</Link>
        </div>
      </header>

      <main className="wrap settings-wrap">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-sub">Private to you — never committed to git.</p>

        {error && <p className="settings-error">{error}</p>}

        {/* ---- Connections ---- */}
        <section className="settings-section">
          <h2 className="settings-h2">Connections</h2>

          <div className="settings-group">
            <p className="settings-group-label">Slack</p>
            <label className="settings-field">
              <span>Bot token</span>
              <input
                type="password"
                placeholder="xoxb-..."
                value={connections.slack.botToken}
                onChange={(e) => setSlack("botToken", e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Channel IDs</span>
              <input
                type="text"
                placeholder="C0ABC123, C0XYZ456"
                value={connections.slack.channelIds}
                onChange={(e) => setSlack("channelIds", e.target.value)}
              />
              <small>Comma-separated. Right-click a channel in Slack → Copy link → last path segment.</small>
            </label>
          </div>

          <div className="settings-group">
            <p className="settings-group-label">ClickUp</p>
            <label className="settings-field">
              <span>API token</span>
              <input
                type="password"
                placeholder="pk_..."
                value={connections.clickup.apiToken}
                onChange={(e) => setClickup("apiToken", e.target.value)}
              />
              <small>ClickUp → profile avatar → Settings → Apps → API token.</small>
            </label>
            <label className="settings-field">
              <span>Folder ID</span>
              <input
                type="text"
                placeholder="e.g. 12345678"
                value={connections.clickup.folderId}
                onChange={(e) => setClickup("folderId", e.target.value)}
              />
              <small>Right-click your sprints folder in ClickUp → Copy link → the number in the URL.</small>
            </label>
            <div className="settings-field">
              <span>Current sprint</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="people-role-select"
                  style={{ flex: 1, padding: "9px 10px", fontSize: 14 }}
                  value={connections.clickup.listId}
                  onChange={(e) => setClickup("listId", e.target.value)}
                  disabled={sprintLists.length === 0}
                >
                  {sprintLists.length === 0 ? (
                    <option value="">{connections.clickup.listId || "— load sprints first —"}</option>
                  ) : (
                    <>
                      <option value="">— select sprint —</option>
                      {sprintLists.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  className="btn-secondary"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={loadSprints}
                  disabled={loadingLists}
                >
                  {loadingLists ? "Loading…" : "Load sprints"}
                </button>
              </div>
              {listsError && <small style={{ color: "var(--blocked)" }}>{listsError}</small>}
              <small>Save connections first, then load sprints to pick the active one.</small>
            </div>
          </div>

          {connDirty && (
            <div className="unsaved-banner" style={{ marginTop: 14, marginBottom: 0 }}>
              Unsaved token changes — save before leaving.
            </div>
          )}
          <div className="settings-actions" style={{ marginTop: 14 }}>
            <button className="btn-primary" onClick={saveConnections} disabled={connSaving}>
              {connSaving ? "Saving…" : "Save connections"}
            </button>
            <button className="btn-secondary" onClick={runSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Run sync"}
            </button>
          </div>
          {syncMsg && <p className="settings-ok" style={{ marginTop: 10 }}>{syncMsg}</p>}
        </section>

        {/* ---- People & Roles ---- */}
        <section className="settings-section">
          <h2 className="settings-h2">People &amp; roles</h2>
          <p className="settings-hint">
            Role and remove changes save instantly. No save button needed.
          </p>

          {people.length === 0 ? (
            <p className="empty">No people yet — run a sync above first.</p>
          ) : (
            <>
              <input
                className="settings-search"
                type="search"
                placeholder="Filter by name…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />

              <div className="people-table">
                {active.map((p) => (
                  <div className="people-row" key={p.id}>
                    <span className="people-name">{p.name}</span>
                    <span className="people-id">{p.id}</span>
                    <select
                      className="people-role-select"
                      value={p.role}
                      onChange={(e) => setRole(p, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r === "" ? "— unset —" : r}
                        </option>
                      ))}
                    </select>
                    <button
                      className="people-remove"
                      onClick={() => hidePerson(p)}
                      title="Remove from portal"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {hidden.length > 0 && (
                <div className="hidden-toggle-wrap">
                  <button
                    className="hidden-toggle"
                    onClick={() => setShowHidden((v) => !v)}
                  >
                    {showHidden ? "▾" : "▸"} {hidden.length} removed{" "}
                    {hidden.length === 1 ? "person" : "people"}
                  </button>

                  {showHidden && (
                    <div className="people-table people-table--hidden">
                      {hidden.map((p) => (
                        <div className="people-row people-row--hidden" key={p.id}>
                          <span className="people-name">{p.name}</span>
                          <span className="people-id">{p.id}</span>
                          <span className="people-removed-label">removed</span>
                          <button
                            className="people-restore"
                            onClick={() => restorePerson(p)}
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
