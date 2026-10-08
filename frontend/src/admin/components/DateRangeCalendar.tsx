import { useEffect, useState } from "react";
import { addDays, format, getDaysInMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { lagosToday, parseYmd, toYmd } from "../lib/format";
import { cn } from "../../lib/cn";

export function monthBounds(ymd: string): { start: string; end: string } {
  const start = `${ymd.slice(0, 7)}-01`;
  const end = toYmd(addDays(startOfMonth(parseYmd(start)), getDaysInMonth(parseYmd(start)) - 1));
  return { start, end };
}

export function formatRangeLabel(from: string, to: string): string {
  if (from === to) return format(parseYmd(from), "MMM d, yyyy");
  return `${format(parseYmd(from), "MMM d, yyyy")} – ${format(parseYmd(to), "MMM d, yyyy")}`;
}

function orderedRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

function monthMatrix(ymd: string): Array<Array<string | null>> {
  const start = startOfMonth(parseYmd(`${ymd.slice(0, 7)}-01`));
  const days = getDaysInMonth(start);
  const firstWeekday = (start.getDay() + 6) % 7;
  const cells: Array<string | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(toYmd(addDays(start, d - 1)));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function DateRangeCalendar({
  from,
  to,
  onChange,
  markedDays,
  onVisibleMonthChange,
  focusMonth,
  framed = false,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  markedDays?: ReadonlySet<string>;
  onVisibleMonthChange?: (start: string, end: string) => void;
  /** Move the grid when this changes. A trailing note after the date is ignored. */
  focusMonth?: string | null;
  /** Bookings sidebar card: month title sits in the card header. */
  framed?: boolean;
}) {
  const today = lagosToday();
  const [monthCursor, setMonthCursor] = useState(() => `${from.slice(0, 7)}-01`);
  const [edge, setEdge] = useState<"start" | "end">("start");
  const monthStart = `${monthCursor.slice(0, 7)}-01`;
  const bounds = monthBounds(monthStart);

  useEffect(() => {
    const ymd = focusMonth?.slice(0, 10);
    if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) setMonthCursor(`${ymd.slice(0, 7)}-01`);
  }, [focusMonth]);

  useEffect(() => {
    onVisibleMonthChange?.(bounds.start, bounds.end);
  }, [bounds.start, bounds.end, onVisibleMonthChange]);

  function pick(day: string) {
    if (edge === "end") {
      const next = orderedRange(from, day);
      onChange(next.from, next.to);
      return;
    }
    if (from === to) {
      onChange(day, day);
      return;
    }
    const next = orderedRange(day, to);
    onChange(next.from, next.to);
  }

  const monthLabel = format(parseYmd(monthStart), "MMMM yyyy");
  const previousMonth = () => setMonthCursor(toYmd(addDays(startOfMonth(parseYmd(monthStart)), -1)));
  const nextMonth = () =>
    setMonthCursor(toYmd(addDays(startOfMonth(parseYmd(monthStart)), getDaysInMonth(parseYmd(monthStart)))));

  const grid = (
    <>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthMatrix(monthStart).flatMap((week, weekIndex) =>
          week.map((day, dayIndex) => {
            if (!day) return <span key={`${weekIndex}-${dayIndex}`} className="h-8" />;
            const isEndpoint = day === from || day === to;
            const inRange = day >= from && day <= to;
            const marked = markedDays?.has(day) ?? false;
            return (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                className={cn(
                  "relative flex h-8 cursor-pointer items-center justify-center text-xs tabular-nums transition-colors",
                  isEndpoint
                    ? "rounded-full bg-primary font-semibold text-primary-foreground"
                    : "rounded-full text-foreground hover:bg-muted/50",
                  inRange && !isEndpoint && "bg-primary/10",
                  day === today && !isEndpoint && "ring-1 ring-primary/40",
                )}
              >
                {Number(day.slice(8))}
                {marked && !isEndpoint ? (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                ) : null}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-muted/40 p-1" role="group" aria-label="Date edge">
        <button
          type="button"
          aria-pressed={edge === "start"}
          onClick={() => setEdge("start")}
          className={cn(
            "h-8 rounded text-xs font-medium",
            edge === "start" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Start
        </button>
        <button
          type="button"
          aria-pressed={edge === "end"}
          onClick={() => setEdge("end")}
          className={cn(
            "h-8 rounded text-xs font-medium",
            edge === "end" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          End
        </button>
      </div>
    </>
  );

  if (framed) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-admin-card-sm pb-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-sm font-medium">{monthLabel}</CardTitle>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-admin-card-sm pt-0">{grid}</CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={previousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium">{monthLabel}</p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {grid}
    </div>
  );
}
