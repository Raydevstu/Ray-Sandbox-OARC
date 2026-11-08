import { getPgPool } from "./pg-client";
import { bootNightlyScheduler } from "./scheduler";

export function shouldBootScheduler(env: Record<string, string | undefined>): boolean {
  return env.APEX_NIGHTLY === "true";
}

export function watcherKey(tenantId: string, bankId: string): string {
  return `${tenantId}/${bankId}`;
}

let booted = false;

// Called lazily from API routes (serverless-safe): boots the in-process
// nightly scheduler once per instance when APEX_NIGHTLY=true.
export function ensureSchedulerBooted(tenantId: string, bankId: string): void {
  if (booted) return;
  if (!shouldBootScheduler(process.env)) return;
  const pool = getPgPool();
  if (!pool) return;
  booted = true;
  bootNightlyScheduler(pool, tenantId, bankId);
}
