import { NextResponse } from "next/server";
import { db_setKpiInput, db_delKpiInput } from "@/lib/db";

// Save (or clear) a manual PM-entered KPI value for one person.
// POST { personId, metricKey, value }  — empty value clears it.
export async function POST(req: Request) {
  let body: { personId?: string; metricKey?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { personId, metricKey, value } = body;
  if (!personId || !metricKey) {
    return NextResponse.json({ error: "personId and metricKey are required" }, { status: 400 });
  }

  if (value) {
    db_setKpiInput.run({
      person_id: personId,
      metric_key: metricKey,
      value: String(value),
      updated_at: new Date().toISOString(),
    });
  } else {
    db_delKpiInput.run({ person_id: personId, metric_key: metricKey });
  }

  return NextResponse.json({ ok: true });
}
