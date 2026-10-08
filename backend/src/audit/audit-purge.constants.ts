/** Shares of the current audit log an admin may delete. Oldest rows go first. */
export const AUDIT_PURGE_PERCENTS = [20, 40, 70, 100] as const;

export type AuditPurgePercent = (typeof AUDIT_PURGE_PERCENTS)[number];

/** One successful purge per 90 days. */
export const AUDIT_PURGE_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;

/** Dashboard flag once the log reaches this many events. */
export const AUDIT_PURGE_FLAG_AT = 5000;

/** Rows removed per statement so the delete never holds a long lock. */
export const AUDIT_PURGE_BATCH = 500;

/** Pause between batches so HTTP handlers can run. */
export const AUDIT_PURGE_YIELD_MS = 50;

/** Serializes enqueue across API processes. Not a secret. */
export const AUDIT_PURGE_LOCK = 8142001;
