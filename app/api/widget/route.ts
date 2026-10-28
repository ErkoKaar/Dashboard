import { timingSafeEqual } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { shiftDate } from "@/lib/date";
import { IS_DEMO } from "@/lib/demo/mode";
import { calendarConfigured, CalendarEvent, fetchCalendarEvents, TIMEZONE } from "@/lib/server/googleCalendar";
import { combineTodayTasks, groupTodayHabits, HABIT_COLUMNS, PROJECT_TASK_COLUMNS, TASK_COLUMNS } from "@/lib/today";

// iPhone'i avakuva vidin (Scriptable, scripts/scriptable/dashboard-widget.js): tänased taskid, habitid,
// järgmine kalendrisündmus ja ilm ühe kompaktse JSON-ina. Vidin ei saa Supabase'i sessiooni kasutada, seega käib ligipääs
// eraldi tokeniga (DASHBOARD_WIDGET_TOKEN) ja andmed loetakse service role võtmega, alati ainult
// DASHBOARD_ALLOWED_USER_ID ridadest. Ainult lugemine.

const MIN_TOKEN_LENGTH = 32;
const OPEN_LIMIT = 8;
const NEXT_EVENT_DAYS = 7;
const TALLINN = { latitude: 59.437, longitude: 24.7536 };

interface WidgetConfig {
  token: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
}

function config(): WidgetConfig | null {
  const token = process.env.DASHBOARD_WIDGET_TOKEN?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_TASKS_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.TASKS_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const userId = process.env.DASHBOARD_ALLOWED_USER_ID?.trim();
  // Lühike token on sama hea kui puuduv: endpoint jääb kinni.
  if (!token || token.length < MIN_TOKEN_LENGTH || !supabaseUrl || !serviceRoleKey || !userId) {
    // Logisse ainult nimed, mitte väärtused; vastus kliendile jääb üldiseks.
    const problems = [
      !token
        ? "DASHBOARD_WIDGET_TOKEN puudub"
        : token.length < MIN_TOKEN_LENGTH && `DASHBOARD_WIDGET_TOKEN on lühem kui ${MIN_TOKEN_LENGTH} märki`,
      !supabaseUrl && "NEXT_PUBLIC_TASKS_SUPABASE_URL puudub",
      !serviceRoleKey && "TASKS_SUPABASE_SERVICE_ROLE_KEY puudub",
      !userId && "DASHBOARD_ALLOWED_USER_ID puudub",
    ].filter(Boolean);
    console.error(`Vidina endpoint pole seadistatud: ${problems.join(", ")}`);
    return null;
  }
  return { token, supabaseUrl, serviceRoleKey, userId };
}

function authorized(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

let adminClient: SupabaseClient | null = null;

function getAdminClient({ supabaseUrl, serviceRoleKey }: WidgetConfig): SupabaseClient {
  adminClient ??= createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

function tallinnToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

/**
 * Sündmused tänasest NEXT_EVENT_DAYS päeva ette (tänased taskide jaoks, edasised järgmise sündmuse jaoks).
 * Aken algab päev varem, sest Google'i kuupäev on kalendri ajavööndis.
 */
async function upcomingEvents(today: string): Promise<CalendarEvent[] | null> {
  if (!calendarConfigured()) return null;
  try {
    return await fetchCalendarEvents(
      `${shiftDate(today, -1)}T00:00:00Z`,
      `${shiftDate(today, NEXT_EVENT_DAYS + 1)}T00:00:00Z`,
    );
  } catch {
    return null;
  }
}

async function weather(): Promise<{ temp: number; code: number; isDay: boolean } | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(TALLINN.latitude),
      longitude: String(TALLINN.longitude),
      current: "temperature_2m,weather_code,is_day",
      timezone: TIMEZONE,
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const current = (await res.json())?.current;
    if (typeof current?.temperature_2m !== "number" || typeof current?.weather_code !== "number") return null;
    return { temp: Math.round(current.temperature_2m), code: current.weather_code, isDay: current.is_day === 1 };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (IS_DEMO) return NextResponse.json({ error: "Demos pole saadaval" }, { status: 404 });

  const cfg = config();
  if (!cfg) return NextResponse.json({ error: "Server pole seadistatud" }, { status: 503 });
  if (!authorized(request, cfg.token)) return NextResponse.json({ error: "Vale token" }, { status: 401 });

  const today = tallinnToday();
  const client = getAdminClient(cfg);
  const [tasks, projectTasks, habits, logs, events, weatherNow] = await Promise.all([
    client.from("tasks").select(TASK_COLUMNS).eq("user_id", cfg.userId).eq("date", today).order("id"),
    client
      .from("project_tasks")
      .select(PROJECT_TASK_COLUMNS)
      .eq("user_id", cfg.userId)
      .eq("due_date", today)
      .order("sort_order"),
    client.from("habits").select(HABIT_COLUMNS).eq("user_id", cfg.userId).is("archived_at", null).order("id"),
    client.from("habit_logs").select("habit_id").eq("user_id", cfg.userId).eq("date", today),
    upcomingEvents(today),
    weather(),
  ]);

  const failed = [tasks, projectTasks, habits, logs].find((result) => result.error);
  if (failed?.error) {
    console.error("Vidina andmete lugemine ebaõnnestus:", failed.error.message);
    return NextResponse.json({ error: "Andmete lugemine ebaõnnestus" }, { status: 502 });
  }

  const todayTasks = combineTodayTasks(
    today,
    tasks.data ?? [],
    projectTasks.data ?? [],
    (events ?? []).filter((e) => e.date === today),
  );
  const todayHabits = groupTodayHabits(habits.data ?? [], new Set((logs.data ?? []).map((log) => log.habit_id)));

  // Google annab sündmused alguse järjekorras. Taskiks märgitud sündmused on taskide all, läbi saanud
  // sündmusi ei näidata ja tänane terve päeva sündmus ei peida järgmist kellaajalist.
  const now = Date.now();
  const next = (events ?? []).find(
    (e) => !e.isTask && e.date >= today && (e.allDay ? e.date > today : !e.end || Date.parse(e.end) > now),
  );

  return NextResponse.json(
    {
      date: today,
      tasks: {
        done: todayTasks.filter((t) => t.done).length,
        total: todayTasks.length,
        open: todayTasks.filter((t) => !t.done).slice(0, OPEN_LIMIT).map((t) => t.title),
      },
      habits: {
        done: todayHabits.filter((h) => h.done).length,
        total: todayHabits.length,
        open: todayHabits
          .filter((h) => !h.done)
          .slice(0, OPEN_LIMIT)
          .map((h) =>
            h.children.length > 0
              ? `${h.name} ${h.children.filter((c) => c.done).length}/${h.children.length}`
              : h.name,
          ),
      },
      // null = NEXT_EVENT_DAYS päeva jooksul sündmusi pole; calendarError = kalendrit ei saanud lugeda.
      nextEvent: next ? { date: next.date, time: next.time, title: next.title, allDay: next.allDay } : null,
      calendarError: events === null,
      weather: weatherNow,
      generatedAt: new Date(now).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
