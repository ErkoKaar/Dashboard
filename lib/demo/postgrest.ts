import { nextDemoId, seedTables, type DemoProject, type Row } from "@/lib/demo/fixtures";

// Demo Supabase: supabase-js ehitab päringu PostgREST URL-iks ja see moodul vastab sellele mälus olevast
// tabelist. Hookid jäävad muutmata. Toetatud on see osa PostgRESTist, mida lib/queries kasutab: select
// veergude loeteluna (ilma seosteta), filtrid eq/neq/gt/gte/lt/lte/is/in/or, order, limit, insert, upsert
// (on_conflict), update, delete ning single/maybeSingle. Muudatused elavad lehe uuesti laadimiseni.

type Tables = Record<string, Row[]>;

const databases = new Map<DemoProject, Tables>();

function database(project: DemoProject): Tables {
  let db = databases.get(project);
  if (!db) {
    db = seedTables(project);
    databases.set(project, db);
  }
  return db;
}

// Väärtused, mida andmebaas lisamisel ise täidab.
const DEFAULTS: Record<string, () => Row> = {
  tasks: () => ({ done: false, project_task_id: null, calendar_event_id: null }),
  projects: () => ({ criticality: "on_track", sort_order: 0, completed_at: null, section: "projects" }),
  project_tasks: () => ({ criticality: "on_track", sort_order: 0, completed_at: null, due_date: null }),
  habits: () => ({ parent_id: null, archived_at: null }),
  fs_nodes: () => ({ content: null, position: 0, updated_at: new Date().toISOString() }),
};

// Unikaalsusreeglid, mida UI vigade kaudu näitab (useFileSystem: sama nimi samas kaustas).
const UNIQUE: Record<string, string[][]> = {
  fs_nodes: [["parent_id", "name"]],
};

interface PgError {
  status: number;
  code: string;
  message: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorResponse({ status, code, message }: PgError): Response {
  return json({ code, message, details: null, hint: null }, status);
}

// --- Filtrid ---------------------------------------------------------------------------------------------

type Predicate = (row: Row) => boolean;

/** Jagab komadega, aga mitte jutumärkide või sulgude sees. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const char of input) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "(") depth++;
    else if (!quoted && char === ")") depth--;
    if (char === "," && depth === 0 && !quoted) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function unquote(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function compare(a: unknown, b: string): number {
  if (typeof a === "number") return a - Number(b);
  const left = String(a);
  return left < b ? -1 : left > b ? 1 : 0;
}

function operatorPredicate(column: string, operator: string, value: string): Predicate {
  if (operator.startsWith("not.")) {
    const negated = operatorPredicate(column, operator.slice(4), value);
    return (row) => !negated(row);
  }
  switch (operator) {
    case "eq":
      return (row) => row[column] != null && String(row[column]) === value;
    case "neq":
      return (row) => row[column] != null && String(row[column]) !== value;
    case "gt":
      return (row) => row[column] != null && compare(row[column], value) > 0;
    case "gte":
      return (row) => row[column] != null && compare(row[column], value) >= 0;
    case "lt":
      return (row) => row[column] != null && compare(row[column], value) < 0;
    case "lte":
      return (row) => row[column] != null && compare(row[column], value) <= 0;
    case "is":
      if (value === "null") return (row) => row[column] == null;
      return (row) => row[column] === (value === "true");
    case "in": {
      const values = new Set(splitTopLevel(value.replace(/^\(|\)$/g, "")).map(unquote));
      return (row) => row[column] != null && values.has(String(row[column]));
    }
    default:
      throw new Error(`Demo andmebaas ei toeta filtrit "${operator}"`);
  }
}

/** "col=op.value" (URL-i parameeter) või "col.op.value" (or-loendi liige). */
function parseCondition(column: string, expression: string): Predicate {
  const dot = expression.indexOf(".");
  let operator = expression.slice(0, dot);
  let value = expression.slice(dot + 1);
  if (operator === "not") {
    const next = value.indexOf(".");
    operator = `not.${value.slice(0, next)}`;
    value = value.slice(next + 1);
  }
  return operatorPredicate(column, operator, value);
}

function parseOr(expression: string): Predicate {
  const terms = splitTopLevel(expression.replace(/^\(|\)$/g, "")).map((term) => {
    const dot = term.indexOf(".");
    return parseCondition(term.slice(0, dot), term.slice(dot + 1));
  });
  return (row) => terms.some((test) => test(row));
}

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function parseFilters(params: URLSearchParams): Predicate[] {
  const filters: Predicate[] = [];
  for (const [key, value] of params) {
    if (RESERVED_PARAMS.has(key)) continue;
    filters.push(key === "or" ? parseOr(value) : parseCondition(key, value));
  }
  return filters;
}

// --- Vastuse kuju ----------------------------------------------------------------------------------------

function orderRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = order.split(",").map((part) => {
    const [column, direction = "asc", nulls] = part.split(".");
    // Postgresi vaikimisi: ASC puhul NULL-id lõpus, DESC puhul alguses.
    const nullsFirst = nulls ? nulls === "nullsfirst" : direction === "desc";
    return { column, sign: direction === "desc" ? -1 : 1, nullsFirst };
  });
  return [...rows].sort((a, b) => {
    for (const { column, sign, nullsFirst } of keys) {
      const x = a[column];
      const y = b[column];
      if (x == null && y == null) continue;
      if (x == null) return nullsFirst ? -1 : 1;
      if (y == null) return nullsFirst ? 1 : -1;
      const diff =
        typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "et");
      if (diff !== 0) return diff * sign;
    }
    return 0;
  });
}

