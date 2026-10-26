import process from 'node:process';
import { Pool } from 'pg';
import { auditDerivedMemoryProvenance, auditMutationLedger } from '../lib/runtime/quality-audit.ts';

const databaseUrl = process.env.APEX_DATABASE_URL?.trim() ?? '';
if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('APEX_DATABASE_URL must be a PostgreSQL connection string.');
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000 });
const scope = { tenantId: process.env.APEX_AUDIT_TENANT_ID?.trim(), bankId: process.env.APEX_AUDIT_BANK_ID?.trim(), projectId: process.env.APEX_AUDIT_PROJECT_ID?.trim() };
const where = scope.tenantId && scope.bankId ? 'WHERE tenant_id = $1 AND bank_id = $2' : '';
const params = scope.tenantId && scope.bankId ? [scope.tenantId, scope.bankId] : [];
try {
  const records = await pool.query(`SELECT id, evidence FROM project_memory_records ${where} ORDER BY created_at`, params);
  const events = await pool.query(`SELECT id, type, payload FROM project_events ${where} ORDER BY occurred_at`, params);
  const provenance = auditDerivedMemoryProvenance(records.rows.map((row) => ({ id: String(row.id), evidence: Array.isArray(row.evidence) ? row.evidence : [] })));
  const eventKeys = new Set(events.rows.flatMap((event) => [event.id, event.payload?.mutationId, event.payload?.eventId, event.payload?.recordId, event.payload?.record?.id, event.payload?.conversation?.messageId, event.payload?.source?.messageId].filter(Boolean).map(String)));
  const missingMutationIds = records.rows.filter((row) => !eventKeys.has(String(row.id)) && !(Array.isArray(row.evidence) && row.evidence.some((evidence) => eventKeys.has(String(evidence.reference))))).map((row) => String(row.id));
  const mutations = { totalMutations: records.rowCount ?? 0, represented: (records.rowCount ?? 0) - missingMutationIds.length, missingMutationIds, coverage: records.rowCount ? ((records.rowCount ?? 0) - missingMutationIds.length) / records.rowCount : 1 };
  const result = { scope: scope.tenantId && scope.bankId ? scope : 'all', records: records.rowCount ?? 0, events: events.rowCount ?? 0, provenance, mutationLedger: mutations, status: provenance.coverage === 1 && mutations.coverage === 1 ? 'pass' : 'fail' };
  console.log(JSON.stringify(result));
  if (result.status !== 'pass') process.exitCode = 1;
} finally { await pool.end(); }
