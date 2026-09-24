import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Skeleton } from "./skeleton";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
  onClick?: () => void;
};

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  destructive: "bg-destructive/15 text-destructive",
};

function StatCard({ label, value, hint, icon: Icon, loading, tone = "default", className, onClick }: StatCardProps) {
  return (
    <Card
      className={cn(onClick && "cursor-pointer transition-colors hover:bg-muted/40", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-admin-card-sm pb-admin-control">
        <CardTitle className="pa-ui-label text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        {Icon ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", toneClass[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="p-admin-card-sm pt-0">
        {loading ? (
          <>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-32" />
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { StatCard };
