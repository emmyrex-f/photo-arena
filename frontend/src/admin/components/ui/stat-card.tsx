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

const toneStyles: Record<
  NonNullable<StatCardProps["tone"]>,
  {
    badge: string;
    topLine: string;
    glow: string;
    svgColor: string;
  }
> = {
  default: {
    badge: "bg-muted/80 text-muted-foreground ring-1 ring-border/80 shadow-sm",
    topLine: "before:via-white/25",
    glow: "from-white/[0.04] to-transparent",
    svgColor: "rgba(255, 255, 255, 0.06)",
  },
  primary: {
    badge: "bg-amber-500/15 text-amber-600 dark:text-[#d8b477] ring-1 ring-amber-500/30 shadow-sm",
    topLine: "before:via-[#d8b477]/80",
    glow: "from-amber-500/10 via-primary/5 to-transparent",
    svgColor: "rgba(216, 180, 119, 0.12)",
  },
  success: {
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm",
    topLine: "before:via-emerald-500/80",
    glow: "from-emerald-500/10 via-teal-500/5 to-transparent",
    svgColor: "rgba(16, 185, 129, 0.12)",
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/35 shadow-sm",
    topLine: "before:via-amber-500/80",
    glow: "from-amber-500/12 via-orange-500/5 to-transparent",
    svgColor: "rgba(245, 158, 11, 0.12)",
  },
  destructive: {
    badge: "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30 shadow-sm",
    topLine: "before:via-red-500/80",
    glow: "from-red-500/10 via-rose-500/5 to-transparent",
    svgColor: "rgba(239, 68, 68, 0.12)",
  },
};

function AbstractBackground({ tone }: { tone: NonNullable<StatCardProps["tone"]> }) {
  const { svgColor, glow } = toneStyles[tone];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
      {/* Ambient Radial Corner Glow */}
      <div className={cn("absolute -right-6 -top-6 h-36 w-36 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-300", glow)} />

      {/* Abstract Geometric Waves / Concentric Arcs */}
      <svg
        className="absolute -bottom-6 -right-6 h-36 w-36 opacity-75 dark:opacity-90 transition-transform duration-500 group-hover:scale-110"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="120" cy="120" r="100" stroke={svgColor} strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="120" cy="120" r="75" stroke={svgColor} strokeWidth="1.5" />
        <circle cx="120" cy="120" r="50" stroke={svgColor} strokeWidth="2" strokeDasharray="6 3" />
        <circle cx="120" cy="120" r="28" stroke={svgColor} strokeWidth="1.5" />
        <path
          d="M20 120 C 60 80, 100 140, 140 100"
          stroke={svgColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M40 140 C 80 100, 120 160, 160 120"
          stroke={svgColor}
          strokeWidth="1.2"
          strokeDasharray="2 4"
        />
      </svg>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  tone = "default",
  className,
  onClick,
}: StatCardProps) {
  const currentTone = toneStyles[tone];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/80 dark:border-white/12 bg-card/95 backdrop-blur-md",
        "shadow-[0_6px_24px_-4px_rgba(0,0,0,0.12),0_2px_6px_-1px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_35px_-5px_rgba(0,0,0,0.7)]",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_16px_45px_-5px_rgba(0,0,0,0.85)] hover:border-primary/40",
        "before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:to-transparent",
        currentTone.topLine,
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <AbstractBackground tone={tone} />

      <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-admin-card-sm pb-1.5">
        <CardTitle className="pa-ui-label text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
          {label}
        </CardTitle>
        {Icon ? (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
              currentTone.badge,
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="relative z-10 p-admin-card-sm pt-0">
        {loading ? (
          <>
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="mt-2 h-3.5 w-36 rounded" />
          </>
        ) : (
          <>
            <div className="font-heading text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
              {value}
            </div>
            {hint ? (
              <p className="mt-1 text-xs font-medium text-muted-foreground/90 leading-tight">
                {hint}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { StatCard };
