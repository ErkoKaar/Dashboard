import { getCurrentWeekDates, toDateString, todayDate } from "@/lib/date";
import type { CalendarEvent } from "@/lib/queries/useCalendarEvents";
import type { ChessStats, ChessTrendPoint } from "@/lib/queries/useChess";
import type { EstHoopGames, EstHoopTopScorer } from "@/lib/queries/useEstHoopGames";
import { DEMO_USER_ID } from "@/lib/demo/mode";

// Demo andmed. Kõik isiklik (ülesanded, harjumused, projektid, märkmed, failid, raha, kalender, male) on
// välja mõeldud ja kuupäevad arvutatakse tänase päeva järgi, nii et vaade näeb igal päeval elav välja.
// EstHoopi koondise mängud on päris avalikud andmed (EstHoopi API hetketõmmis 27.10.2026).

export type DemoProject = "tasks" | "finance";
export type Row = Record<string, unknown>;

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Deterministlik pseudojuhuslikkus (mulberry32): sama demo igal laadimisel. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let idCounter = 0;
/** Kasvav id fikstuuridele ja demos lisatud ridadele: order("id") järjestab lisamise järjekorras. */
export const nextDemoId = () => `id-${String(++idCounter).padStart(6, "0")}`;
const id = nextDemoId;

// --- TaskManageri projekt -------------------------------------------------------------------------------

const TODAY_TASKS: [string, boolean][] = [
  ["Reply to Anna about the logo drafts", true],
  ["Review pull request #42", false],
  ["Book a dentist appointment", false],
  ["Buy groceries for the weekend", true],
];

const OTHER_DAY_TASKS = [
  "Send invoice to Northwind",
  "Update portfolio case study",
  "Call the bank about the card",
  "Plan next sprint",
  "Water the plants",
  "Fix newsletter signup bug",
  "Prepare slides for Friday demo",
  "Clean up inbox",
  "Back up the laptop",
  "Renew gym membership",
];

function seedTasks(): Row[] {
  const today = todayDate();
  const rand = random(7);
  const rows: Row[] = [];
  const task = (date: string, title: string, done: boolean) =>
    rows.push({ id: id(), user_id: DEMO_USER_ID, date, title, done, project_task_id: null, calendar_event_id: null });

  let pool = 0;
  for (const { date } of getCurrentWeekDates()) {
    if (date === today) continue;
    const count = date < today ? 3 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      task(date, OTHER_DAY_TASKS[pool++ % OTHER_DAY_TASKS.length], date < today && rand() > 0.25);
    }
  }
  for (const [title, done] of TODAY_TASKS) task(today, title, done);
  return rows;
}

interface ProjectSeed {
  title: string;
  section: "projects" | "personal";
  criticality: string;
  tasks: { title: string; criticality: string; due?: number; doneToday?: boolean }[];
}

const PROJECTS: ProjectSeed[] = [
  {
    title: "Portfolio redesign",
    section: "projects",
    criticality: "critical",
    tasks: [
      { title: "Write README for the dashboard", criticality: "critical", due: 0 },
      { title: "Ship the new hero section", criticality: "critical" },
      { title: "Pick a typeface for headings", criticality: "warning" },
      { title: "Export case study images", criticality: "on_track" },
      { title: "Collect client testimonials", criticality: "on_track", doneToday: true },
    ],
  },
  {
    title: "Mobile app MVP",
    section: "projects",
    criticality: "warning",
    tasks: [
      { title: "Set up the auth flow", criticality: "critical", due: 1 },
      { title: "Design onboarding screens", criticality: "warning" },
      { title: "Push notifications spike", criticality: "on_track" },
    ],
  },
  {
    title: "Newsletter automation",
    section: "projects",
    criticality: "on_track",
    tasks: [
      { title: "Connect the email API", criticality: "on_track" },
      { title: "Write the welcome sequence", criticality: "warning", due: 2 },
    ],
  },
  {
    title: "Half marathon training",
    section: "personal",
    criticality: "on_track",
    tasks: [
      { title: "Long run 16 km", criticality: "warning", due: 3 },
      { title: "Buy new running shoes", criticality: "on_track" },
    ],
  },
  {
    title: "Home office setup",
    section: "personal",
    criticality: "warning",
    tasks: [
      { title: "Order a monitor arm", criticality: "critical" },
      { title: "Sort out cable management", criticality: "on_track" },
    ],
  },
];

