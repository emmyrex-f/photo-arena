import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import type { Request } from "express";
import { CheckoutDto } from "../bookings/dto/hold-checkout.dto";
import { PaymentsService } from "./payments.service";

class MockCompleteDto {
  @IsString()
  @MinLength(1)
  reference!: string;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("bookings/:id/checkout")
  checkout(@Param("id") id: string, @Body() body: CheckoutDto) {
    return this.payments.checkout(id, body.returnUrl, body.cancelUrl, body.reference);
  }

  @Get("payments/verify")
  verify(@Query("reference") reference: string) {
    return this.payments.verify(reference);
  }

  @Post("payments/mock/complete")
  mockComplete(@Body() body: MockCompleteDto) {
    return this.payments.mockComplete(body.reference);
  }

  @Post("payments/webhook/bachs")
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-bachs-signature") signature = "",
    @Headers("x-bachs-signature-v2") signatureV2 = "",
    @Headers("x-bachs-timestamp") timestamp = "",
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.handleBachsWebhook({
      rawBody: raw,
      signature,
      signatureV2,
      timestamp,
    });
  }
}
