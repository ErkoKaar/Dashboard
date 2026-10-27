// Google Calendari ühendus (OAuth refresh token env-ist). Ainult serveris: kalendri route ja iPhone'i
// vidina endpoint.

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  allDay: boolean;
  /** Kellaajalisel sündmusel lõpu ISO aeg, terve päeva sündmusel null. */
  end: string | null;
  isTask: boolean;
  recurring: boolean;
}

interface GoogleEvent {
  id: string;
  summary?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  recurringEventId?: string;
  extendedProperties?: { private?: Record<string, string> };
}

export const TIMEZONE = "Europe/Tallinn";
/** extendedProperties.private võti, millega dashboard märgib sündmuse taskiks. */
export const TASK_PROP = "dashboardTask";

/** Google Calendar API vastas veaga (route annab selle edasi 502-na). */
export class CalendarApiError extends Error {}

export function calendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN,
  );
}

export async function getAccessToken(): Promise<string> {
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

/** Põhikalendri sündmused vahemikus [timeMin, timeMax) (ISO ajad), korduvad lahti võetud. */
export async function fetchCalendarEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok) throw new CalendarApiError(json.error?.message ?? "Google Calendar API viga");

  return (json.items ?? []).map((item: GoogleEvent) => {
    const allDay = !!item.start.date;
    const date = item.start.date ?? item.start.dateTime!.slice(0, 10);
    const time = allDay
      ? null
      : new Date(item.start.dateTime!).toLocaleTimeString("et-EE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: TIMEZONE,
        });

    return {
      id: item.id,
      title: item.summary ?? "(Pealkirjata)",
      date,
      time,
      allDay,
      end: allDay ? null : (item.end.dateTime ?? null),
      isTask: item.extendedProperties?.private?.[TASK_PROP] === "1",
      recurring: !!item.recurringEventId,
    };
  });
}
