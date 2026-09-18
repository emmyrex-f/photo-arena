import type { NotificationChannel, NotificationMessage } from "./notification.types";

export class EmailNotificationChannel implements NotificationChannel {
  async send(message: NotificationMessage): Promise<void> {
    // SMTP wiring comes after recipient addresses are confirmed.
    console.info("[email:queued]", message.event, message.to.join(","));
  }
}

export class SmsNotificationChannel implements NotificationChannel {
  async send(message: NotificationMessage): Promise<void> {
    throw new Error(`SMS channel is not configured. Event=${message.event}`);
  }
}