function seedProjects(): { projects: Row[]; projectTasks: Row[] } {
  const projects: Row[] = [];
  const projectTasks: Row[] = [];
  const now = new Date().toISOString();
  PROJECTS.forEach((p, index) => {
    const projectId = id();
    projects.push({
      id: projectId,
      user_id: DEMO_USER_ID,
      title: p.title,
      section: p.section,
      criticality: p.criticality,
      sort_order: index,
      completed_at: null,
    });
    p.tasks.forEach((t, taskIndex) => {
      projectTasks.push({
        id: id(),
        user_id: DEMO_USER_ID,
        project_id: projectId,
        title: t.title,
        criticality: t.criticality,
        sort_order: taskIndex,
        completed_at: t.doneToday ? now : null,
        due_date: t.due === undefined ? null : dayOffset(t.due),
      });
    });
  });
  return { projects, projectTasks };
}

function seedHabits(): { habits: Row[]; logs: Row[] } {
  const habit = (name: string, parentId: string | null = null): Row => ({
    id: id(),
    user_id: DEMO_USER_ID,
    name,
    parent_id: parentId,
    archived_at: null,
  });
  const exercise = habit("Exercise");
  const reading = habit("Read 20 pages");
  const routine = habit("Morning routine");
  const bed = habit("Make the bed", routine.id as string);
  const stretch = habit("Stretch for 10 minutes", routine.id as string);
  const phone = habit("No phone in the first hour", routine.id as string);
  const spanish = habit("Practice Spanish");
  const habits = [exercise, reading, routine, bed, stretch, phone, spanish];
  const loggable = [exercise, reading, bed, stretch, phone, spanish];

  const today = todayDate();
  const rand = random(11);
  const logs: Row[] = [];
  for (const { date } of getCurrentWeekDates()) {
    if (date > today) break;
    const done = date === today ? [exercise, bed, stretch] : loggable.filter(() => rand() > 0.3);
    for (const h of done) logs.push({ id: id(), habit_id: h.id, date });
  }
  return { habits, logs };
}

const QUICK_NOTE = `<h2>Ideas</h2>
<ul><li><p>Weekly review template: move it here from the notes app</p></li><li><p>Try a dark-only palette for the blog</p></li><li><p>Small CLI to export finance data as CSV</p></li></ul>
<h2>Reading list</h2>
<ul><li><p>Refactoring UI</p></li><li><p>The Pragmatic Programmer</p></li></ul>
<p>Everything here is demo data and resets when you reload the page.</p>`;

function seedFileSystem(): Row[] {
  const updated = new Date().toISOString();
  const node = (name: string, type: "file" | "folder", parentId: string | null, position: number, content?: string): Row => ({
    id: id(),
    user_id: DEMO_USER_ID,
    parent_id: parentId,
    name,
    type,
    content: type === "file" ? (content ?? "") : null,
    position,
    updated_at: updated,
  });

  const work = node("Work", "folder", null, 0);
  const personal = node("Personal", "folder", null, 1);
  const clients = node("Clients", "folder", work.id as string, 0);
  return [
    work,
    personal,
    node(
      "Welcome",
      "file",
      null,
      2,
      "<h1>Welcome to the demo</h1><p>Folders and files live in your browser only. Create, rename, drag and edit anything: a reload brings the demo back to its starting state.</p>",
    ),
    clients,
    node(
      "Northwind brief",
      "file",
      clients.id as string,
      0,
      "<h2>Northwind brief</h2><ul><li><p>Five-page site, booking form on the contact page</p></li><li><p>Launch before the spring campaign</p></li></ul>",
    ),
    node(
      "Meeting notes",
      "file",
      work.id as string,
      1,
      "<h2>Sprint planning</h2><p>Goal: ship onboarding and the new hero section.</p><ul><li><p>Auth flow first, then notifications</p></li></ul>",
    ),
    node(
      "Trip to Lisbon",
      "file",
      personal.id as string,
      0,
      "<h2>Lisbon</h2><ul><li><p>Book flights by Friday</p></li><li><p>LX Factory, Belém, sunset at Miradouro da Senhora do Monte</p></li></ul>",
    ),
    node("Recipes", "file", personal.id as string, 1, "<h2>Weeknight pasta</h2><p>Garlic, chili, lemon, parmesan.</p>"),
  ];
}

