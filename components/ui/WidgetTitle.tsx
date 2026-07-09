import { ComponentType, SVGProps } from "react";

interface WidgetTitleProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: string;
  href?: string;
}

export function WidgetTitle({ icon: Icon, children, href }: WidgetTitleProps) {
  const content = (
    <>
      <Icon className="h-4 w-4 text-accent" aria-hidden />
      {children}
    </>
  );

  return (
    <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 transition-colors duration-200 hover:text-accent"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </h2>
  );
}
