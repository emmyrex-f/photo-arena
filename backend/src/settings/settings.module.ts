import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PricingModule } from "../pricing/pricing.module";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [AuthModule, AuditModule, PricingModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
