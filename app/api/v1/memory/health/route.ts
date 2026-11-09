import { NextResponse } from "next/server";
import { getPgPool, ensureSchema } from "../../../../../lib/server/pg-client";

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPgPool();
    if (!pool) throw new Error("no pg pool");
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    const factCount = await pool.query("SELECT COUNT(*)::int AS n FROM facts");
    const lastSync = await pool.query("SELECT MAX(created_at) AS last FROM facts");
    return NextResponse.json({
      ok: true,
      tables: tables.rows.map((r: any) => r.table_name),
      factCount: factCount.rows[0].n,
      lastSync: lastSync.rows[0].last,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
