import { IsIn } from "class-validator";

export class UpdateBookingStatusDto {
  @IsIn(["COMPLETED", "NO_SHOW", "CANCELLED"])
  status!: "COMPLETED" | "NO_SHOW" | "CANCELLED";
}
