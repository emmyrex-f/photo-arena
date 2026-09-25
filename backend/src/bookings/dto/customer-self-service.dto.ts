import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";

export class LookupBookingDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsOptional()
  emailOrPhone?: string;
}

export class CustomerCancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CustomerRescheduleBookingDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;

  /** ISO-8601 start time from availability slots (accept with or without ms). */
  @IsString()
  @IsNotEmpty()
  @IsISO8601({ strict: false })
  newStartTime!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CustomerCheckoutDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsNotEmpty()
  emailOrPhone!: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  returnUrl!: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  cancelUrl!: string;
}
