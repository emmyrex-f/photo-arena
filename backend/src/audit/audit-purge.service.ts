import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AuditPurge, AuditPurgeStatus } from "@prisma/client";
import { compare } from "bcryptjs";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  AUDIT_PURGE_BATCH,
  AUDIT_PURGE_INTERVAL_MS,
  AUDIT_PURGE_LOCK,
  AUDIT_PURGE_PERCENTS,
  AUDIT_PURGE_YIELD_MS,
  type AuditPurgePercent,
} from "./audit-purge.constants";
import { AuditService } from "./audit.service";

const ACTIVE: AuditPurgeStatus[] = [AuditPurgeStatus.PENDING, AuditPurgeStatus.RUNNING];

function isPercent(value: number): value is AuditPurgePercent {
  return (AUDIT_PURGE_PERCENTS as readonly number[]).includes(value);
}

@Injectable()
export class AuditPurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPurgeService.name);
  private draining = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.kick();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Resume a job left RUNNING after a restart. One query; it does not delete rows. */
  @Cron(CronExpression.EVERY_MINUTE)
  resume() {
    this.kick();
  }

  async status() {
    const [total, active, lastDone] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditPurge.findFirst({
        where: { status: { in: ACTIVE } },
        orderBy: { requestedAt: "asc" },
      }),
      this.prisma.auditPurge.findFirst({
        where: { status: AuditPurgeStatus.DONE, finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
      }),
    ]);
    const nextAllowedAt = this.nextAllowedAt(lastDone?.finishedAt ?? null);
    const waiting = nextAllowedAt != null && nextAllowedAt.getTime() > Date.now();
    return {
      total,
      eligible: !waiting && !active,
      nextAllowedAt: waiting && nextAllowedAt ? nextAllowedAt.toISOString() : null,
      lastFinishedAt: lastDone?.finishedAt?.toISOString() ?? null,
      previews: AUDIT_PURGE_PERCENTS.map((percent) => ({
        percent,
        count: Math.floor((total * percent) / 100),
      })),
      job: active ? this.present(active) : null,
    };
  }

  async request(user: AuthUser, percent: number, password: string) {
    if (!isPercent(percent)) {
      throw new BadRequestException("Choose 20%, 40%, 70%, or 100%");
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, isActive: true },
    });
    if (!account?.isActive || !(await compare(password, account.passwordHash))) {
      throw new ForbiddenException("Password is incorrect");
    }

    const job = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_PURGE_LOCK}::bigint)`;
      const active = await tx.auditPurge.findFirst({ where: { status: { in: ACTIVE } } });
      if (active) {
        throw new ConflictException("A purge is already running");
      }
      const last = await tx.auditPurge.findFirst({
        where: { status: AuditPurgeStatus.DONE, finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
      });
      const nextAllowedAt = this.nextAllowedAt(last?.finishedAt ?? null);
      if (nextAllowedAt && nextAllowedAt.getTime() > Date.now()) {
        throw new ForbiddenException("The next deletion is available 90 days after the last one");
      }
      const total = await tx.auditLog.count();
      const targetCount = Math.floor((total * percent) / 100);
      if (targetCount < 1) {
        throw new BadRequestException("There are no audit events to delete");
      }
      return tx.auditPurge.create({
        data: {
          percent,
          totalAtRequest: total,
          targetCount,
          requestedByUserId: user.id,
          requestedByEmail: user.email,
        },
      });
    });

    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "audit.purge.requested",
      entity: "audit",
      entityId: job.id,
      meta: { percent: job.percent, targetCount: job.targetCount },
    });
    this.kick();
    return this.present(job);
  }

  private nextAllowedAt(finishedAt: Date | null): Date | null {
    if (!finishedAt) return null;
    return new Date(finishedAt.getTime() + AUDIT_PURGE_INTERVAL_MS);
  }

  private present(job: AuditPurge) {
    return {
      id: job.id,
      percent: job.percent,
      status: job.status,
      totalAtRequest: job.totalAtRequest,
      targetCount: job.targetCount,
      deletedCount: job.deletedCount,
      requestedAt: job.requestedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }

  /** Start the drain on the next turn. Never runs inside the HTTP handler. */
  private kick() {
    if (this.draining || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, 0);
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    let retry = false;
    try {
      for (;;) {
        const job = await this.prisma.auditPurge.findFirst({
          where: { status: { in: ACTIVE } },
          orderBy: { requestedAt: "asc" },
        });
        if (!job) {
          this.failures = 0;
          return;
        }
        const done = await this.step(job);
        if (done) return;
        await this.sleep(AUDIT_PURGE_YIELD_MS);
      }
    } catch (err) {
      this.failures += 1;
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "unknown";
      this.logger.error(`Audit purge batch failed (${code}), attempt ${this.failures}`);
      if (this.failures >= 5) {
        await this.failActive();
        this.failures = 0;
      } else {
        retry = true;
      }
    } finally {
      this.draining = false;
      if (retry) {
        this.timer = setTimeout(() => {
          this.timer = null;
          void this.drain();
        }, 5000);
      }
    }
  }

  /** One short delete. Returns true when the job is finished. */
  private async step(job: AuditPurge): Promise<boolean> {
    let deletedCount = job.deletedCount;
    if (job.status === AuditPurgeStatus.PENDING) {
      await this.prisma.auditPurge.update({
        where: { id: job.id },
        data: { status: AuditPurgeStatus.RUNNING, startedAt: new Date() },
      });
    }
    const remaining = job.targetCount - deletedCount;
    if (remaining <= 0) {
      await this.complete(job, deletedCount);
      return true;
    }
    const take = Math.min(AUDIT_PURGE_BATCH, remaining);
    const removed = await this.prisma.$executeRaw`
      DELETE FROM "AuditLog"
      WHERE id IN (
        SELECT id FROM "AuditLog"
        ORDER BY "createdAt" ASC, id ASC
        LIMIT ${take}
      )
    `;
    const count = typeof removed === "bigint" ? Number(removed) : removed;
    deletedCount += count;
    if (count === 0 || deletedCount >= job.targetCount) {
      await this.complete(job, deletedCount);
      return true;
    }
    await this.prisma.auditPurge.update({
      where: { id: job.id },
      data: { deletedCount, status: AuditPurgeStatus.RUNNING },
    });
    this.failures = 0;
    return false;
  }

  private async complete(job: AuditPurge, deletedCount: number) {
    await this.prisma.auditPurge.update({
      where: { id: job.id },
      data: {
        deletedCount,
        status: AuditPurgeStatus.DONE,
        finishedAt: new Date(),
        error: null,
      },
    });
    await this.audit.log({
      userId: job.requestedByUserId,
      userEmail: job.requestedByEmail,
      action: "audit.purge.completed",
      entity: "audit",
      entityId: job.id,
      meta: { percent: job.percent, deletedCount, targetCount: job.targetCount },
    });
    this.failures = 0;
    this.logger.log(`Audit purge ${job.id} removed ${deletedCount} oldest events`);
  }

  private async failActive() {
    await this.prisma.auditPurge.updateMany({
      where: { status: { in: ACTIVE } },
      data: { status: AuditPurgeStatus.FAILED, finishedAt: new Date(), error: "Purge stopped after repeated errors" },
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
