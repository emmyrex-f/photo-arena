import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MediaUsageModule } from "../media-usage/media-usage.module";
import { TestimonialsController } from "./testimonials.controller";
import { TestimonialsService } from "./testimonials.service";

@Module({
  imports: [AuthModule, AuditModule, MediaUsageModule],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
})
export class TestimonialsModule {}
