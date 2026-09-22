"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Check, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { Button } from "@/components/ui/Button";
import {
  CalendarEvent,
  useAddCalendarEvent,
  useCalendarEvents,
} from "@/lib/queries/useCalendarEvents";
import { getCurrentWeekDates, todayDate } from "@/lib/date";

type Tab = "today" | "week";

const FIELD_CLASS =
  "min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted/60 focus:border-accent [color-scheme:dark]";

/** Vaikimisi lõpuaeg: tund pärast algust. */
function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function AddEventForm({ onDone }: { onDone: () => void }) {
  const addEvent = useAddCalendarEvent();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayDate());
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  const valid = title.trim() !== "" && date !== "" && (allDay || end > start);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || addEvent.isPending) return;

    addEvent.mutate(
      allDay
        ? { title: title.trim(), date, allDay: true }
        : { title: title.trim(), date, allDay: false, start, end },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 flex flex-col gap-2 border-b border-border/40 pb-4">
      <input
        autoFocus
        className={`${FIELD_CLASS} w-full`}
        placeholder="Sündmuse pealkiri..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <input
          type="date"
          className={`${FIELD_CLASS} flex-1`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Kuupäev"
        />
        <button
          type="button"
          onClick={() => setAllDay((v) => !v)}
          aria-pressed={allDay}
          className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted transition-colors duration-200 hover:text-foreground"
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-200 ${
              allDay ? "border-accent bg-accent text-background" : "border-border"
            }`}
            aria-hidden
          >
            {allDay && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          Terve päev
        </button>
      </div>

      <div className="flex items-center gap-2">
        {!allDay && (
          <>
            <input
              type="time"
              className={`${FIELD_CLASS} flex-1`}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setEnd(addHour(e.target.value));
              }}
              aria-label="Algus"
            />
            <span className="shrink-0 text-sm text-muted">–</span>
            <input
              type="time"
              className={`${FIELD_CLASS} flex-1`}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="Lõpp"
            />
          </>
        )}
        <Button
          type="submit"
          className="ml-auto shrink-0 px-3 py-1.5"
          disabled={!valid || addEvent.isPending}
        >
          Lisa
        </Button>
      </div>

      {addEvent.error && (
        <p className="text-xs text-destructive">{addEvent.error.message}</p>
      )}
    </form>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="text-sm">
      <span className="text-muted">{event.allDay ? "Terve päev" : event.time}</span> {event.title}
    </li>
  );
}

export function CalendarWidget() {
  const [tab, setTab] = useState<Tab>("today");
  const [adding, setAdding] = useState(false);
  const { data, isLoading, error } = useCalendarEvents();

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={CalendarDays} href="https://calendar.google.com/calendar/u/0/r/week">
          Calendar
        </WidgetTitle>
        <div className="flex items-center gap-1">
          <TabButton active={tab === "today"} onClick={() => setTab("today")}>
            Täna
          </TabButton>
          <TabButton active={tab === "week"} onClick={() => setTab("week")}>
            See nädal
          </TabButton>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="ml-1 shrink-0 cursor-pointer rounded-md p-1 text-muted transition-colors duration-200 hover:text-foreground"
            aria-label={adding ? "Sulge vorm" : "Lisa sündmus"}
          >
            <Plus
              className={`h-4 w-4 transition-transform duration-200 ${adding ? "rotate-45" : ""}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {adding && <AddEventForm onDone={() => setAdding(false)} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error || !data ? (
        <p className="text-sm text-destructive">Kalendri laadimine ebaõnnestus.</p>
      ) : tab === "today" ? (
        (() => {
          const todayEvents = data.filter((e) => e.date === todayDate());
          return todayEvents.length === 0 ? (
            <p className="text-sm text-muted">Täna sündmusi pole.</p>
          ) : (
            <ul className="space-y-1">
              {todayEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </ul>
          );
        })()
      ) : (
        <div className="space-y-3">
          {getCurrentWeekDates().map(({ date, label }) => {
            const dayEvents = data.filter((e) => e.date === date);
            if (dayEvents.length === 0) return null;
            return (
              <div key={date}>
                <p className="text-xs text-muted">
                  {label} {date}
                </p>
                <ul className="space-y-1">
                  {dayEvents.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </Card>
  );
}
