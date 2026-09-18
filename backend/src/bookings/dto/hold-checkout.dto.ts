import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Min,
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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountKobo?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
