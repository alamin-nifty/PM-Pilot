import { NextResponse } from "next/server";
import { allTasks } from "@/lib/agenda";
export async function GET() { return NextResponse.json({ tasks: allTasks() }); }
