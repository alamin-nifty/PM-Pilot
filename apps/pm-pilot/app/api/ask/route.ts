import { NextResponse } from "next/server";
import { gatherContext, person } from "@/lib/agenda";

// The brain's seam. Retrieval works today; reasoning is the next piece to build.
// This returns the context the brain WOULD reason over, so the wiring is real.
export async function POST(req: Request) {
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question) return NextResponse.json({ error: "ask a question" }, { status: 400 });

  const ctx = gatherContext(question);
  const lines = [
    ...ctx.tasks.map((t) => `task ${t.id}: ${t.title} [${t.status}]`),
    ...ctx.items.map((i) => `${person(i.authorId)?.name ?? i.authorId}: ${i.body}`),
  ];

  return NextResponse.json({
    question,
    brainWired: false,
    note: "The brain isn't wired yet — below is the live context it would reason over (grounded with your docs). This is the retrieval seam working.",
    retrieved: lines,
  });
}
