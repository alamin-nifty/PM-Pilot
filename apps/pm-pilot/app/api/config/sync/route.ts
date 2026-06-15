import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { join } from "path";
import { readFileSync } from "fs";
import { syncPeopleFromStore } from "@/lib/db";
import { invalidateCache } from "@/lib/store-reader";

export async function POST() {
  try {
    const engineDir = join(process.cwd(), "..", "context-engine");
    execSync("npm run sync", { cwd: engineDir, timeout: 30_000 });

    // Merge any new people from the refreshed store into the DB
    // (existing roles and hidden flags are preserved by the upsert)
    try {
      const raw = readFileSync(
        join(process.cwd(), "..", "context-engine", "data", "context-store.json"),
        "utf-8",
      );
      const store = JSON.parse(raw) as { people: Record<string, { id: string; name: string }> };
      syncPeopleFromStore(Object.values(store.people));
    } catch {
      // store may not exist yet — non-fatal
    }

    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message) }, { status: 500 });
  }
}
