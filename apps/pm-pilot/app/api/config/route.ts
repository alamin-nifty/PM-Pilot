import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db_getPeople, db_createPerson, db_setRole, db_setHidden } from "@/lib/db";

// People are managed entirely in the database now (no Slack/ClickUp sync).

export async function GET() {
  const people = await db_getPeople();
  return NextResponse.json({ people });
}

export async function POST(req: Request) {
  const body = await req.json();

  // Add a brand-new person (name + role) — there's no sync to create them anymore.
  if (body.newPerson?.name) {
    const id = `local:${randomUUID()}`;
    await db_createPerson({
      id,
      name: String(body.newPerson.name).trim(),
      role: body.newPerson.role ?? "",
    });
    return NextResponse.json({ ok: true, person: { id, name: body.newPerson.name, role: body.newPerson.role ?? "", hidden: 0 } });
  }

  // Save individual person updates (role and/or hidden)
  if (Array.isArray(body.people)) {
    for (const p of body.people) {
      if (p.id && p.role !== undefined) {
        await db_setRole(p.id, p.role);
      } else if (p.id && p.hidden !== undefined) {
        await db_setHidden(p.id, p.hidden ? 1 : 0);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