// --- FinanceTrackeri projekt -----------------------------------------------------------------------------

function seedFinance(): Tables {
  const now = new Date();
  const lastDay = now.getDate();
  // Kuu päev, aga mitte tulevikus: kuu alguses kogunevad kanded tänasesse päeva.
  const onDay = (day: number) =>
    new Date(now.getFullYear(), now.getMonth(), Math.min(day, lastDay), 12).toISOString();
  const entry = (amount: number, description: string, category: string, day: number): Row => ({
    id: id(),
    user_id: DEMO_USER_ID,
    amount,
    description,
    category,
    date: onDay(day),
  });

  return {
    categories: ["Food", "Transport", "Housing", "Fun", "Subscriptions"].map((name) => ({ id: name.toLowerCase(), name })),
    income_categories: ["Salary", "Freelance"].map((name) => ({ id: name.toLowerCase(), name })),
    expenses: [
      entry(650, "Rent", "housing", 1),
      entry(54.2, "Groceries", "food", 2),
      entry(11.99, "Music streaming", "subscriptions", 3),
      entry(45, "Monthly bus pass", "transport", 4),
      entry(38.9, "Groceries", "food", 8),
      entry(24, "Cinema", "fun", 11),
      entry(71.35, "Groceries", "food", 15),
      entry(32.5, "Dinner with friends", "fun", 19),
      entry(18.4, "Taxi", "transport", 23),
      entry(46.8, "Groceries", "food", 26),
    ],
    incomes: [entry(2650, "Salary", "salary", 5), entry(480, "Landing page for a café", "freelance", 17)],
    bank_connections: [{ id: id(), user_id: DEMO_USER_ID, balance: 4820.35 }],
  };
}

type Tables = Record<string, Row[]>;

export function seedTables(project: DemoProject): Tables {
  if (project === "finance") return seedFinance();
  const { projects, projectTasks } = seedProjects();
  const { habits, logs } = seedHabits();
  return {
    tasks: seedTasks(),
    projects,
    project_tasks: projectTasks,
    habits,
    habit_logs: logs,
    quick_notes: [{ id: id(), user_id: DEMO_USER_ID, content: QUICK_NOTE, updated_at: new Date().toISOString() }],
    taskmanager_order: [],
    fs_nodes: seedFileSystem(),
  };
}

// --- Google Calendar (/api/calendar) ---------------------------------------------------------------------

function timed(id: string, title: string, start: Date, minutes: number, recurring = false): CalendarEvent {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    id,
    title,
    date: toDateString(start),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    allDay: false,
    end: new Date(start.getTime() + minutes * 60_000).toISOString(),
    isTask: false,
    recurring,
  };
}

function at(date: string, hour: number, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute);
}

/** Jooksva nädala sündmused nagu /api/calendar need annab. */
export function seedCalendarEvents(): CalendarEvent[] {
  const week = getCurrentWeekDates().map((d) => d.date);
  const today = todayDate();
  const events: CalendarEvent[] = [
    timed("evt-planning", "Sprint planning", at(week[0], 10), 60, true),
    timed("evt-lunch", "Lunch with Mari", at(week[2], 12), 60),
    timed("evt-demo", "Demo day", at(week[4], 15), 60),
    { id: "evt-run", title: "Long run", date: week[5], time: null, allDay: true, end: null, isTask: true, recurring: false },
  ];
  for (const date of week.slice(0, 5)) {
    events.push(timed(`evt-standup-${date}`, "Team standup", at(date, 9, 30), 15, true));
  }

  // Tänane päev: ülesandeks märgitud terve päeva sündmus ja paari tunni pärast algav koosolek
  // (päises "Design review in 2h 0m").
  events.push({ id: "evt-domain", title: "Renew the domain", date: today, time: null, allDay: true, end: null, isTask: true, recurring: false });
  const review = new Date();
  review.setMinutes(Math.ceil(review.getMinutes() / 15) * 15 + 120, 0, 0);
  events.push(timed("evt-review", "Design review", review, 45));
  events.push(timed("evt-gym", "Gym", at(today, 18), 60, true));

  return events.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}

