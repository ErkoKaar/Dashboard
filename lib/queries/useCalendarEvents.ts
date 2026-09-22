import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  allDay: boolean;
}

export interface NewCalendarEvent {
  title: string;
  date: string;
  allDay: boolean;
  /** Ainult kellaajalisel sündmusel, kujul "14:00". */
  start?: string;
  end?: string;
}

const CALENDAR_EVENTS_KEY = ["calendar-events"];

export function useCalendarEvents() {
  return useQuery({
    queryKey: CALENDAR_EVENTS_KEY,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const res = await fetch("/api/calendar");
      if (!res.ok) throw new Error("Kalendri laadimine ebaõnnestus");
      const json = await res.json();
      return json.events;
    },
  });
}

export function useAddCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: NewCalendarEvent) => {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });

      // Route tagastab vea teksti (nt puuduv kirjutusõigus) — näitame seda kasutajale.
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Sündmuse lisamine ebaõnnestus");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY }),
  });
}
