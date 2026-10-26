import type { CanonicalRepository } from './repositories/interfaces';
import type { MemoryScope, ProjectMemoryRecord } from './contracts';
import { buildMemoryAudit, type MemoryAudit } from './memory-audit';
import { filterProjectMemory, type MemoryFilter } from './memory-filters';

export type AuditReadRequest = Readonly<{ scope: MemoryScope; projectId: string; filter?: MemoryFilter; captureGaps?: readonly string[] }>;

export async function readProjectMemoryAudit(repository: CanonicalRepository, request: AuditReadRequest): Promise<MemoryAudit> {
  if (!request.projectId.trim()) throw new Error('projectId is required');
  const records = await repository.listProjectMemory(request.scope, request.projectId);
  const filtered: readonly ProjectMemoryRecord[] = request.filter ? filterProjectMemory(records, request.filter) : records;
  return buildMemoryAudit(request.projectId, filtered, request.captureGaps);
}
