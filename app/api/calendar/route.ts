import { NextResponse } from "next/server";
import { getCurrentWeekDates, nextDate } from "@/lib/date";
import { requireUser } from "@/lib/server/requireUser";
import {
  CalendarApiError,
  calendarConfigured,
  fetchCalendarEvents,
  getAccessToken,
  TASK_PROP,
  TIMEZONE,
} from "@/lib/server/googleCalendar";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  if (!calendarConfigured()) {
    return NextResponse.json({ error: "Google Calendar env muutujad puuduvad" }, { status: 500 });
  }

  try {
    const week = getCurrentWeekDates();
    const events = await fetchCalendarEvents(`${week[0].date}T00:00:00Z`, `${nextDate(week[6].date)}T00:00:00Z`);
    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof CalendarApiError) return NextResponse.json({ error: err.message }, { status: 502 });
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
  weekly?: boolean;
  task?: boolean;
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  if (!calendarConfigured()) {
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
      body: JSON.stringify({
        summary: title,
        start,
        end,
        // Nädalapäev tuleb algusekuupäevast; kordus on lõputu, lõpetamine käib Google Calendaris.
        ...(body.weekly && { recurrence: ["RRULE:FREQ=WEEKLY"] }),
        // Kordussündmuse instantsid pärivad extendedProperties'e, nii et märge jõuab igale korrale.
        ...(body.task && { extendedProperties: { private: { [TASK_PROP]: "1" } } }),
      }),
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
