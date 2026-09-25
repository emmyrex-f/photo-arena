import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  Validate,
} from "class-validator";
import { IsValidPhoneConstraint } from "./hold-checkout.dto";

export class CreateAdminBookingDto {
  @IsString()
  @MinLength(2)
  customerName!: string;

  @IsString()
  @Validate(IsValidPhoneConstraint)
  customerPhone!: string;


  @IsEmail()
  customerEmail!: string;

  @IsString()
  packageId!: string;

  @IsISO8601()
  startTime!: string;

  @IsIn(["WALK_IN", "ADMIN"])
  source!: "WALK_IN" | "ADMIN";

  @IsOptional()
  @IsString()
  notes?: string;
}
