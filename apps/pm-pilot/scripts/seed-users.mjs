// Create (or update) login accounts. Run as many as you like — re-running with
// an existing username overwrites its password (that's how you "reset" one).
//
// Run from apps/pm-pilot with your Atlas URI loaded:
//   node --env-file=.env.local scripts/seed-users.mjs
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import readline from "readline/promises";
import { stdin, stdout } from "process";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pmpilot";
if (!uri) { console.error("MONGODB_URI is not set (use --env-file=.env.local)"); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const users = client.db(dbName).collection("users");
await users.createIndex({ username: 1 }, { unique: true });

const rl = readline.createInterface({ input: stdin, output: stdout });
console.log("Create login accounts. Leave the username blank to finish.\n");

while (true) {
  const username = (await rl.question("Username: ")).trim();
  if (!username) break;
  const displayName = (await rl.question("Display name (shown in the app): ")).trim() || username;
  const password = (await rl.question("Password: ")).trim();
  if (!password) { console.log("  (skipped — no password)\n"); continue; }

  const password_hash = await bcrypt.hash(password, 10);
  await users.updateOne(
    { username },
    { $set: { passwordHash: password_hash, displayName }, $setOnInsert: { _id: randomUUID() } },
    { upsert: true },
  );
  console.log(`  ✓ saved "${username}"\n`);
}

rl.close();
console.log("Done.");
await client.close();
