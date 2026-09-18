import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MediaUsageController } from "./media-usage.controller";
import { MediaUsageService } from "./media-usage.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [MediaUsageController],
  providers: [MediaUsageService],
  exports: [MediaUsageService],
})
export class MediaUsageModule {}
