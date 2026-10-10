import type { ProjectMemoryRecord } from './contracts';

export type AuditStatus = ProjectMemoryRecord['status'] | 'uncaptured';
export type MemoryAudit = Readonly<{ projectId: string; total: number; counts: Readonly<Record<AuditStatus, number>>; records: readonly ProjectMemoryRecord[]; captureGaps: readonly string[] }>;
const statuses: readonly AuditStatus[] = ['active', 'verified', 'pending', 'blocked', 'stale', 'conflict', 'uncertain', 'superseded', 'uncaptured'];

export const buildMemoryAudit = (projectId: string, records: readonly ProjectMemoryRecord[], captureGaps: readonly string[] = []): MemoryAudit => {
  const scoped = records.filter((record) => record.projectId === projectId);
  const counts = Object.fromEntries(statuses.map((status) => [status, scoped.filter((record) => record.status === status).length])) as Record<AuditStatus, number>;
  return { projectId, total: scoped.length, counts, records: [...scoped].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)), captureGaps: [...captureGaps] };
};

export const auditStatusLabel = (status: AuditStatus): string => status === 'uncaptured' ? 'Uncaptured' : status[0].toUpperCase() + status.slice(1);
