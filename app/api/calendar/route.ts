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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIMEZONE = "Europe/Tallinn";

function missingEnv(): boolean {
  return (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  );
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
  if (missingEnv()) {
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
        : new Date(item.start.dateTime!).toLocaleTimeString("et-EE", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Tallinn",
          });

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

interface NewEventBody {
  title?: string;
  date?: string;
  allDay?: boolean;
  start?: string;
  end?: string;
}

export async function POST(request: Request) {
  if (missingEnv()) {
    return NextResponse.json({ error: "Google Calendar env muutujad puuduvad" }, { status: 500 });
  }

  let body: NewEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Vigane päring" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Pealkiri puudub" }, { status: 400 });
  if (!body.date || !DATE_RE.test(body.date)) {
    return NextResponse.json({ error: "Kuupäev on vigane" }, { status: 400 });
  }

  let start: Record<string, string>;
  let end: Record<string, string>;

  if (body.allDay) {
    // Google'i lõppkuupäev on välistav — ilma järgmise päevata jääks sündmus tühjaks.
    start = { date: body.date };
    end = { date: nextDate(body.date) };
  } else {
    if (!body.start || !TIME_RE.test(body.start) || !body.end || !TIME_RE.test(body.end)) {
      return NextResponse.json({ error: "Kellaaeg on vigane" }, { status: 400 });
    }
    if (body.end <= body.start) {
      return NextResponse.json({ error: "Lõpp peab olema algusest hiljem" }, { status: 400 });
    }
    // dateTime ilma nihketa + timeZone: Google tõlgendab aja selles vööndis.
    start = { dateTime: `${body.date}T${body.start}:00`, timeZone: TIMEZONE };
    end = { dateTime: `${body.date}T${body.end}:00`, timeZone: TIMEZONE };
  }

  try {
    const accessToken = await getAccessToken();
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary: title, start, end }),
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok) {
      // Lugemiseks mõeldud refresh token (calendar.readonly) annab kirjutamisel 403.
      const message =
        res.status === 403
          ? "Google ei luba kirjutada — GOOGLE_REFRESH_TOKEN vajab scope'i calendar.events"
          : (json.error?.message ?? "Google Calendar API viga");
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ id: json.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Google Calendar viga" },
      { status: 500 },
    );
  }
}
