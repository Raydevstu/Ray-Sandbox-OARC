import { Pool, type PoolConfig } from 'pg';
import { PostgresRepository } from './repositories/postgres';
import type { CanonicalRepository, SqlExecutor, TransactionExecutor } from './repositories/interfaces';
import type { MemoryScope } from './contracts';
import type { RecallProfiler } from './recall-profiling';

let pool: Pool | null = null;
let leaseSequence = 0;

const databaseUrl = (): string => process.env.APEX_DATABASE_URL?.trim() ?? '';

export const poolMaxFromEnv = (env: Record<string, string | undefined>): number => {
  const value = Number.parseInt(env.APEX_DB_POOL_MAX ?? '', 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(50, value)) : 5;
};

export const isRuntimeStoreConfigured = (): boolean => databaseUrl().startsWith('postgres://') || databaseUrl().startsWith('postgresql://');

const getPool = (): Pool => {
  if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured');
  if (!pool) {
    const config: PoolConfig = { connectionString: databaseUrl(), max: poolMaxFromEnv(process.env), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 2_000 };
    pool = new Pool(config);
  }
  return pool;
};

type ReadClient = Readonly<{
  query: (query: string, params: readonly unknown[]) => Promise<{ rows: readonly Record<string, unknown>[] }>;
  release: () => void;
}>;

type ReadPool = Readonly<{
  query: (query: string, params: readonly unknown[]) => Promise<{ rows: readonly Record<string, unknown>[] }>;
  connect: () => Promise<ReadClient>;
  waitingCount: number;
  totalCount: number;
}>;

export const createReadExecutor = (currentPool: ReadPool, profiler?: RecallProfiler): SqlExecutor => async (query, params) => {
  if (!profiler?.snapshot().enabled) {
    const result = await currentPool.query(query, [...params]);
    return result.rows;
  }
  const leaseStarted = performance.now();
  const leaseId = ++leaseSequence;
  const client = await currentPool.connect();
  profiler.recordLease(performance.now() - leaseStarted, leaseId);
  profiler.mark('connection', performance.now(), { poolWaiting: currentPool.waitingCount, poolTotal: currentPool.totalCount });
  try {
    const result = await client.query(query, [...params]);
    profiler.mark('query', performance.now(), { poolWaiting: currentPool.waitingCount, poolTotal: currentPool.totalCount });
    return result.rows;
  } finally {
    client.release();
  }
};

const transactionWithPool = (currentPool: Pool): TransactionExecutor => async <T>(operation: (execute: SqlExecutor) => Promise<T>): Promise<T> => {
  const client = await currentPool.connect();
  const execute: SqlExecutor = async (query, params) => (await client.query(query, [...params])).rows as readonly Record<string, unknown>[];
  try {
    await client.query('BEGIN');
    const result = await operation(execute);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const createRuntimeRepository = (scope: MemoryScope, profiler?: RecallProfiler): CanonicalRepository => {
  const currentPool = getPool();
  return new PostgresRepository(createReadExecutor(currentPool, profiler), scope, transactionWithPool(currentPool));
};

export type RuntimeStoreStatus = 'not_configured' | 'schema_unready' | 'healthy' | 'unavailable';

export const checkRuntimeStore = async (): Promise<RuntimeStoreStatus> => {
  if (!isRuntimeStoreConfigured()) return 'not_configured';
  try {
    const result = await getPool().query<{ ready: boolean }>("SELECT to_regclass('public.tenants') IS NOT NULL AND to_regclass('public.banks') IS NOT NULL AND to_regclass('public.facts') IS NOT NULL AND to_regclass('public.events') IS NOT NULL AS ready");
    return result.rows[0]?.ready ? 'healthy' : 'schema_unready';
  } catch { return 'unavailable'; }
};
