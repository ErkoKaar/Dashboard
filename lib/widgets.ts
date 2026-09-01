import { ComponentType } from "react";
import { FinanceWidget } from "@/components/widgets/FinanceWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { HabitsWidget } from "@/components/widgets/HabitsWidget";
import { ChessWidget } from "@/components/widgets/ChessWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { EstHoopWidget } from "@/components/widgets/EstHoopWidget";
import { QuickNotesWidget } from "@/components/widgets/QuickNotesWidget";
import { TaskManagerWidget } from "@/components/widgets/TaskManagerWidget";

export type DashboardContext = "personal" | "taskmanager" | "notes";

export interface WidgetDefinition {
  id: string;
  Component: ComponentType;
  colSpan: string;
  context: DashboardContext;
}

const HALF = "col-span-12 md:col-span-6";
const FULL = "col-span-12";


export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: "tasks", Component: TasksWidget, colSpan: HALF, context: "personal" },
  { id: "habits", Component: HabitsWidget, colSpan: HALF, context: "personal" },
  { id: "calendar", Component: CalendarWidget, colSpan: HALF, context: "personal" },
  { id: "chess", Component: ChessWidget, colSpan: HALF, context: "personal" },
  { id: "finance", Component: FinanceWidget, colSpan: HALF, context: "personal" },
  { id: "esthoop", Component: EstHoopWidget, colSpan: HALF, context: "personal" },
  { id: "taskmanager", Component: TaskManagerWidget, colSpan: FULL, context: "taskmanager" },
  { id: "quick-notes", Component: QuickNotesWidget, colSpan: FULL, context: "notes" },
];
