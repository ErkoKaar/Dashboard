import { NextResponse } from "next/server";

// FINANCE_WIDGET_PIN on server-only env — parool ei satu kliendi bundle'isse.
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.FINANCE_WIDGET_PIN });
}

export async function POST(request: Request) {
  const pin = process.env.FINANCE_WIDGET_PIN;
  if (!pin) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => null);
  const submitted = typeof body?.pin === "string" ? body.pin : "";
  return NextResponse.json({ ok: submitted === pin });
}
