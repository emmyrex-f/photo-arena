import { Module, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { BookingsModule } from "../bookings/bookings.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminPaymentsController } from "./admin-payments.controller";
import { BachsPaymentProvider } from "./bachs-payment.provider";
import { MockPaymentProvider } from "./mock-payment.provider";
import { isPaymentsMockEnabled } from "../common/payments-mock";
import { PAYMENT_PROVIDER } from "./payment.constants";
import type { PaymentProvider } from "./payment-provider";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [AuthModule, forwardRef(() => BookingsModule), NotificationsModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentProvider => {
        const key = (config.get<string>("BACHS_API_KEY") ?? "").trim();
        const webhookSecret = (config.get<string>("BACHS_WEBHOOK_SECRET") ?? "").trim();
        if (isPaymentsMockEnabled()) {
          return new MockPaymentProvider(webhookSecret);
        }
        return new BachsPaymentProvider(key, webhookSecret, config.get<string>("BACHS_BASE_URL"));
      },
    },
  ],
  exports: [PAYMENT_PROVIDER, PaymentsService],
})
export class PaymentsModule {}
