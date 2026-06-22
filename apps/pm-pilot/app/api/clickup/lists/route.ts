import { NextResponse } from "next/server";
import { db_getConfig } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId")?.trim();

  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const token = db_getConfig("clickup.apiToken");
  if (!token) {
    return NextResponse.json({ error: "No ClickUp API token saved yet" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}/list`, {
      headers: { Authorization: token },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `ClickUp error ${res.status}: ${text}` }, { status: 502 });
    }
    const data = await res.json() as { lists: { id: string; name: string }[] };
    const lists = (data.lists ?? []).map((l) => ({ id: l.id, name: l.name }));
    return NextResponse.json({ lists });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
  }
}
