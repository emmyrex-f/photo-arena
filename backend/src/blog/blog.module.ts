import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { BlogController } from "./blog.controller";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [BlogController],
})
export class BlogModule {}
