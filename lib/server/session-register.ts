import { bankIdForCwd, findBankForCwd, type BankCwdRow } from './hermes-push';

export interface SessionScope {
  tenantId: string;
  sessionId: string;
  bankId: string;
  projectId?: string;
  cwd?: string;
  registeredAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type Entry = SessionScope;
const registry = new Map<string, Entry>();

const keyOf = (tenantId: string, sessionId: string) => `${tenantId}\u0000${sessionId}`;

function prune(now = Date.now()) {
  for (const [key, entry] of registry.entries()) {
    if (entry.expiresAt <= now) registry.delete(key);
  }
}

export function clearSessionRegistry(): void {
  registry.clear();
}

export function registerSession(
  input: { tenantId: string; sessionId: string; bankId: string; projectId?: string; cwd?: string },
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
): SessionScope {
  prune(now);
  const entry: SessionScope = {
    tenantId: input.tenantId,
    sessionId: input.sessionId,
    bankId: input.bankId,
    projectId: input.projectId,
    cwd: input.cwd,
    registeredAt: now,
    expiresAt: now + ttlMs,
  };
  registry.set(keyOf(input.tenantId, input.sessionId), entry);
  return entry;
}

export function resolveSessionScope(tenantId: string, sessionId: string, now = Date.now()): SessionScope | null {
  prune(now);
  const entry = registry.get(keyOf(tenantId, sessionId));
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    registry.delete(keyOf(tenantId, sessionId));
    return null;
  }
  if (entry.tenantId !== tenantId) return null;
  return entry;
}

export function resolveRegisteredBankProject(input: {
  cwd?: string;
  bank?: string | null;
  project?: string | null;
  knownBanks?: BankCwdRow[];
}): { bankId: string; projectId?: string } {
  const cwd = String(input.cwd ?? '').trim();
  const explicitBank = input.bank?.trim();
  const explicitProject = input.project?.trim() || undefined;
  if (explicitBank) {
    return {
      bankId: explicitBank.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || explicitBank,
      projectId: explicitProject,
    };
  }
  if (cwd) {
    const matched = input.knownBanks?.length ? findBankForCwd(input.knownBanks, cwd) : null;
    return { bankId: matched ?? bankIdForCwd(cwd), projectId: explicitProject };
  }
  return { bankId: 'default', projectId: explicitProject };
}
