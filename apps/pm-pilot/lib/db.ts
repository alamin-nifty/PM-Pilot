import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, "keystone.db"));
db.pragma("journal_mode = WAL"); // safe concurrent reads

db.exec(`
  CREATE TABLE IF NOT EXISTS person_config (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    role    TEXT NOT NULL DEFAULT '',
    hidden  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  -- Manual, PM-entered KPI inputs (the "your call" side of the hybrid model):
  -- one value per (person, metric). e.g. metric_key='communication'.
  CREATE TABLE IF NOT EXISTS kpi_input (
    person_id   TEXT NOT NULL,
    metric_key  TEXT NOT NULL,
    value       TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (person_id, metric_key)
  );
`);

// ---- person_config helpers ----

export interface PersonRow {
  id: string;
  name: string;
  role: string;
  hidden: number; // 0 | 1
}

export const db_getPeople = () =>
  db.prepare("SELECT * FROM person_config ORDER BY name").all() as PersonRow[];

export const db_upsertPerson = db.prepare<PersonRow>(`
  INSERT INTO person_config (id, name, role, hidden)
  VALUES (@id, @name, @role, @hidden)
  ON CONFLICT(id) DO UPDATE SET
    name   = excluded.name,
    role   = excluded.role,
    hidden = excluded.hidden
`);

export const db_setRole = db.prepare<{ id: string; role: string }>(
  "UPDATE person_config SET role = @role WHERE id = @id",
);

export const db_setHidden = db.prepare<{ id: string; hidden: number }>(
  "UPDATE person_config SET hidden = @hidden WHERE id = @id",
);

// Bulk-sync people from the context store (preserves existing role/hidden)
export function syncPeopleFromStore(
  storePeople: { id: string; name: string }[],
) {
  const upsert = db.prepare<{ id: string; name: string }>(`
    INSERT INTO person_config (id, name, role, hidden)
    VALUES (@id, @name, '', 0)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);
  const run = db.transaction((people: { id: string; name: string }[]) => {
    for (const p of people) upsert.run(p);
  });
  run(storePeople);
}

// ---- app_config helpers ----

export const db_getConfig = (key: string) =>
  (db.prepare("SELECT value FROM app_config WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? "";

export const db_setConfig = db.prepare<{ key: string; value: string }>(
  "INSERT INTO app_config (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
);

// ---- manual KPI input helpers (hybrid model) ----

export interface KpiInputRow { person_id: string; metric_key: string; value: string; }

export const db_getKpiInputs = () =>
  db.prepare("SELECT person_id, metric_key, value FROM kpi_input").all() as KpiInputRow[];

export const db_setKpiInput = db.prepare<{
  person_id: string; metric_key: string; value: string; updated_at: string;
}>(`
  INSERT INTO kpi_input (person_id, metric_key, value, updated_at)
  VALUES (@person_id, @metric_key, @value, @updated_at)
  ON CONFLICT(person_id, metric_key) DO UPDATE SET
    value = excluded.value, updated_at = excluded.updated_at
`);

export const db_delKpiInput = db.prepare<{ person_id: string; metric_key: string }>(
  "DELETE FROM kpi_input WHERE person_id = @person_id AND metric_key = @metric_key",
);

export default db;
