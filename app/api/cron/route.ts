import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";

export async function GET() {
  const summary = await runAgent();
  return NextResponse.json(summary);
}

export async function POST() {
  const summary = await runAgent();
  return NextResponse.json(summary);
}
