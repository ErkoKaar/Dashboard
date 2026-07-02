import { NextResponse } from "next/server";
import { getCurrentWeekDates, nextDate } from "@/lib/date";

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  allDay: boolean;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? "Google token refresh ebaõnnestus");
  }
  return json.access_token as string;
}

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Google Calendar env muutujad puuduvad" }, { status: 500 });
  }

  try {
    const accessToken = await getAccessToken();
    const week = getCurrentWeekDates();
    const timeMin = `${week[0].date}T00:00:00Z`;
    const timeMax = `${nextDate(week[6].date)}T00:00:00Z`;

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: json.error?.message ?? "Google Calendar API viga" }, { status: 502 });
    }

    const events: CalendarEvent[] = (json.items ?? []).map((item: GoogleEvent) => {
      const allDay = !!item.start.date;
      const date = item.start.date ?? item.start.dateTime!.slice(0, 10);
      const time = allDay
        ? null
        : new Date(item.start.dateTime!).toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" });

      return { id: item.id, title: item.summary ?? "(Pealkirjata)", date, time, allDay };
    });

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Google Calendar viga" },
      { status: 500 },
    );
  }
}
