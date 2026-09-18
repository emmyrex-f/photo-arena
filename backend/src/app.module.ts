import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BlogModule } from "./blog/blog.module";
import { BookingsModule } from "./bookings/bookings.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EnquiriesModule } from "./enquiries/enquiries.module";
import { FaqsModule } from "./faqs/faqs.module";
import { GalleryModule } from "./gallery/gallery.module";
import { MediaUsageModule } from "./media-usage/media-usage.module";
import { HealthController } from "./health.controller";
import { NewsletterModule } from "./newsletter/newsletter.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PaymentsModule } from "./payments/payments.module";
import { PricingModule } from "./pricing/pricing.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicModule } from "./public/public.module";
import { CatalogModule } from "./catalog/catalog.module";
import { SettingsModule } from "./settings/settings.module";
import { TestimonialsModule } from "./testimonials/testimonials.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    PricingModule,
    PaymentsModule,
    NotificationsModule,
    PublicModule,
    BookingsModule,
    DashboardModule,
    CustomersModule,
    EnquiriesModule,
    CatalogModule,
    GalleryModule,
    MediaUsageModule,
    SettingsModule,
    TestimonialsModule,
    FaqsModule,
    BlogModule,
    NewsletterModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
