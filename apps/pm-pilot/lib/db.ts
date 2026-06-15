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

export default db;
