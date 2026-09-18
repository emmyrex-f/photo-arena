import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NewsletterController } from "./newsletter.controller";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [NewsletterController],
})
export class NewsletterModule {}
