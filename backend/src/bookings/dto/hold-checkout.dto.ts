import {
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from "class-validator";

export class HoldBookingDto {
  @IsString()
  packageId!: string;

  @IsISO8601()
  startTime!: string;

  @IsString()
  @MinLength(1)
  customerName!: string;

  @IsString()
  @MinLength(5)
  customerPhone!: string;

  @IsEmail()
  customerEmail!: string;
}

export class CheckoutDto {
  @IsString()
  @MinLength(1)
  reference!: string;

  @IsUrl({ require_tld: false })
  returnUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}

export class RescheduleBookingDto {
  @IsISO8601()
  startTime!: string;
}

export class UpdateBookingNotesDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StudioPaymentDto {
  /** Optional note only — charge amount is always the booking outstanding (server-side). */
  @IsOptional()
  @IsString()
  note?: string;
}
