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
const TASK_LINES = 4;
const EVENT_LINES = 3;

const COLORS = {
  top: new Color("#0f1b21"),
  bottom: new Color("#05090c"),
  foreground: new Color("#eef3f2"),
  muted: new Color("#a3b1b3"),
  accent: new Color("#10a1b4"),
  accentBright: new Color("#2fc1d4"),
  track: new Color("#2a3b42"),
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

function addText(stack, text, size, color, weight = "regular") {
  const item = stack.addText(text);
  item.font =
    weight === "bold"
      ? Font.boldSystemFont(size)
      : weight === "semibold"
        ? Font.semiboldSystemFont(size)
        : Font.systemFont(size);
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

// Suure vidina sisu laius ligikaudu ekraani laiuse järgi (vidinal on ~16 pt sisemine serv).
function contentWidth() {
  return Math.round(Device.screenSize().width * 0.86) - 32;
}

function addProgress(stack, done, total) {
  const width = contentWidth();
  const bar = stack.addStack();
  bar.size = new Size(width, 4);
  bar.cornerRadius = 2;
  bar.backgroundColor = COLORS.track;
  const filled = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  if (filled > 0) {
    const fill = bar.addStack();
    fill.size = new Size(Math.max(4, Math.round(width * filled)), 4);
    fill.cornerRadius = 2;
    fill.backgroundColor = done === total ? COLORS.accentBright : COLORS.accent;
  }
  bar.addSpacer();
}

function addSectionHeader(widget, title, done, total) {
  const row = widget.addStack();
  row.centerAlignContent();
  addText(row, title, 13, COLORS.muted, "semibold");
  row.addSpacer();
  const complete = total > 0 && done === total;
  const count = addText(row, `${done}/${total}`, 13, complete ? COLORS.accentBright : COLORS.foreground);
  count.font = Font.semiboldMonospacedSystemFont(13);
  widget.addSpacer(5);
  addProgress(widget, done, total);
  widget.addSpacer(7);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildWidget({ data, stale, error }) {
  const widget = new ListWidget();
  const gradient = new LinearGradient();
  gradient.colors = [COLORS.top, COLORS.bottom];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;
  widget.setPadding(16, 16, 14, 16);
  widget.url = Keychain.get(KEY_URL);
  widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);

  if (!data) {
    addText(widget, "Dashboard", 15, COLORS.foreground, "bold");
    widget.addSpacer(6);
    const message = widget.addText(`Andmeid ei saanud: ${error}`);
    message.font = Font.systemFont(13);
    message.textColor = COLORS.muted;
    return widget;
  }

  // Päis: kuupäev ja ilm.
  const header = widget.addStack();
  header.centerAlignContent();
  const dateFormat = new DateFormatter();
  dateFormat.locale = "et";
  dateFormat.dateFormat = "EEEE, d. MMMM";
  addText(header, capitalize(dateFormat.string(new Date(`${data.date}T12:00:00`))), 16, COLORS.foreground, "bold");
  header.addSpacer();
  if (data.weather) {
    addSymbol(header, weatherSymbol(data.weather.code, data.weather.isDay), 16, COLORS.foreground);
    header.addSpacer(4);
    addText(header, `${data.weather.temp}°`, 15, COLORS.foreground, "semibold");
  }
  widget.addSpacer(12);

  // Today's Tasks: loendur, riba ja tegemata taskid.
  addSectionHeader(widget, "Today's Tasks", data.tasks.done, data.tasks.total);
  const openTasks = data.tasks.open.slice(0, TASK_LINES);
  for (const title of openTasks) {
    const row = widget.addStack();
    row.centerAlignContent();
    addSymbol(row, "circle", 11, COLORS.muted);
    row.addSpacer(7);
    addText(row, title, 13, COLORS.foreground);
    widget.addSpacer(3);
  }
  const moreTasks = data.tasks.total - data.tasks.done - openTasks.length;
  if (moreTasks > 0) addText(widget, `+${moreTasks} veel`, 11, COLORS.muted);
  if (data.tasks.total > 0 && data.tasks.done === data.tasks.total) addText(widget, "Kõik tehtud", 13, COLORS.accentBright);
  if (data.tasks.total === 0) addText(widget, "Tänaseks taske pole", 13, COLORS.muted);
  widget.addSpacer(10);

  // Habits: loendur, riba ja tegemata habitid ühe-kahe reana.
  addSectionHeader(widget, "Habits", data.habits.done, data.habits.total);
  const habitText =
    data.habits.open.length > 0
      ? data.habits.open.join(", ")
      : data.habits.total > 0
        ? "Kõik tehtud"
        : "Aktiivseid habiteid pole";
  const habits = addText(widget, habitText, 13, data.habits.open.length > 0 ? COLORS.foreground : COLORS.accentBright);
  habits.lineLimit = 2;
  widget.addSpacer(10);

  // Kalender: järgmised sündmused.
  addText(widget, "Täna kalendris", 13, COLORS.muted, "semibold");
  widget.addSpacer(5);
  if (data.events === null) {
    addText(widget, "Kalender pole saadaval", 13, COLORS.muted);
  } else if (data.events.length === 0) {
    addText(widget, "Rohkem sündmusi pole", 13, COLORS.muted);
  } else {
    for (const event of data.events.slice(0, EVENT_LINES)) {
      const row = widget.addStack();
      row.centerAlignContent();
      const time = addText(row, event.allDay ? "Päev" : event.time, 13, COLORS.accentBright, "semibold");
      time.font = Font.semiboldMonospacedSystemFont(13);
      row.addSpacer(8);
      addText(row, event.title, 13, COLORS.foreground);
      widget.addSpacer(3);
    }
  }

  widget.addSpacer();

  // Jalus ainult siis, kui seis pole värske: millal viimati õnnestus.
  if (stale) {
    const time = new DateFormatter();
    time.dateFormat = "HH:mm";
    addText(widget, `Uuendamata, viimane seis ${time.string(new Date(data.generatedAt))}`, 10, COLORS.muted);
  }
  return widget;
}

function messageWidget(text) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.bottom;
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
