import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PricingModule } from "../pricing/pricing.module";
import { PublicModule } from "../public/public.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdminBookingsController } from "./admin-bookings.controller";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";

@Module({
  imports: [
    AuthModule,
    PricingModule,
    NotificationsModule,
    PublicModule,
    AuditModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
