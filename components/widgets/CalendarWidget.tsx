"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CalendarEvent, useCalendarEvents } from "@/lib/queries/useCalendarEvents";
import { getCurrentWeekDates } from "@/lib/date";

type Tab = "today" | "week";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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
  const { data, isLoading, error } = useCalendarEvents();

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={CalendarDays} href="https://calendar.google.com/calendar/u/0/r/week">
          Calendar
        </WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "today"} onClick={() => setTab("today")}>
            Täna
          </TabButton>
          <TabButton active={tab === "week"} onClick={() => setTab("week")}>
            See nädal
          </TabButton>
        </div>
      </div>

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
