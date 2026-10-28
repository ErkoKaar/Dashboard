// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: th-large;

// Dashboardi suur avakuva vidin iPhone'ile (Scriptable). Andmed tulevad dashboardi /api/widget
// endpointist: tänased taskid, habitid, kalender ja ilm. Paigaldus on README-s ("iPhone'i vidin").
//
// Dashboardi aadress ja token on telefoni Keychainis, mitte selles failis (repo on avalik). Esimesel
// käivitamisel Scriptable'i äpis küsitakse need; hiljem saab äpist käivitades neid muuta.

const KEY_URL = "dashboard-widget-url";
const KEY_TOKEN = "dashboard-widget-token";
const CACHE_FILE = "dashboard-widget.json";
const REFRESH_MINUTES = 15;
const LIST_ROWS = 4;
// Kui habiteid on teha, saavad taskid nimekirjas kuni nii mitu rida ja ülejäänud jäävad habititele.
const TASK_ROWS_WITH_HABITS = 2;
const LOGO_SIZE = 20;
const RING_SIZE = 96;
const DONE_RING_SIZE = 118;

// Logo värvid kanduvad rõngastesse: türkiis = taskid (väline), valge = habitid (sisemine).
const COLORS = {
  top: new Color("#0f1b21"),
  doneTop: new Color("#0c2c33"),
  bottom: new Color("#05090c"),
  foreground: new Color("#eef3f2"),
  muted: new Color("#a3b1b3"),
  accent: new Color("#10a1b4"),
  task: new Color("#2fc1d4"),
  taskTrack: new Color("#2fc1d4", 0.18),
  habit: new Color("#eef3f2"),
  habitTrack: new Color("#eef3f2", 0.12),
  surface: new Color("#ffffff", 0.06),
};

// --- Seadistus ---

async function askConfig() {
  const alert = new Alert();
  alert.title = "Dashboardi vidin";
  alert.message = "Dashboardi aadress (https://...) ja vidina token (DASHBOARD_WIDGET_TOKEN).";
  alert.addTextField("https://...", Keychain.contains(KEY_URL) ? Keychain.get(KEY_URL) : "");
  alert.addSecureTextField("Token", "");
  alert.addAction("Salvesta");
  alert.addCancelAction("Loobu");
  if ((await alert.presentAlert()) === -1) return false;

  const url = alert.textFieldValue(0).trim().replace(/\/+$/, "");
  const token = alert.textFieldValue(1).trim();
  if (!/^https:\/\/[^\s/]+/.test(url) || token.length < 32) {
    const error = new Alert();
    error.title = "Vigane seadistus";
    error.message = "Aadress peab algama https:// ja token olema vähemalt 32 märki.";
    error.addAction("OK");
    await error.presentAlert();
    return false;
  }
  Keychain.set(KEY_URL, url);
  Keychain.set(KEY_TOKEN, token);
  return true;
}

async function chooseAction() {
  const alert = new Alert();
  alert.title = "Dashboardi vidin";
  alert.addAction("Eelvaade");
  alert.addAction("Muuda aadressi ja tokenit");
  return (await alert.presentSheet()) === 1 ? "settings" : "preview";
}

function hasConfig() {
  return Keychain.contains(KEY_URL) && Keychain.contains(KEY_TOKEN);
}

// --- Andmed ---

const files = FileManager.local();
const cachePath = files.joinPath(files.documentsDirectory(), CACHE_FILE);

async function loadData() {
  try {
    const request = new Request(`${Keychain.get(KEY_URL)}/api/widget`);
    request.headers = { Authorization: `Bearer ${Keychain.get(KEY_TOKEN)}` };
    request.timeoutInterval = 15;
    const data = await request.loadJSON();
    if (request.response.statusCode !== 200) throw new Error(data?.error ?? `HTTP ${request.response.statusCode}`);
    files.writeString(cachePath, JSON.stringify(data));
    return { data, stale: false, error: null };
  } catch (error) {
    // Võrguviga: näita viimast õnnestunud seisu, kui see on olemas.
    const cached = files.fileExists(cachePath) ? JSON.parse(files.readString(cachePath)) : null;
    return { data: cached, stale: true, error: String(error.message ?? error) };
  }
}

// --- Vidin ---

