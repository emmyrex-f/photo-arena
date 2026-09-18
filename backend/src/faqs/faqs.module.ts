import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { FaqsController } from "./faqs.controller";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [FaqsController],
})
export class FaqsModule {}
