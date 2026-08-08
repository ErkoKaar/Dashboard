import { NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "You are a personal dashboard assistant. Write a short (3-5 sentence), friendly, specific English summary of the user's day based on the JSON data provided. Don't use headings or bullet lists, write it as flowing prose.";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY puudub" }, { status: 500 });
  }

  const data = await request.json();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(data) }],
    }),
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: json.error?.message ?? "Anthropic API viga" }, { status: 502 });
  }

  const summary = json.content?.[0]?.text ?? "";
  return NextResponse.json({ summary });
}
