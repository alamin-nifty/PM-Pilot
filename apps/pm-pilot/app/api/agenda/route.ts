import { NextResponse } from "next/server";
import { getAgenda } from "@/lib/agenda";
export async function GET() { return NextResponse.json(getAgenda()); }
