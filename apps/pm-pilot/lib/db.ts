import { MongoClient, type Db, type Collection } from "mongodb";

// One MongoClient, reused across requests and HMR reloads (avoids connection storms).
// Prod + dev both use MONGODB_URI (a MongoDB Atlas connection string).
const uri = process.env.MONGODB_URI ?? "";
const dbName = process.env.MONGODB_DB || "pmpilot";

const g = globalThis as unknown as { __mongo?: MongoClient };
function database(): Db {
  if (!uri) throw new Error("MONGODB_URI is not set — add it to apps/pm-pilot/.env.local");
  if (!g.__mongo) g.__mongo = new MongoClient(uri); // driver connects lazily on first op
  return g.__mongo.db(dbName);
}

// ---- document shapes (Mongo is schemaless; these are our conventions) ----
interface PeopleDoc { _id: string; name: string; role: string; hidden: number; }
interface ScoreDoc { personId: string; indexKey: string; week: string; value: number; updatedAt: string; updatedBy: string; }
interface UserDoc { _id?: unknown; username: string; passwordHash: string; displayName: string; }

const people = (): Collection<PeopleDoc> => database().collection<PeopleDoc>("people");
const scores = (): Collection<ScoreDoc> => database().collection<ScoreDoc>("scores");
const users = (): Collection<UserDoc> => database().collection<UserDoc>("users");

// ---- API shapes returned to the app (kept identical to the old SQLite layer) ----
export interface PersonRow { id: string; name: string; role: string; hidden: number; }
export interface ScoreRow { person_id: string; index_key: string; value: number; }
export interface UserRow { id: string; username: string; password_hash: string; display_name: string; }

// ---- people (the `people` collection = source of truth for the team) ----

export async function db_getPeople(): Promise<PersonRow[]> {
  const docs = await people().find({}).sort({ name: 1 }).toArray();
  return docs.map((d) => ({ id: d._id, name: d.name, role: d.role ?? "", hidden: d.hidden ?? 0 }));
}

export async function db_createPerson(p: { id: string; name: string; role: string }): Promise<void> {
  await people().updateOne(
    { _id: p.id },
    { $setOnInsert: { name: p.name, role: p.role, hidden: 0 } },
    { upsert: true },
  );
}

export async function db_setRole(id: string, role: string): Promise<void> {
  await people().updateOne({ _id: id }, { $set: { role } });
}

export async function db_setHidden(id: string, hidden: number): Promise<void> {
  await people().updateOne({ _id: id }, { $set: { hidden } });
}

// ---- weekly scores (`scores` collection, unique on personId+indexKey+week) ----

export async function db_getScores(week: string): Promise<ScoreRow[]> {
  const docs = await scores().find({ week }).toArray();
  return docs.map((d) => ({ person_id: d.personId, index_key: d.indexKey, value: d.value }));
}

export async function db_setScore(s: {
  person_id: string; index_key: string; week: string; value: number; updated_at: string; updated_by: string;
}): Promise<void> {
  await scores().updateOne(
    { personId: s.person_id, indexKey: s.index_key, week: s.week },
    { $set: { value: s.value, updatedAt: s.updated_at, updatedBy: s.updated_by } },
    { upsert: true },
  );
}

export async function db_delScore(s: { person_id: string; index_key: string; week: string }): Promise<void> {
  await scores().deleteOne({ personId: s.person_id, indexKey: s.index_key, week: s.week });
}

// ---- users (auth) ----

export async function db_getUserByUsername(username: string): Promise<UserRow | null> {
  const d = await users().findOne({ username });
  if (!d) return null;
  return { id: String(d._id), username: d.username, password_hash: d.passwordHash, display_name: d.displayName ?? "" };
}
