import type { MemoryScope } from '../contracts';
export type ProjectionName = 'lexical' | 'layers' | 'graph';
export type RebuildReport = Readonly<{ scope: MemoryScope; projection: ProjectionName; processed: number; completedAt: string }>;
export const rebuildProjection = async (scope: MemoryScope, projection: ProjectionName, events: readonly { tenantId: string; bankId: string }[]): Promise<RebuildReport> => { if (events.some((event) => event.tenantId !== scope.tenantId || event.bankId !== scope.bankId)) throw new Error('scope denied'); return { scope: { ...scope }, projection, processed: events.length, completedAt: new Date().toISOString() }; };
