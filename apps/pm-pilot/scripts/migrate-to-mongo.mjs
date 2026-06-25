// One-time: copy your tagged people (and any weekly scores) from the local
// SQLite database into MongoDB, and create the indexes the app needs.
//
// Run from apps/pm-pilot with your Atlas URI loaded:
//   node --env-file=.env.local scripts/migrate-to-mongo.mjs
import Database from "better-sqlite3";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pmpilot";
if (!uri) { console.error("MONGODB_URI is not set (use --env-file=.env.local)"); process.exit(1); }

// 1. read the local SQLite people + scores
const sqlite = new Database("./data/keystone.db", { readonly: true });
const people = sqlite
  .prepare("SELECT id, name, role, hidden FROM person_config WHERE hidden = 0 AND role != ''")
  .all();
let scores = [];
try {
  scores = sqlite.prepare("SELECT person_id, index_key, week, value, updated_at FROM weekly_score").all();
} catch { /* table may not exist */ }
sqlite.close();

console.log(`Found ${people.length} tagged people and ${scores.length} scores locally.`);

// 2. write into Mongo
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

await db.collection("scores").createIndex(
  { personId: 1, indexKey: 1, week: 1 }, { unique: true },
);
await db.collection("users").createIndex({ username: 1 }, { unique: true });

let upPeople = 0;
for (const p of people) {
  await db.collection("people").updateOne(
    { _id: p.id },
    { $setOnInsert: { name: p.name, role: p.role, hidden: 0 } },
    { upsert: true },
  );
  upPeople++;
}
let upScores = 0;
for (const s of scores) {
  await db.collection("scores").updateOne(
    { personId: s.person_id, indexKey: s.index_key, week: s.week },
    { $set: { value: s.value, updatedAt: s.updated_at, updatedBy: "" } },
    { upsert: true },
  );
  upScores++;
}

console.log(`✓ Migrated ${upPeople} people, ${upScores} scores into MongoDB "${dbName}".`);
await client.close();
