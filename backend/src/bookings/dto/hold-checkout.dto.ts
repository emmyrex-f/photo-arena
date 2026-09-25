import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "isValidPhone", async: false })
export class IsValidPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    // Disallow letters
    if (/[a-zA-Z]/.test(trimmed)) return false;
    // Extract only digits
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 16) return false;
    // Must match valid phone structure (optional +, digits, spaces, dashes, parentheses)
    return /^\+?[\d\s\-().]{8,25}$/.test(trimmed);
  }

  defaultMessage(): string {
    return "Invalid phone number format. Please provide a valid Nigerian or international phone number.";
  }
}

export class HoldBookingDto {
  @IsString()
  packageId!: string;

  @IsISO8601()
  startTime!: string;

  @IsString()
  @MinLength(1)
  customerName!: string;

  @IsString()
  @Validate(IsValidPhoneConstraint)
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
  @IsInt()
  @Min(100)
  amountKobo?: number;

  @IsOptional()
  @IsIn(["CASH", "POS", "TRANSFER"])
  channel?: "CASH" | "POS" | "TRANSFER";

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
