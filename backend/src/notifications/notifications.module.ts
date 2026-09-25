import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { NotificationsService } from "./notifications.service";
import { ReminderScheduler } from "./reminder.scheduler";

@Module({
  imports: [AuditModule],
  controllers: [AdminNotificationsController],
  providers: [NotificationsService, ReminderScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