function weatherSymbol(code, isDay) {
  if (code === 0) return isDay ? "sun.max.fill" : "moon.stars.fill";
  if (code <= 2) return isDay ? "cloud.sun.fill" : "cloud.moon.fill";
  if (code === 3) return "cloud.fill";
  if (code === 45 || code === 48) return "cloud.fog.fill";
  if (code >= 51 && code <= 57) return "cloud.drizzle.fill";
  if (code === 65 || code === 82) return "cloud.heavyrain.fill";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "cloud.rain.fill";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "cloud.snow.fill";
  if (code >= 95) return "cloud.bolt.rain.fill";
  return "cloud.fill";
}

function addText(stack, text, size, color, weight = "regular", rounded = false) {
  const item = stack.addText(text);
  item.font = Font[`${weight}${rounded ? "Rounded" : ""}SystemFont`](size);
  item.textColor = color;
  item.lineLimit = 1;
  return item;
}

function addSymbol(stack, name, size, color) {
  const image = stack.addImage(SFSymbol.named(name).image);
  image.imageSize = new Size(size, size);
  image.tintColor = color;
  return image;
}

function addCentered(widget, text, size, color, weight, rounded) {
  const row = widget.addStack();
  row.addSpacer();
  addText(row, text, size, color, weight, rounded);
  row.addSpacer();
}

function newCanvas(size) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  return ctx;
}

// Dashboardi logo (app/icon.png): valge ümar ruut ja ring üleval, türkiis riba all.
function drawLogo(ctx, x, y, size) {
  const gap = size * 0.1;
  const cell = (size - gap) / 2;
  const radius = cell * 0.26;
  ctx.setFillColor(COLORS.foreground);
  const tile = new Path();
  tile.addRoundedRect(new Rect(x, y, cell, cell), radius, radius);
  ctx.addPath(tile);
  ctx.fillPath();
  ctx.fillEllipse(new Rect(x + cell + gap, y, cell, cell));
  ctx.setFillColor(COLORS.accent);
  const bar = new Path();
  bar.addRoundedRect(new Rect(x, y + cell + gap, size, cell), radius, radius);
  ctx.addPath(bar);
  ctx.fillPath();
}

function logoImage(size) {
  const ctx = newCanvas(size);
  drawLogo(ctx, 0, 0, size);
  return ctx.getImage();
}

function ratio({ done, total }) {
  return total > 0 ? Math.min(1, done / total) : 0;
}

// DrawContext ei oska kaari: kaar on tihedalt üksteist katvad täpid, mis annavad ka ümarad otsad.
function drawArc(ctx, center, radius, width, progress, color) {
  if (progress <= 0) return;
  ctx.setFillColor(color);
  const steps = Math.max(2, Math.ceil((2 * Math.PI * radius * progress) / (width / 4)));
  for (let i = 0; i <= steps; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * progress * i) / steps;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    ctx.fillEllipse(new Rect(x - width / 2, y - width / 2, width, width));
  }
}

