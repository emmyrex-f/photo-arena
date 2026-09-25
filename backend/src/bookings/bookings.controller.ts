import { Body, Controller, Get, Inject, Param, Post, Query, Req, forwardRef } from "@nestjs/common";
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
import {
  CustomerCancelBookingDto,
  CustomerCheckoutDto,
  CustomerRescheduleBookingDto,
  LookupBookingDto,
} from "./dto/customer-self-service.dto";
import { PaymentsService } from "../payments/payments.service";

@Controller("bookings")
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {}

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

  @Get("lookup")
  lookupGet(
    @Query("reference") reference: string,
    @Query("emailOrPhone") emailOrPhone?: string,
    @Req() req?: Request,
  ) {
    if (req) {
      const ip = getClientIp(req);
      if (!rateLimiter.hit(`lookup:ip:${ip}`, 30, RATE_WINDOW_MS)) {
        tooManyRequests();
      }
    }
    return this.bookings.customerLookup(reference, emailOrPhone);
  }

  @Post("lookup")
  lookupPost(@Body() body: LookupBookingDto, @Req() req: Request) {
    const ip = getClientIp(req);
    if (!rateLimiter.hit(`lookup:ip:${ip}`, 30, RATE_WINDOW_MS)) {
      tooManyRequests();
    }
    return this.bookings.customerLookup(body.reference, body.emailOrPhone);
  }

  @Post("customer-cancel")
  customerCancel(@Body() body: CustomerCancelBookingDto, @Req() req: Request) {
    const ip = getClientIp(req);
    if (!rateLimiter.hit(`cancel:ip:${ip}`, 10, RATE_WINDOW_MS)) {
      tooManyRequests();
    }
    return this.bookings.customerCancel(body);
  }

  @Post("customer-reschedule")
  customerReschedule(@Body() body: CustomerRescheduleBookingDto, @Req() req: Request) {
    const ip = getClientIp(req);
    if (!rateLimiter.hit(`reschedule:ip:${ip}`, 10, RATE_WINDOW_MS)) {
      tooManyRequests();
    }
    return this.bookings.customerReschedule(body);
  }

  @Post("customer-checkout")
  customerCheckout(@Body() body: CustomerCheckoutDto, @Req() req: Request) {
    const ip = getClientIp(req);
    if (!rateLimiter.hit(`checkout:ip:${ip}`, 20, RATE_WINDOW_MS)) {
      tooManyRequests();
    }
    return this.payments.customerBalanceCheckout(
      body.reference,
      body.emailOrPhone,
      body.returnUrl,
      body.cancelUrl,
    );
  }

  @Get(":id/status")
  status(@Param("id") id: string, @Query("reference") reference?: string) {
    return this.bookings.publicStatus(id, reference);
  }
}
