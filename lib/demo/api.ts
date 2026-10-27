import { seedCalendarEvents } from "@/lib/demo/fixtures";
import { DEMO_PUBLIC_API } from "@/lib/demo/mode";
import type { CalendarEvent, NewCalendarEvent } from "@/lib/queries/useCalendarEvents";

// Demo /api: isiklikud teenused (kalender, Finance PIN) vastavad siit, avalikud spordiandmed lähevad
// päris route'idesse (server lubab demos ainult neid, lib/server/requireUser.ts). Muu on 404.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

let calendar: CalendarEvent[] | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Sama valideerimine mis app/api/calendar POST-is; viga tuleb tekstina tagasi. */
function toEvent(input: Partial<NewCalendarEvent>): CalendarEvent | string {
  const title = input.title?.trim();
  if (!title) return "Pealkiri puudub";
  if (!input.date || !DATE_RE.test(input.date)) return "Kuupäev on vigane";
  const base = { id: `evt-${Date.now()}`, title, date: input.date, isTask: !!input.task, recurring: !!input.weekly };
  if (input.allDay) return { ...base, time: null, allDay: true, end: null };

  if (!input.start || !input.end || !TIME_RE.test(input.start) || !TIME_RE.test(input.end)) {
    return "Kellaaeg on vigane";
  }
  if (input.end <= input.start) return "Lõpp peab olema algusest hiljem";
  const [y, m, d] = input.date.split("-").map(Number);
  const [hour, minute] = input.end.split(":").map(Number);
  return { ...base, time: input.start, allDay: false, end: new Date(y, m - 1, d, hour, minute).toISOString() };
}

async function handleCalendar(init: RequestInit): Promise<Response> {
  calendar ??= seedCalendarEvents();
  if ((init.method ?? "GET").toUpperCase() !== "POST") return json({ events: calendar });

  let input: Partial<NewCalendarEvent>;
  try {
    input = JSON.parse(typeof init.body === "string" ? init.body : "");
  } catch {
    return json({ error: "Vigane päring" }, 400);
  }
  const event = toEvent(input);
  if (typeof event === "string") return json({ error: event }, 400);
  calendar = [...calendar, event].sort((a, b) =>
    (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")),
  );
  return json({ id: event.id });
}

export async function demoApiFetch(input: string, init: RequestInit): Promise<Response> {
  const { pathname } = new URL(input, window.location.origin);

  if (DEMO_PUBLIC_API.test(pathname)) return fetch(input, init);
  if (pathname === "/api/calendar") return handleCalendar(init);
  if (pathname === "/api/finance-pin") {
    return json((init.method ?? "GET").toUpperCase() === "POST" ? { ok: true } : { enabled: false });
  }
  return json({ error: "Demos pole saadaval" }, 404);
}
