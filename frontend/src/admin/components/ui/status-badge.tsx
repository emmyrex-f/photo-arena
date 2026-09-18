import { cn } from "../../../lib/cn";
import type { BookingStatus, EnquiryStatus, PaymentStatus, Role } from "../../lib/types";
import { humanize } from "../../lib/format";
import { Badge, type BadgeProps } from "./badge";

const bookingVariant: Record<BookingStatus, NonNullable<BadgeProps["variant"]>> = {
  TEMPORARY_HOLD: "violet",
  PENDING: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  NO_SHOW: "destructive",
};

/** Solid colours used by calendar blocks. */
export const bookingStatusColor: Record<BookingStatus, string> = {
  TEMPORARY_HOLD: "bg-violet-500/80 border-violet-600 text-white",
  PENDING: "bg-amber-500/85 border-amber-600 text-amber-950",
  CONFIRMED: "bg-sky-600/85 border-sky-700 text-white",
  COMPLETED: "bg-emerald-600/85 border-emerald-700 text-white",
  CANCELLED: "bg-muted border-border text-muted-foreground line-through",
  NO_SHOW: "bg-destructive/80 border-destructive text-white",
};

/** Soft cards + accent bar for the week/day calendar. */
export const bookingCalendarTone: Record<BookingStatus, { bar: string; card: string }> = {
  TEMPORARY_HOLD: { bar: "bg-violet-500", card: "bg-violet-500/12 ring-violet-500/20" },
  PENDING: { bar: "bg-amber-500", card: "bg-amber-500/12 ring-amber-500/25" },
  CONFIRMED: { bar: "bg-sky-500", card: "bg-sky-500/12 ring-sky-500/25" },
  COMPLETED: { bar: "bg-emerald-500", card: "bg-emerald-500/12 ring-emerald-500/25" },
  CANCELLED: { bar: "bg-muted-foreground/60", card: "bg-muted/60 ring-border/80" },
  NO_SHOW: { bar: "bg-destructive", card: "bg-destructive/12 ring-destructive/25" },
};

export const bookingStatusDot: Record<BookingStatus, string> = {
  TEMPORARY_HOLD: "bg-violet-500",
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-sky-600",
  COMPLETED: "bg-emerald-600",
  CANCELLED: "bg-muted-foreground",
  NO_SHOW: "bg-destructive",
};

function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <Badge variant={bookingVariant[status] ?? "outline"} className={className}>
      <span className={cn("h-1.5 w-1.5 rounded-full", bookingStatusDot[status])} />
      {status === "TEMPORARY_HOLD" ? "Hold" : humanize(status)}
    </Badge>
  );
}

const paymentVariant: Record<PaymentStatus, NonNullable<BadgeProps["variant"]>> = {
  PENDING: "warning",
  PROCESSING: "info",
  SUCCESS: "success",
  FAILED: "destructive",
};

function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge variant={paymentVariant[status] ?? "outline"} className={className}>
      {humanize(status)}
    </Badge>
  );
}

const enquiryVariant: Record<EnquiryStatus, NonNullable<BadgeProps["variant"]>> = {
  NEW: "warning",
  REPLIED: "info",
  CLOSED: "muted",
};

function EnquiryStatusBadge({ status, className }: { status: EnquiryStatus; className?: string }) {
  return (
    <Badge variant={enquiryVariant[status] ?? "outline"} className={className}>
      {humanize(status)}
    </Badge>
  );
}

const roleVariant: Record<Role, NonNullable<BadgeProps["variant"]>> = {
  OWNER: "default",
  ADMIN: "info",
  STAFF: "secondary",
};

function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge variant={roleVariant[role] ?? "outline"} className={cn("uppercase tracking-wide", className)}>
      {role}
    </Badge>
  );
}

function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge variant={active ? "success" : "muted"} className={className}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export { BookingStatusBadge, PaymentStatusBadge, EnquiryStatusBadge, RoleBadge, ActiveBadge };
