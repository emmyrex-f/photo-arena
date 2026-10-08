import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditPurgeService } from "./audit-purge.service";
import { AuditService } from "./audit.service";

@Module({
  imports: [],
  controllers: [AuditController],
  providers: [AuditService, AuditPurgeService],
  exports: [AuditService],
})
export class AuditModule {}
