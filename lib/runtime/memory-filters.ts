import type { ProjectMemoryRecord } from './contracts';

export type FilterOperator = 'eq' | 'ne' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'icontains';
export type MemoryFilter = Readonly<Record<string, unknown>> | Readonly<{ AND: readonly MemoryFilter[] }> | Readonly<{ OR: readonly MemoryFilter[] }> | Readonly<{ NOT: MemoryFilter }>;

const fields = new Set(['projectId', 'id', 'type', 'status', 'importance', 'confidence', 'title', 'content', 'createdAt', 'updatedAt', 'source.platform', 'source.conversationId', 'identity.userId', 'identity.agentId', 'identity.appId', 'identity.runId']);
const operators = new Set<FilterOperator>(['eq', 'ne', 'in', 'gt', 'gte', 'lt', 'lte', 'contains', 'icontains']);
const valueAt = (record: ProjectMemoryRecord, field: string): unknown => field.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, record);
const compare = (actual: unknown, op: FilterOperator, expected: unknown): boolean => {
  if (op === 'in') return Array.isArray(expected) && expected.some((item) => compare(actual, 'eq', item));
  if (op === 'contains' || op === 'icontains') return typeof actual === 'string' && typeof expected === 'string' && (op === 'contains' ? actual.includes(expected) : actual.toLowerCase().includes(expected.toLowerCase()));
  if (op === 'eq') return expected === '*' ? actual !== undefined && actual !== null : actual === expected;
  if (op === 'ne') return !compare(actual, 'eq', expected);
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    if (typeof actual !== 'number' && typeof actual !== 'string') return false;
    if (typeof expected !== 'number' && typeof expected !== 'string') return false;
    return op === 'gt' ? actual > expected : op === 'gte' ? actual >= expected : op === 'lt' ? actual < expected : actual <= expected;
  }
  return false;
};

export function validateMemoryFilter(filter: MemoryFilter): void {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) throw new Error('filter must be an object');
  for (const [key, value] of Object.entries(filter)) {
    if (key === 'AND' || key === 'OR') { if (!Array.isArray(value) || value.length === 0) throw new Error(`${key} must be a non-empty array`); value.forEach((item) => validateMemoryFilter(item as MemoryFilter)); continue; }
    if (key === 'NOT') { validateMemoryFilter(value as MemoryFilter); continue; }
    if (!fields.has(key)) throw new Error(`unsupported filter field: ${key}`);
    if (value && typeof value === 'object' && !Array.isArray(value)) for (const op of Object.keys(value)) if (!operators.has(op as FilterOperator)) throw new Error(`unsupported filter operator: ${op}`);
  }
}

export function matchesMemoryFilter(record: ProjectMemoryRecord, filter: MemoryFilter): boolean {
  validateMemoryFilter(filter);
  return Object.entries(filter).every(([key, value]) => {
    if (key === 'AND') return (value as MemoryFilter[]).every((item) => matchesMemoryFilter(record, item));
    if (key === 'OR') return (value as MemoryFilter[]).some((item) => matchesMemoryFilter(record, item));
    if (key === 'NOT') return !matchesMemoryFilter(record, value as MemoryFilter);
    const actual = valueAt(record, key);
    if (value && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value).every(([op, expected]) => compare(actual, op as FilterOperator, expected));
    return compare(actual, 'eq', value);
  });
}

export function filterProjectMemory(records: readonly ProjectMemoryRecord[], filter: MemoryFilter): readonly ProjectMemoryRecord[] {
  validateMemoryFilter(filter);
  return records.filter((record) => matchesMemoryFilter(record, filter));
}
