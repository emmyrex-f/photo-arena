import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import type { AuthUser } from "./auth.types";
import { getClientIp } from "../common/client-ip";
import {
  LOGIN_FAIL_LIMIT,
  RATE_WINDOW_MS,
  rateLimiter,
  tooManyRequests,
} from "../common/rate-limit";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("desk-email")
  deskEmail() {
    return this.auth.deskEmail();
  }

  @Post("login")
  async login(@Body() body: LoginDto, @Req() req: Request) {
    const ip = getClientIp(req);
    const email = body.email.trim().toLowerCase();
    const ipKey = `login:ip:${ip}`;
    const emailKey = `login:email:${email}`;
    if (
      rateLimiter.count(ipKey, RATE_WINDOW_MS) >= LOGIN_FAIL_LIMIT ||
      rateLimiter.count(emailKey, RATE_WINDOW_MS) >= LOGIN_FAIL_LIMIT
    ) {
      tooManyRequests();
    }
    try {
      const result = await this.auth.login(body.email, body.password);
      rateLimiter.clear(ipKey);
      rateLimiter.clear(emailKey);
      return result;
    } catch (error) {
      rateLimiter.record(ipKey, RATE_WINDOW_MS);
      rateLimiter.record(emailKey, RATE_WINDOW_MS);
      throw error;
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @Patch("account")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  updateAccount(@CurrentUser() user: AuthUser, @Body() body: UpdateAccountDto) {
    return this.auth.updateAccount(user.id, body);
  }
}
