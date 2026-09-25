import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class RefundPaymentDto {
  /** Optional refund amount in kobo. If omitted, defaults to full remaining payment amount. */
  @IsOptional()
  @IsInt()
  @Min(100)
  amountKobo?: number;

  @IsString()
  @MinLength(3)
  reason!: string;
}
