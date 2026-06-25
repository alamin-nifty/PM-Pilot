"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Role = "qa" | "developer" | "pm" | "";

interface PersonRow {
  id: string;
  name: string;
  role: string;
  hidden: number;
}

const ROLES: Role[] = ["", "developer", "qa", "pm"];

async function patch(body: object) {
  return fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function SettingsPage() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("developer");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(({ people: p }) => setPeople(p ?? []))
      .catch(() => setError("Could not load settings."));
  }, []);

  async function addPerson() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await patch({ newPerson: { name, role: newRole } });
      const data = await res.json();
      if (data.person) setPeople((prev) => [...prev, data.person].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch {
      setError("Could not add person.");
    } finally {
      setAdding(false);
    }
  }

  // Role and hidden changes save immediately to the DB
  const setRole = useCallback(async (person: PersonRow, role: string) => {
    setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, role } : p)));
    await patch({ people: [{ id: person.id, role }] });
  }, []);

  const hidePerson = useCallback(async (person: PersonRow) => {
    setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, hidden: 1 } : p)));
    await patch({ people: [{ id: person.id, hidden: true }] });
  }, []);

  const restorePerson = useCallback(async (person: PersonRow) => {
    setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, hidden: 0 } : p)));
    await patch({ people: [{ id: person.id, hidden: false }] });
  }, []);

  const match = (p: PersonRow) => filter === "" || p.name.toLowerCase().includes(filter.toLowerCase());
  const active = people.filter((p) => p.hidden === 0 && match(p));
  const hidden = people.filter((p) => p.hidden === 1 && match(p));

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <p className="brand">Keystone</p>
          <span className="spacer" />
          <Link href="/kpi" className="settings-back">← Scorecard</Link>
        </div>
      </header>

      <main className="wrap settings-wrap">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-sub">Manage who appears on the scorecard.</p>

        {error && <p className="settings-error">{error}</p>}

        <section className="settings-section">
          <h2 className="settings-h2">People &amp; roles</h2>
          <p className="settings-hint">
            Add your developers and QA here, then score them on the scorecard. Role and remove changes save instantly.
          </p>

          {/* Add person */}
          <div className="settings-field" style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 18 }}>
            <input
              className="settings-search"
              style={{ flex: 1, marginBottom: 0 }}
              type="text"
              placeholder="New person's name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPerson()}
            />
            <select
              className="people-role-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
            >
              {ROLES.filter((r) => r !== "").map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={addPerson} disabled={adding || !newName.trim()}>
              {adding ? "Adding…" : "Add"}
            </button>
          </div>

          {people.length === 0 ? (
            <p className="empty">No people yet — add someone above.</p>
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
                    <select
                      className="people-role-select"
                      value={p.role}
                      onChange={(e) => setRole(p, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r === "" ? "— unset —" : r}</option>
                      ))}
                    </select>
                    <button className="people-remove" onClick={() => hidePerson(p)} title="Remove from scorecard">×</button>
                  </div>
                ))}
              </div>

              {hidden.length > 0 && (
                <div className="hidden-toggle-wrap">
                  <button className="hidden-toggle" onClick={() => setShowHidden((v) => !v)}>
                    {showHidden ? "▾" : "▸"} {hidden.length} removed {hidden.length === 1 ? "person" : "people"}
                  </button>
                  {showHidden && (
                    <div className="people-table people-table--hidden">
                      {hidden.map((p) => (
                        <div className="people-row people-row--hidden" key={p.id}>
                          <span className="people-name">{p.name}</span>
                          <span className="people-removed-label">removed</span>
                          <button className="people-restore" onClick={() => restorePerson(p)}>Restore</button>
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