/** Kaks rõngast nagu Apple'i Activity: väline taskid, sisemine habitid; soovi korral logo keskel. */
function ringsImage(size, tasks, habits, withLogo) {
  const ctx = newCanvas(size);
  const width = size * 0.11;
  const center = size / 2;
  const outer = center - width / 2;
  const inner = outer - width - size * 0.035;
  const rings = [
    [outer, ratio(tasks), COLORS.task, COLORS.taskTrack],
    [inner, ratio(habits), COLORS.habit, COLORS.habitTrack],
  ];
  ctx.setLineWidth(width);
  for (const [radius, progress, color, track] of rings) {
    ctx.setStrokeColor(track);
    ctx.strokeEllipse(new Rect(center - radius, center - radius, radius * 2, radius * 2));
    drawArc(ctx, center, radius, width, progress, color);
  }
  if (withLogo) {
    const logo = size * 0.26;
    drawLogo(ctx, center - logo / 2, center - logo / 2, logo);
  }
  return ctx.getImage();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clockTime(iso) {
  const format = new DateFormatter();
  format.dateFormat = "HH:mm";
  return format.string(new Date(iso));
}

// Päis: logo, kuupäev ja paremal ilm (või vana seisu korral, millal viimati õnnestus).
function addHeader(widget, data, stale) {
  const header = widget.addStack();
  header.centerAlignContent();
  const logo = header.addImage(logoImage(LOGO_SIZE));
  logo.imageSize = new Size(LOGO_SIZE, LOGO_SIZE);
  header.addSpacer(8);
  const dateFormat = new DateFormatter();
  dateFormat.locale = "et";
  dateFormat.dateFormat = "EEEE, d. MMMM";
  const date = addText(header, capitalize(dateFormat.string(new Date(`${data.date}T12:00:00`))), 15, COLORS.foreground, "semibold");
  date.minimumScaleFactor = 0.8;
  header.addSpacer();
  if (stale) {
    addText(header, `Uuendamata ${clockTime(data.generatedAt)}`, 11, COLORS.muted, "medium");
  } else if (data.weather) {
    addSymbol(header, weatherSymbol(data.weather.code, data.weather.isDay), 15, COLORS.foreground);
    header.addSpacer(4);
    addText(header, `${data.weather.temp}°`, 15, COLORS.foreground, "semibold", true);
  }
}

function addCount(stack, label, part, color) {
  const row = stack.addStack();
  row.bottomAlignContent();
  addText(row, `${part.done}/${part.total}`, 28, color, "bold", true);
  row.addSpacer(8);
  // Väiksem silt tõstetakse suure numbri alusjoonele.
  const caption = row.addStack();
  caption.centerAlignContent();
  caption.setPadding(0, 0, 4, 0);
  addText(caption, label, 14, COLORS.muted, "medium");
  if (part.total > 0 && part.done === part.total) {
    caption.addSpacer(5);
    addSymbol(caption, "checkmark.circle.fill", 13, color);
  }
}

function addHero(widget, data) {
  const row = widget.addStack();
  row.centerAlignContent();
  const rings = row.addImage(ringsImage(RING_SIZE, data.tasks, data.habits, false));
  rings.imageSize = new Size(RING_SIZE, RING_SIZE);
  row.addSpacer(18);
  const counts = row.addStack();
  counts.layoutVertically();
  addCount(counts, "Tasks", data.tasks, COLORS.task);
  counts.addSpacer(6);
  addCount(counts, "Habits", data.habits, COLORS.habit);
  row.addSpacer();
}

// Järgmised asjad: tegemata taskid (türkiis ring), siis suuremalt tegemata habitid (valge ruut).
function addNextUp(widget, data) {
  const { tasks, habits } = data;
  if (tasks.open.length + habits.open.length === 0) {
    addText(widget, "Tänaseks pole midagi plaanis", 14, COLORS.muted);
    return;
  }
  const habitRows = Math.min(habits.open.length, LIST_ROWS - Math.min(tasks.open.length, TASK_ROWS_WITH_HABITS));
  const taskRows = Math.min(tasks.open.length, LIST_ROWS - habitRows);
  // Teksti algus on mõlemal 20 pt kaugusel, kuigi habiti ikoon on suurem.
  const shown = [
    ...tasks.open.slice(0, taskRows).map((title) => ({ title, symbol: "circle", icon: 12, text: 14, weight: "regular", color: COLORS.task })),
    ...habits.open.slice(0, habitRows).map((title) => ({ title, symbol: "app", icon: 14, text: 16, weight: "medium", color: COLORS.habit })),
  ];
  for (const item of shown) {
    const row = widget.addStack();
    row.centerAlignContent();
    addSymbol(row, item.symbol, item.icon, item.color);
    row.addSpacer(20 - item.icon);
    addText(row, item.title, item.text, COLORS.foreground, item.weight);
    widget.addSpacer(5);
  }
  // Arv tuleb loenduritest, sest endpoint saadab nimesid kuni 8.
  const open = data.tasks.total - data.tasks.done + (data.habits.total - data.habits.done);
  const more = open - shown.length;
  if (more > 0) {
    const row = widget.addStack();
    row.addSpacer(20);
    addText(row, `+${more} veel`, 12, COLORS.muted, "medium");
  }
}

function formatDate(date, pattern) {
  const format = new DateFormatter();
  format.locale = "et";
  format.dateFormat = pattern;
  return format.string(date);
}

// "14:00" täna, "Homme 09:00", edasi nädalapäevaga ("Reede 14:00"); terve päeva sündmusel ainult päev.
function eventLabel(event, today) {
  const noon = (date) => new Date(`${date}T12:00:00`);
  const tomorrow = noon(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day =
    event.date === today
      ? "Täna"
      : event.date === formatDate(tomorrow, "yyyy-MM-dd")
        ? "Homme"
        : capitalize(formatDate(noon(event.date), "EEEE"));
  if (event.allDay) return day;
  return event.date === today ? event.time : `${day} ${event.time}`;
}

// Kalendririba: ainult järgmine sündmus, ka tulevastest päevadest.
function addEventStrip(widget, data) {
  const strip = widget.addStack();
  strip.centerAlignContent();
  strip.backgroundColor = COLORS.surface;
  strip.cornerRadius = 12;
  strip.setPadding(9, 12, 9, 12);
  const event = data.nextEvent;
  if (!event) {
    addSymbol(strip, "calendar", 13, COLORS.muted);
    strip.addSpacer(8);
    addText(strip, data.calendarError ? "Kalender pole saadaval" : "Lähipäevil sündmusi pole", 13, COLORS.muted);
    strip.addSpacer();
    return;
  }
  addText(strip, eventLabel(event, data.date), 14, COLORS.task, "semibold", true);
  strip.addSpacer(10);
  addText(strip, event.title, 14, COLORS.foreground, "medium");
  strip.addSpacer();
}

function doneSummary(tasks, habits) {
  const parts = [];
  if (tasks.total > 0) parts.push(`${tasks.total} ${tasks.total === 1 ? "task" : "taski"}`);
  if (habits.total > 0) parts.push(`${habits.total} ${habits.total === 1 ? "habit" : "habitit"}`);
  return parts.join(" ja ");
}

// Kõik tehtud: suletud rõngad logoga keskel, rõngaste all kokkuvõte.
function addAllDone(widget, data) {
  widget.addSpacer();
  const center = widget.addStack();
  center.addSpacer();
  const rings = center.addImage(ringsImage(DONE_RING_SIZE, data.tasks, data.habits, true));
  rings.imageSize = new Size(DONE_RING_SIZE, DONE_RING_SIZE);
  center.addSpacer();
  widget.addSpacer(12);
  addCentered(widget, "Kõik tehtud", 26, COLORS.foreground, "bold", true);
  widget.addSpacer(2);
  addCentered(widget, doneSummary(data.tasks, data.habits), 13, COLORS.muted, "medium");
  widget.addSpacer();
}

// Avakuvale lisatud dashboardi veebiäpp avaneb webapp:// aadressiga Safari asemel. Kuju on telefonis
// proovitud: aadress ilma https://-ita ja kaldkriipsuga lõpus.
function webAppUrl(url) {
  return `webapp://${url.replace(/^https:\/\//, "")}/`;
}

function background(top) {
  const gradient = new LinearGradient();
  gradient.colors = [top, COLORS.bottom];
  gradient.locations = [0, 1];
  return gradient;
}

function buildWidget({ data, stale, error }) {
  const widget = new ListWidget();
  widget.setPadding(16, 16, 16, 16);
  widget.url = webAppUrl(Keychain.get(KEY_URL));
  widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);

  if (!data) {
    widget.backgroundGradient = background(COLORS.top);
    const header = widget.addStack();
    header.centerAlignContent();
    const logo = header.addImage(logoImage(LOGO_SIZE));
    logo.imageSize = new Size(LOGO_SIZE, LOGO_SIZE);
    header.addSpacer(8);
    addText(header, "Dashboard", 15, COLORS.foreground, "semibold");
    widget.addSpacer(10);
    const message = widget.addText(`Andmeid ei saanud: ${error}`);
    message.font = Font.systemFont(13);
    message.textColor = COLORS.muted;
    widget.addSpacer();
    return widget;
  }

  const { tasks, habits } = data;
  const allDone = tasks.total + habits.total > 0 && tasks.done === tasks.total && habits.done === habits.total;
  widget.backgroundGradient = background(allDone ? COLORS.doneTop : COLORS.top);

  addHeader(widget, data, stale);
  if (allDone) {
    addAllDone(widget, data);
  } else {
    widget.addSpacer(14);
    addHero(widget, data);
    widget.addSpacer(14);
    addNextUp(widget, data);
    widget.addSpacer();
  }
  addEventStrip(widget, data);
  return widget;
}

function messageWidget(text) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.bottom;
  const logo = widget.addImage(logoImage(LOGO_SIZE));
  logo.imageSize = new Size(LOGO_SIZE, LOGO_SIZE);
  widget.addSpacer(8);
  const message = widget.addText(text);
  message.font = Font.systemFont(13);
  message.textColor = COLORS.muted;
  return widget;
}

// --- Käivitus ---

if (config.runsInApp) {
  if (!hasConfig() || (await chooseAction()) === "settings") await askConfig();
  if (hasConfig()) await buildWidget(await loadData()).presentLarge();
} else if (!hasConfig()) {
  Script.setWidget(messageWidget("Ava Scriptable ja käivita see skript, et sisestada dashboardi aadress ja token."));
} else if (config.widgetFamily !== "large") {
  Script.setWidget(messageWidget("See vidin on tehtud suurele suurusele: vali vidina lisamisel suur."));
} else {
  Script.setWidget(buildWidget(await loadData()));
}
Script.complete();
