/** Email typed for this booking — preferred for reminders/receipts. Never invents addresses. */
export function bookingNotifyEmail(booking: {
  contactEmail?: string | null;
  customer: { email: string | null };
}): string {
  return (booking.contactEmail ?? booking.customer.email ?? "").trim().toLowerCase();
}
