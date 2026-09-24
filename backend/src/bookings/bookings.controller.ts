import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { getClientIp } from "../common/client-ip";
import {
  HOLD_IP_LIMIT,
  HOLD_PHONE_LIMIT,
  RATE_WINDOW_MS,
  rateLimitPhoneKey,
  rateLimiter,
  tooManyRequests,
} from "../common/rate-limit";
import { BookingsService } from "./bookings.service";
import { HoldBookingDto } from "./dto/hold-checkout.dto";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get("availability")
  availability(
    @Query("date") date: string,
    @Query("durationMinutes") durationMinutes = "60",
  ) {
    const ymd = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : this.bookings.todayYmd();
    return this.bookings.availability(ymd, Number(durationMinutes), {
      requireSameDayNotice: true,
    });
  }

  @Get("packages")
  packages() {
    return this.bookings.publicPackages();
  }

  @Post("hold")
  hold(@Body() body: HoldBookingDto, @Req() req: Request) {
    const ip = getClientIp(req);
    const phone = rateLimitPhoneKey(body.customerPhone);
    if (!rateLimiter.hit(`hold:ip:${ip}`, HOLD_IP_LIMIT, RATE_WINDOW_MS)) {
      tooManyRequests();
    }
    if (!rateLimiter.hit(`hold:phone:${phone}`, HOLD_PHONE_LIMIT, RATE_WINDOW_MS)) {
      tooManyRequests();
    }
    return this.bookings.hold(body);
  }

  @Get(":id/status")
  status(@Param("id") id: string, @Query("reference") reference?: string) {
    return this.bookings.publicStatus(id, reference);
  }
}
