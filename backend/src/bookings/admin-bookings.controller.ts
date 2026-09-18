import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuditService } from "../audit/audit.service";
import { BookingsService } from "./bookings.service";
import { CreateAdminBookingDto } from "./dto/create-admin-booking.dto";
import {
  RescheduleBookingDto,
  StudioPaymentDto,
  UpdateBookingNotesDto,
} from "./dto/hold-checkout.dto";
import { UpdateBookingStatusDto } from "./dto/update-booking-status.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("bookings")
export class AdminBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly audit: AuditService,
  ) {}

  @Get("packages")
  packages() {
    return this.bookings.listPackages();
  }

  @Get("availability")
  availability(
    @Query("date") date: string,
    @Query("durationMinutes") durationMinutes = "60",
  ) {
    const ymd = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : this.bookings.todayYmd();
    return this.bookings.availability(ymd, Number(durationMinutes), {
      requireSameDayNotice: false,
    });
  }

  @Get("bookings/range")
  range(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    const fromYmd = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : this.bookings.todayYmd();
    const toYmd = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : fromYmd;
    return this.bookings.listRange(fromYmd, toYmd, status, q);
  }

  @Get("bookings")
  list(@Query("date") date: string) {
    const ymd = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : this.bookings.todayYmd();
    return this.bookings.list(ymd);
  }

  @Get("bookings/:id")
  get(@Param("id") id: string) {
    return this.bookings.get(id);
  }

  @Post("bookings")
  @Roles(Role.OWNER, Role.ADMIN)
  async create(@Body() body: CreateAdminBookingDto, @CurrentUser() user: AuthUser) {
    const booking = await this.bookings.createAdmin(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "booking.create",
      entity: "booking",
      entityId: booking.id,
      meta: { source: body.source, packageId: body.packageId },
    });
    return booking;
  }

  @Post("bookings/:id/payment")
  @Roles(Role.OWNER, Role.ADMIN)
  async pay(
    @Param("id") id: string,
    @Body() body: StudioPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookings.recordStudioPayment(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "booking.payment",
      entity: "booking",
      entityId: id,
      meta: { amountKobo: body.amountKobo, note: body.note },
    });
    return booking;
  }

  @Patch("bookings/:id/status")
  @Roles(Role.OWNER, Role.ADMIN)
  async status(
    @Param("id") id: string,
    @Body() body: UpdateBookingStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookings.updateStatus(id, body.status);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "booking.status",
      entity: "booking",
      entityId: id,
      meta: { status: body.status },
    });
    return booking;
  }

  @Patch("bookings/:id")
  @Roles(Role.OWNER, Role.ADMIN)
  async notes(
    @Param("id") id: string,
    @Body() body: UpdateBookingNotesDto,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookings.updateNotes(id, body.notes);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "booking.update",
      entity: "booking",
      entityId: id,
      meta: { notes: body.notes },
    });
    return booking;
  }

  @Post("bookings/:id/reschedule")
  @Roles(Role.OWNER, Role.ADMIN)
  async reschedule(
    @Param("id") id: string,
    @Body() body: RescheduleBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookings.reschedule(id, body.startTime);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "booking.reschedule",
      entity: "booking",
      entityId: id,
      meta: { startTime: body.startTime },
    });
    return booking;
  }
}