// --- Chess.com ------------------------------------------------------------------------------------------

export const DEMO_CHESS_STATS: ChessStats = {
  rating: { current: 1186, best: 1243 },
  record: { win: 214, loss: 197, draw: 18 },
};

/** Viimase kolme kuu rapid-mängud; viimased neli on sel nädalal, et "W/L/D" vaates oleks midagi. */
export function seedChessTrend(): ChessTrendPoint[] {
  const rand = random(3);
  const points: ChessTrendPoint[] = [];
  let rating = DEMO_CHESS_STATS.rating.current;
  // Tagurpidi tänasest, et viimane punkt oleks praegune rating.
  for (let i = 0; i < 48; i++) {
    const daysAgo = i < 4 ? i : 4 + Math.floor((i - 4) * 1.9);
    const roll = rand();
    const result = roll < 0.47 ? "win" : roll < 0.94 ? "loss" : "draw";
    points.push({ date: dayOffset(-daysAgo), rating, result });
    rating -= result === "win" ? 8 : result === "loss" ? -8 : 0;
  }
  return points.reverse();
}

// --- EstHoop (koondis) ----------------------------------------------------------------------------------

const ESTHOOP_GAMES: EstHoopGames = {
  upcoming: [
    { id: "fiba-127088", homeTeam: { name: "Estonia" }, awayTeam: { name: "France" }, startTimestamp: 1795798800, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" } },
    { id: "fiba-127090", homeTeam: { name: "Finland" }, awayTeam: { name: "Estonia" }, startTimestamp: 1796056200, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" } },
    { id: "fiba-127094", homeTeam: { name: "Estonia" }, awayTeam: { name: "Hungary" }, startTimestamp: 1803513600, timeTBD: true, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" } },
    { id: "fiba-127095", homeTeam: { name: "France" }, awayTeam: { name: "Estonia" }, startTimestamp: 1803772800, timeTBD: true, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" } },
  ],
  recent: [
    { id: "fiba-127085", homeTeam: { name: "Estonia" }, awayTeam: { name: "Finland" }, startTimestamp: 1788105600, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" }, homeScore: { current: 67 }, awayScore: { current: 96 } },
    { id: "fiba-127083", homeTeam: { name: "Hungary" }, awayTeam: { name: "Estonia" }, startTimestamp: 1787846400, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" }, homeScore: { current: 85 }, awayScore: { current: 67 } },
    { id: "fiba-127611", homeTeam: { name: "Czechia" }, awayTeam: { name: "Estonia" }, startTimestamp: 1783350000, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" }, homeScore: { current: 75 }, awayScore: { current: 73 } },
    { id: "fiba-127603", homeTeam: { name: "Estonia" }, awayTeam: { name: "Slovenia" }, startTimestamp: 1783094400, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" }, homeScore: { current: 93 }, awayScore: { current: 62 } },
    { id: "fiba-127606", homeTeam: { name: "Estonia" }, awayTeam: { name: "Sweden" }, startTimestamp: 1772384400, timeTBD: false, tournament: { name: "FIBA Basketball World Cup 2027 European Qualifiers" }, homeScore: { current: 69 }, awayScore: { current: 79 } },
  ],
};

/** Tulevased mängud ainult siis, kui need pole veel möödas: vana tõmmis ei näita minevikku tulevikuna. */
export function demoEstHoopGames(): EstHoopGames {
  const now = Date.now() / 1000;
  return { ...ESTHOOP_GAMES, upcoming: ESTHOOP_GAMES.upcoming.filter((g) => g.startTimestamp > now) };
}

export const DEMO_ESTHOOP_TOP_SCORER: EstHoopTopScorer = {
  name: "Kristian Kullamae",
  slug: "kristian-kullamae",
  pts: 15,
  reb: 4,
  ast: 5,
  game: ESTHOOP_GAMES.recent[0],
};
