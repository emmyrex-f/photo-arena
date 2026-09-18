import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAdminBookingDto {
  @IsString()
  @MinLength(2)
  customerName!: string;

  @IsString()
  @MinLength(7)
  customerPhone!: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

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
