import { NextResponse } from "next/server";
import { db_setScore, db_delScore } from "@/lib/db";

// Save (or clear) one person's 0–5 score for one index, for one week.
// POST { personId, indexKey, week, value }  — empty value clears it.
export async function POST(req: Request) {
  let body: { personId?: string; indexKey?: string; week?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { personId, indexKey, week, value } = body;
  if (!personId || !indexKey || !week) {
    return NextResponse.json({ error: "personId, indexKey and week are required" }, { status: 400 });
  }

  if (value === "" || value == null) {
    await db_delScore({ person_id: personId, index_key: indexKey, week });
  } else {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) {
      return NextResponse.json({ error: "value must be a number or empty" }, { status: 400 });
    }
    await db_setScore({
      person_id: personId,
      index_key: indexKey,
      week,
      value: n,
      updated_at: new Date().toISOString(),
      updated_by: "", // set to the logged-in user once auth is wired
    });
  }

  return NextResponse.json({ ok: true });
}
