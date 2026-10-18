#!/usr/bin/env node
// Dashboardi taskid → Severun HQ artifacti batch-kirjutused (ühesuunaline, dashboard on tõe allikas).
// Skoop: avatud taskid kuupäevaga täna või hiljem. Vanemad HQ-sse ei lähe ja kustutatakse sealt järgmisel sünkroonil.
// Sammud ja artifacti aadress: .claude/skills/hq-sync/SKILL.md
//
//   node scripts/hq-tasks.mjs [hq.jsonl] <out-dir>
//   hq.jsonl  ArtifactData päringu dokumendiread, üks JSON objekt rea kohta ({"id","data","version"}).
//             Jäta ära esimesel korral, kui HQ-s pole veel ühtegi dash-* dokumenti.
//   out-dir   siia tulevad docs/<id>.json ja writes-N.json (ArtifactData batch `writes`, kuni 50 rida faili kohta).
//
// Vajab .env.local-is: NEXT_PUBLIC_TASKS_SUPABASE_URL ja TASKS_SUPABASE_SERVICE_ROLE_KEY (RLS ei luba anon-võtmega lugeda).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length === 0 || args.length > 2) {
  console.error("Kasutus: node scripts/hq-tasks.mjs [hq.jsonl] <out-dir>");
  process.exit(1);
}
const outDir = resolve(args[args.length - 1]);
const hqFile = args.length === 2 ? resolve(args[0]) : null;
if (hqFile && !existsSync(hqFile)) {
  console.error(`Faili pole: ${hqFile}`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
}
const BASE = env.NEXT_PUBLIC_TASKS_SUPABASE_URL;
const KEY = env.TASKS_SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("Puudu .env.local-is: NEXT_PUBLIC_TASKS_SUPABASE_URL või TASKS_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function rest(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

async function byIds(table, select, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 100) {
    const list = `in.(${ids.slice(i, i + 100).map((id) => `"${id}"`).join(",")})`;
    rows.push(...(await rest(`${table}?select=${select}&id=${encodeURIComponent(list)}`)));
  }
  return rows;
}

// HQ-s juba olemas: ainult meie dokumendid (id dash-*), versioon on if_version jaoks kohustuslik.
const existing = new Map();
if (hqFile) {
  for (const line of readFileSync(hqFile, "utf8").split("\n")) {
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d && typeof d.id === "string" && d.id.startsWith("dash-") && d.data && d.version) existing.set(d.id, d);
  }
}

const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD kohalikus ajas
const [openProjectTasks, openTasks, projects] = await Promise.all([
  rest(`project_tasks?select=id,project_id,title,due_date&completed_at=is.null&due_date=gte.${today}&order=due_date.asc`),
  rest(`tasks?select=id,title,date,project_task_id&done=is.false&calendar_event_id=is.null&date=gte.${today}&order=date.asc`),
  rest("projects?select=id,title"),
]);
const projectTitle = new Map(projects.map((p) => [p.id, p.title]));

// Soovitud seis HQ-s. Sama dubleerimisreegel mis dashboardil (useTodayTasks): tähtajaga projekti-task on
// üks rida, tema peegelrida tasks-tabelis jääb välja.
const datedIds = new Set(openProjectTasks.map((p) => p.id));
const want = new Map();
for (const p of openProjectTasks) {
  const title = (p.title ?? "").trim();
  if (!title) continue;
  const project = projectTitle.get(p.project_id);
  want.set(`dash-p-${p.id}`, { title, due: p.due_date, summary: project ? `Projekt: ${project}` : null });
}
for (const t of openTasks) {
  const title = (t.title ?? "").trim();
  if (!title || (t.project_task_id && datedIds.has(t.project_task_id))) continue;
  want.set(`dash-t-${t.id}`, { title, due: t.date, summary: null });
}

// HQ-s olemas, aga dashboardis enam mitte avatud: tehtud (→ Done), kustutatud või möödunud kuupäevaga (→ kustuta).
const missing = [...existing.keys()].filter((id) => !want.has(id));
const closed = new Map();
const doneTasks = await byIds("tasks", "id,done,date", missing.filter((id) => id.startsWith("dash-t-")).map((id) => id.slice(7)));
for (const r of doneTasks) if (r.done) closed.set(`dash-t-${r.id}`, r.date);
const doneProjectTasks = await byIds("project_tasks", "id,completed_at,due_date", missing.filter((id) => id.startsWith("dash-p-")).map((id) => id.slice(7)));
for (const r of doneProjectTasks) if (r.completed_at) closed.set(`dash-p-${r.id}`, r.completed_at.slice(0, 10));

const now = new Date().toISOString();
const stamp = { updatedAt: now, updatedBy: "dashboard" };
const writes = [];
const log = { lisatud: [], uuendatud: [], tehtud: [], kustutatud: [] };
mkdirSync(join(outDir, "docs"), { recursive: true });
const docFile = (id, body) => {
  const f = join(outDir, "docs", `${id}.json`);
  writeFileSync(f, JSON.stringify(body, null, 2));
  return f;
};

for (const [id, w] of want) {
  const ex = existing.get(id);
  if (!ex) {
    const body = {
      title: w.title, owner: "Erko", priority: "Next", due: w.due, status: "Not started",
      waitingOn: null, client: null, summary: w.summary, notes: null, area: "Other", closed: null,
      source: "dashboard", createdAt: now, createdBy: "dashboard",
    };
    writes.push({ op: "set", collection: "tasks", doc_id: id, file_path: docFile(id, body) });
    log.lisatud.push(`${w.title} (${w.due})`);
    continue;
  }
  // HQ-s suletud taski (Done/Dropped) tagasi ei avata; pealkiri ja kuupäev tulevad dashboardist.
  const ch = {};
  if (ex.data.title !== w.title) ch.title = w.title;
  if ((ex.data.due ?? null) !== w.due) ch.due = w.due;
  if (Object.keys(ch).length === 0) continue;
  writes.push({ op: "update", collection: "tasks", doc_id: id, file_path: docFile(id, { ...ch, ...stamp }), if_version: ex.version });
  log.uuendatud.push(`${w.title}: ${Object.keys(ch).join(", ")}`);
}
for (const id of missing) {
  const ex = existing.get(id);
  const closedOn = closed.get(id);
  if (!closedOn) {
    writes.push({ op: "delete", collection: "tasks", doc_id: id, if_version: ex.version });
    log.kustutatud.push(ex.data.title);
  } else if (ex.data.status !== "Done" && ex.data.status !== "Dropped") {
    writes.push({ op: "update", collection: "tasks", doc_id: id, file_path: docFile(id, { status: "Done", closed: closedOn, ...stamp }), if_version: ex.version });
    log.tehtud.push(`${ex.data.title} (${closedOn})`);
  }
}

const files = [];
for (let i = 0; i < writes.length; i += 50) {
  const f = join(outDir, `writes-${files.length + 1}.json`);
  writeFileSync(f, JSON.stringify(writes.slice(i, i + 50), null, 2));
  files.push(f);
}

for (const [k, v] of Object.entries(log)) if (v.length) console.log(`${k} (${v.length}):\n  ${v.join("\n  ")}`);
if (writes.length === 0) console.log(`Midagi muuta pole. HQ-s on dashboardi ${want.size} avatud taski.`);
else console.log(`\nBatch-failid (${writes.length} kirjutust), kasuta ainult neid:\n  ${files.join("\n  ")}`);
