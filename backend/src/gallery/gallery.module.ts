import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { MediaUsageModule } from "../media-usage/media-usage.module";
import { GalleryController } from "./gallery.controller";
import { GalleryService } from "./gallery.service";

@Module({
  imports: [AuthModule, AuditModule, MediaUsageModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
