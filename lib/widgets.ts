import { ComponentType } from "react";
import { GithubWidget } from "@/components/widgets/GithubWidget";
import { FinanceWidget } from "@/components/widgets/FinanceWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { HabitsWidget } from "@/components/widgets/HabitsWidget";
import { FocusLoopWidget } from "@/components/widgets/FocusLoopWidget";
import { ChessWidget } from "@/components/widgets/ChessWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { SpotifyWidget } from "@/components/widgets/SpotifyWidget";
import { ProjectsWidget } from "@/components/widgets/ProjectsWidget";
import { EstHoopWidget } from "@/components/widgets/EstHoopWidget";

export interface WidgetDefinition {
  id: string;
  Component: ComponentType;
  colSpan: string;
}

const THIRD = "col-span-12 md:col-span-6 xl:col-span-4";
const TWO_THIRDS = "col-span-12 xl:col-span-8";

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: "github", Component: GithubWidget, colSpan: TWO_THIRDS },
  { id: "finance", Component: FinanceWidget, colSpan: THIRD },
  { id: "tasks", Component: TasksWidget, colSpan: THIRD },
  { id: "habits", Component: HabitsWidget, colSpan: THIRD },
  { id: "focusloop", Component: FocusLoopWidget, colSpan: THIRD },
  { id: "chess", Component: ChessWidget, colSpan: THIRD },
  { id: "calendar", Component: CalendarWidget, colSpan: THIRD },
  { id: "spotify", Component: SpotifyWidget, colSpan: THIRD },
  { id: "projects", Component: ProjectsWidget, colSpan: TWO_THIRDS },
  { id: "esthoop", Component: EstHoopWidget, colSpan: "col-span-12 xl:col-span-4" },
];

export const DEFAULT_WIDGET_ORDER: string[] = WIDGET_REGISTRY.map((w) => w.id);

export function resolveWidgetOrder(savedOrder: string[] | null | undefined): string[] {
  const knownIds = new Set(DEFAULT_WIDGET_ORDER);
  const saved = (savedOrder ?? []).filter((id) => knownIds.has(id));
  const missing = DEFAULT_WIDGET_ORDER.filter((id) => !saved.includes(id));
  return [...saved, ...missing];
}
