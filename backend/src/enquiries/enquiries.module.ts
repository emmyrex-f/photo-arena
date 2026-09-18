import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { EnquiriesController } from "./enquiries.controller";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [EnquiriesController],
})
export class EnquiriesModule {}
