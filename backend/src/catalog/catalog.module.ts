import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MediaUsageModule } from "../media-usage/media-usage.module";
import { PricingModule } from "../pricing/pricing.module";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [AuthModule, AuditModule, PricingModule, MediaUsageModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
