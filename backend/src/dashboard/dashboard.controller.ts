import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DashboardService } from "./dashboard.service";

@Controller("admin/dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@Query("weekStart") weekStart?: string) {
    return this.dashboard.get(weekStart);
  }

  @Get("revenue")
  revenue(@Query("weekStart") weekStart?: string) {
    return this.dashboard.getWeeklyRevenue(weekStart);
  }
}
