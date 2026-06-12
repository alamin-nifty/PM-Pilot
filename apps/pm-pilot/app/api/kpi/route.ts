import { NextResponse } from "next/server";
import { getTeamKpis } from "@/lib/kpi";
export async function GET() { return NextResponse.json(getTeamKpis()); }
