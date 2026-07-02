import { LucideIcon } from "lucide-react";

interface WidgetTitleProps {
  icon: LucideIcon;
  children: string;
}

export function WidgetTitle({ icon: Icon, children }: WidgetTitleProps) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-muted">
      <Icon className="h-4 w-4 text-accent" aria-hidden />
      {children}
    </h2>
  );
}
