import { SetMetadata } from "@nestjs/common";
import type { DeskPermission } from "./permissions";

export const PERMISSION_KEY = "deskPermission";

export const RequirePermission = (permission: DeskPermission) => SetMetadata(PERMISSION_KEY, permission);