function selectColumns(rows: Row[], select: string | null): Row[] {
  if (!select || select.trim() === "*") return rows.map((row) => ({ ...row }));
  const columns = select.split(",").map((c) => c.trim()).filter(Boolean);
  return rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null])));
}

/** single() küsib objekti; muidu massiiv (maybeSingle töötleb massiivi kliendis). */
function respondRows(rows: Row[], params: URLSearchParams, headers: Headers, status: number): Response {
  const projected = selectColumns(rows, params.get("select"));
  if (headers.get("Accept")?.includes("vnd.pgrst.object+json")) {
    if (projected.length !== 1) {
      return errorResponse({
        status: 406,
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      });
    }
    return json(projected[0], status);
  }
  return json(projected, status);
}

// --- Kirjutamine -----------------------------------------------------------------------------------------

function violatesUnique(table: string, rows: Row[], candidate: Row): PgError | null {
  for (const columns of UNIQUE[table] ?? []) {
    const clash = rows.some(
      (row) => row !== candidate && row.id !== candidate.id && columns.every((c) => (row[c] ?? null) === (candidate[c] ?? null)),
    );
    if (clash) {
      return { status: 409, code: "23505", message: `duplicate key value violates unique constraint on ${table}` };
    }
  }
  return null;
}

function newRow(table: string, values: Row): Row {
  const now = new Date().toISOString();
  return { id: nextDemoId(), created_at: now, ...DEFAULTS[table]?.(), ...values };
}

/** fs_nodes kustutab alamad cascade'iga (supabase/fs_nodes.sql). */
function withDescendants(table: string, rows: Row[], removed: Row[]): Set<Row> {
  const result = new Set(removed);
  if (table !== "fs_nodes") return result;
  let added = true;
  while (added) {
    added = false;
    const ids = new Set([...result].map((r) => r.id));
    for (const row of rows) {
      if (!result.has(row) && ids.has(row.parent_id)) {
        result.add(row);
        added = true;
      }
    }
  }
  return result;
}

async function readBody(init: RequestInit | undefined): Promise<Row[]> {
  if (typeof init?.body !== "string" || init.body === "") return [];
  const parsed = JSON.parse(init.body) as Row | Row[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function handleWrite(
  method: string,
  table: string,
  rows: Row[],
  body: Row[],
  params: URLSearchParams,
  headers: Headers,
): Response {
  const prefer = headers.get("Prefer") ?? "";
  const returnRows = prefer.includes("return=representation");
  const status = method === "POST" ? 201 : 200;
  const done = (changed: Row[]) =>
    returnRows ? respondRows(changed, params, headers, status) : new Response(null, { status: 204 });

  if (method === "POST") {
    const resolution = prefer.match(/resolution=(merge|ignore)-duplicates/)?.[1];
    const conflictColumns = params.get("on_conflict")?.split(",").map((c) => c.trim()) ?? ["id"];
    const changed: Row[] = [];
    for (const values of body) {
      const existing = resolution
        ? rows.find((row) => conflictColumns.every((c) => row[c] != null && row[c] === values[c]))
        : undefined;
      if (existing) {
        if (resolution === "merge") {
          Object.assign(existing, values);
          changed.push(existing);
        }
        continue;
      }
      const row = newRow(table, values);
      const violation = violatesUnique(table, rows, row);
      if (violation) return errorResponse(violation);
      rows.push(row);
      changed.push(row);
    }
    return done(changed);
  }

  const filters = parseFilters(params);
  const matched = rows.filter((row) => filters.every((test) => test(row)));

  if (method === "PATCH") {
    const values = body[0] ?? {};
    for (const row of matched) {
      const violation = violatesUnique(table, rows, { ...row, ...values });
      if (violation) return errorResponse(violation);
    }
    for (const row of matched) Object.assign(row, values);
    return done(matched);
  }

  // DELETE
  const removed = withDescendants(table, rows, matched);
  const kept = rows.filter((row) => !removed.has(row));
  rows.splice(0, rows.length, ...kept);
  return done(matched);
}

export async function handleSupabaseRequest(
  project: DemoProject,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!match) return errorResponse({ status: 404, code: "DEMO", message: "Demos seda Supabase'i teenust pole" });

  const tables = database(project);
  const table = match[1];
  const rows = (tables[table] ??= []);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const params = url.searchParams;

  try {
    if (method === "GET" || method === "HEAD") {
      const filters = parseFilters(params);
      let result = orderRows(
        rows.filter((row) => filters.every((test) => test(row))),
        params.get("order"),
      );
      const limit = Number(params.get("limit"));
      if (Number.isInteger(limit) && limit > 0) result = result.slice(0, limit);
      return respondRows(result, params, headers, 200);
    }
    return handleWrite(method, table, rows, await readBody(init), params, headers);
  } catch (error) {
    return errorResponse({ status: 400, code: "DEMO", message: (error as Error).message });
  }
}
