import { ComponentType } from "react";
import { FinanceWidget } from "@/components/widgets/FinanceWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { HabitsWidget } from "@/components/widgets/HabitsWidget";
import { ChessWidget } from "@/components/widgets/ChessWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { ProjectsWidget } from "@/components/widgets/ProjectsWidget";
import { EstHoopWidget } from "@/components/widgets/EstHoopWidget";
import { WorkProjectsWidget } from "@/components/widgets/WorkProjectsWidget";
import { KeyTasksWidget } from "@/components/widgets/KeyTasksWidget";
import { QuickNotesWidget } from "@/components/widgets/QuickNotesWidget";

export type DashboardContext = "personal" | "work" | "notes";

export interface WidgetDefinition {
  id: string;
  Component: ComponentType;
  colSpan: string;
  context: DashboardContext;
}

const HALF = "col-span-12 md:col-span-6";
const THIRD = "col-span-12 md:col-span-6 xl:col-span-4";
const FULL = "col-span-12";

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: "tasks", Component: TasksWidget, colSpan: HALF, context: "personal" },
  { id: "habits", Component: HabitsWidget, colSpan: HALF, context: "personal" },
  { id: "projects", Component: ProjectsWidget, colSpan: HALF, context: "personal" },
  { id: "calendar", Component: CalendarWidget, colSpan: HALF, context: "personal" },
  { id: "finance", Component: FinanceWidget, colSpan: THIRD, context: "personal" },
  { id: "chess", Component: ChessWidget, colSpan: THIRD, context: "personal" },
  { id: "esthoop", Component: EstHoopWidget, colSpan: THIRD, context: "personal" },
  { id: "work-projects", Component: WorkProjectsWidget, colSpan: HALF, context: "work" },
  { id: "key-tasks", Component: KeyTasksWidget, colSpan: HALF, context: "work" },
  { id: "quick-notes", Component: QuickNotesWidget, colSpan: FULL, context: "notes" },
];
