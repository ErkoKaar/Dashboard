import { ComponentType } from "react";
import { FinanceWidget } from "@/components/widgets/FinanceWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { HabitsWidget } from "@/components/widgets/HabitsWidget";
import { ChessWidget } from "@/components/widgets/ChessWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { ProjectsWidget } from "@/components/widgets/ProjectsWidget";
import { EstHoopWidget } from "@/components/widgets/EstHoopWidget";

export type DashboardContext = "personal" | "work";

export interface WidgetDefinition {
  id: string;
  Component: ComponentType;
  colSpan: string;
  context: DashboardContext;
}

const HALF = "col-span-12 md:col-span-6";
const FULL = "col-span-12";
const QUARTER = "col-span-12 md:col-span-6 xl:col-span-3";

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: "tasks", Component: TasksWidget, colSpan: HALF, context: "personal" },
  { id: "habits", Component: HabitsWidget, colSpan: HALF, context: "personal" },
  { id: "projects", Component: ProjectsWidget, colSpan: FULL, context: "personal" },
  { id: "finance", Component: FinanceWidget, colSpan: QUARTER, context: "personal" },
  { id: "chess", Component: ChessWidget, colSpan: QUARTER, context: "personal" },
  { id: "calendar", Component: CalendarWidget, colSpan: QUARTER, context: "personal" },
  { id: "esthoop", Component: EstHoopWidget, colSpan: QUARTER, context: "personal" },
];
