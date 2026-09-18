import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
};

function PageHeader({ title, description, eyebrow, actions, className, children }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-admin-stack-sm", className)}>
      <div className="flex flex-col gap-admin-gap sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {description ? <p className="mt-admin-control text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-admin-control sm:shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export { PageHeader };
