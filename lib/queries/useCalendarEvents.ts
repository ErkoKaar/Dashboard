import { useQuery } from "@tanstack/react-query";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string | null;
  allDay: boolean;
}

export function useCalendarEvents() {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const res = await fetch("/api/calendar");
      if (!res.ok) throw new Error("Kalendri laadimine ebaõnnestus");
      const json = await res.json();
      return json.events;
    },
  });
}
