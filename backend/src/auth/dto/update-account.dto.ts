import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateAccountDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
