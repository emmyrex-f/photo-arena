export type NotificationEvent =
  | "booking_created"
  | "booking_confirmed"
  | "payment_received"
  | "booking_reminder"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "payment_failed";

export type NotificationMessage = {
  event: NotificationEvent;
  to: string[];
  subject: string;
  body: string;
};

export interface NotificationChannel {
  send(message: NotificationMessage): Promise<void>;
}
