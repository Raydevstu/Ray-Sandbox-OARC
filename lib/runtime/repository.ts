import { Pool, type PoolConfig } from 'pg';
import { PostgresRepository } from './repositories/postgres';
import type { CanonicalRepository, SqlExecutor } from './repositories/interfaces';
import type { MemoryScope } from './contracts';

let pool: Pool | null = null;

const databaseUrl = (): string => process.env.APEX_DATABASE_URL?.trim() ?? '';

export const isRuntimeStoreConfigured = (): boolean => databaseUrl().startsWith('postgres://') || databaseUrl().startsWith('postgresql://');

const getPool = (): Pool => {
  if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured');
  if (!pool) {
    const config: PoolConfig = { connectionString: databaseUrl(), max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 2_000 };
    pool = new Pool(config);
  }
  return pool;
};

const executeWithPool = (currentPool: Pool): SqlExecutor => async (query, params) => {
  const result = await currentPool.query(query, [...params]);
  return result.rows as readonly Record<string, unknown>[];
};

export const createRuntimeRepository = (scope: MemoryScope): CanonicalRepository => new PostgresRepository(executeWithPool(getPool()), scope);

export type RuntimeStoreStatus = 'not_configured' | 'schema_unready' | 'healthy' | 'unavailable';

export const checkRuntimeStore = async (): Promise<RuntimeStoreStatus> => {
  if (!isRuntimeStoreConfigured()) return 'not_configured';
  try {
    const result = await getPool().query<{ ready: boolean }>("SELECT to_regclass('public.tenants') IS NOT NULL AND to_regclass('public.banks') IS NOT NULL AND to_regclass('public.facts') IS NOT NULL AND to_regclass('public.events') IS NOT NULL AS ready");
    return result.rows[0]?.ready ? 'healthy' : 'schema_unready';
  } catch { return 'unavailable'; }
};
