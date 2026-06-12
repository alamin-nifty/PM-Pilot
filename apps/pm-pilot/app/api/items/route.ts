import { NextResponse } from "next/server";
import { recentItems } from "@/lib/agenda";
export async function GET() { return NextResponse.json({ items: recentItems() }); }
