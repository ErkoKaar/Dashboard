import { ComponentType, SVGProps } from "react";

interface WidgetTitleProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: string;
}

export function WidgetTitle({ icon: Icon, children }: WidgetTitleProps) {
  return (
    <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
      <Icon className="h-4 w-4 text-accent" aria-hidden />
      {children}
    </h2>
  );
}
