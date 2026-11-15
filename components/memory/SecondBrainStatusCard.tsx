"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Brain, CheckCircle2, Clock3, Database, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";

type ClientStatus = {
  platform?: string;
  agent?: string;
  state?: string;
  at?: string;
  lastError?: string;
  error?: string;
  spoolDepth?: number;
  optOut?: boolean;
  capture?: boolean;
  sourceFile?: string;
  [key: string]: unknown;
};

type StatusPayload = {
  ok?: boolean;
  data?: {
    capture?: Record<string, unknown>;
    clientStatuses?: ClientStatus[];
    retentionSweeper?: { scanned: number; softDeleted: number; purged: number; durationMs: number; at?: string } | null;
    storeMode?: "postgres" | "degraded" | "not_configured";
    state?: string;
    processed?: number;
    failed?: number;
    [key: string]: unknown;
  };
};

type OpsPayload = {
  ok?: boolean;
  data?: {
    status?: "ok" | "degraded";
    retentionSweeper?: StatusPayload["data"] extends { retentionSweeper?: infer T } ? T : unknown;
    capture?: Record<string, unknown>;
    jobs?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: string;
};

function badgeForState(state: string | undefined): { label: string; color: string; tone: "green" | "gray" | "red" } {
  const s = String(state ?? "uncaptured");
  if (s === "captured" || s === "captured_with_redaction" || s === "processed" || s === "distilled") {
    return { label: s, color: "var(--ok)", tone: "green" };
  }
  if (s.startsWith("skipped_") || s === "uncaptured") {
    return { label: s, color: "var(--muted)", tone: "gray" };
  }
  if (
    s === "spooled_offline" ||
    s === "failed_retrying" ||
    s === "dropped_spool_overflow" ||
    s === "degraded" ||
    s === "recall_skipped_hub_down" ||
    s === "no-store" ||
    s === "error"
  ) {
    return { label: s, color: "var(--danger)", tone: "red" };
  }
  return { label: s, color: "var(--warn)", tone: "red" };
}

function fmtTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  return new Date(t).toLocaleString();
}

export function SecondBrainStatusCard() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [ops, setOps] = useState<OpsPayload | null>(null);
  const [auditInfo, setAuditInfo] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [sRes, oRes, aRes] = await Promise.allSettled([
        fetch("/api/project-memory/status", { cache: "no-store" }),
        fetch("/api/project-memory/operations", { cache: "no-store" }),
        fetch("/api/project-memory/audit", { cache: "no-store" }),
      ]);

      if (sRes.status === "fulfilled") {
        try { setStatus(await sRes.value.json()); } catch { setStatus(null); }
      } else {
        setStatus(null);
      }

      if (oRes.status === "fulfilled") {
        try { setOps(await oRes.value.json()); } catch { setOps(null); }
      } else {
        setOps(null);
      }

      if (aRes.status === "fulfilled") {
        const r = aRes.value;
        if (r.ok) setAuditInfo({ ok: true, message: "audit reachable" });
        else setAuditInfo({ ok: false, message: `audit ${r.status}` });
      } else {
        setAuditInfo({ ok: false, message: "audit unavailable" });
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const clientStatuses = useMemo(() => status?.data?.clientStatuses ?? [], [status]);
  const sweeper = (status?.data?.retentionSweeper ?? ops?.data?.retentionSweeper ?? null) as
    | { scanned?: number; softDeleted?: number; purged?: number; durationMs?: number; at?: string }
    | null;
  const storeMode = status?.data?.storeMode ?? "unknown";
  const captureState = String(status?.data?.capture?.state ?? status?.data?.state ?? "uncaptured");

  return (
    <Card data-testid="second-brain-card">
      <CardHeader
        title="SECOND-BRAIN status"
        subtitle="Per-project × agent capture, spool, sweeper, and store health (D5)."
        icon={<Brain size={15} />}
        right={
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={busy} title="Refresh SECOND-BRAIN status">
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-lg border border-border-soft bg-surface-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint flex items-center gap-1"><Database size={11} /> Store mode</p>
          <p className="text-sm font-mono text-ink mt-1" data-testid="second-brain-store-mode">{String(storeMode)}</p>
        </div>
        <div className="rounded-lg border border-border-soft bg-surface-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint flex items-center gap-1"><Activity size={11} /> Hub capture</p>
          <div className="mt-1"><Badge color={badgeForState(captureState).color}>{badgeForState(captureState).label}</Badge></div>
        </div>
        <div className="rounded-lg border border-border-soft bg-surface-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint flex items-center gap-1"><Clock3 size={11} /> Sweeper last run</p>
          <p className="text-[12px] text-ink mt-1">{fmtTime(sweeper?.at)}</p>
          <p className="text-[10px] text-faint font-mono">scanned {sweeper?.scanned ?? 0} · soft {sweeper?.softDeleted ?? 0} · purged {sweeper?.purged ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border-soft bg-surface-2 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-faint flex items-center gap-1"><ShieldAlert size={11} /> Ops/audit</p>
          <p className="text-[12px] text-ink mt-1">ops: {ops?.ok === false ? `error (${ops.error ?? "unavailable"})` : (ops?.data?.status ?? "unknown")}</p>
          <p className="text-[10px] text-faint">{auditInfo?.message ?? "audit unknown"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Per project × agent (client status relay)</p>
          <Badge color={clientStatuses.length ? "var(--accent)" : "var(--muted)"}>{clientStatuses.length} agent(s)</Badge>
        </div>

        {clientStatuses.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-surface-2 p-4 text-sm text-muted" data-testid="second-brain-empty">
            No client status files found on this machine yet. Start an OpenCode/Codex/Hermes session with Ray memory capture enabled to populate <span className="font-mono">%LOCALAPPDATA%\ray-memory\status\</span>.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {clientStatuses.map((cs, idx) => {
              const st = String(cs.state ?? "uncaptured");
              const badge = badgeForState(st);
              const isLoud = badge.tone === "red";
              const optOut = cs.optOut === true || cs.capture === false || st === "skipped_optout";
              const lastErr = String(cs.lastError ?? cs.error ?? "");
              return (
                <div
                  key={`${String(cs.platform ?? cs.agent ?? "agent")}-${idx}`}
                  data-testid="second-brain-agent-row"
                  data-state={st}
                  className={`rounded-xl border p-3 ${isLoud ? "border-danger/50 bg-danger/10" : "border-border-soft bg-surface-2"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">
                        {String(cs.platform ?? cs.agent ?? "unknown-agent")}
                        {typeof cs.project === "string" && cs.project ? <span className="text-faint"> · {cs.project}</span> : null}
                      </p>
                      <p className="text-[11px] text-faint">Last capture: {fmtTime(cs.at ?? cs.lastCaptureAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge color={badge.color}>{badge.label}</Badge>
                      {optOut && <Badge color="var(--warn)">opt-out</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted">
                    <span>Spool depth: <b className="text-ink font-mono">{typeof cs.spoolDepth === "number" ? cs.spoolDepth : "—"}</b></span>
                    <span>Store: <b className="text-ink font-mono">{String(cs.storeMode ?? storeMode)}</b></span>
                  </div>
                  {lastErr ? (
                    <p className="mt-2 text-[11px] text-danger flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" /><span className="break-all">Last error: {lastErr}</span></p>
                  ) : (
                    <p className="mt-2 text-[11px] text-faint flex items-center gap-1"><CheckCircle2 size={12} /> No last error reported.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <Link href="/sandbox/memory-audit" className="chip hover:border-accent-border">Audit</Link>
        <Link href="/sandbox/operator" className="chip hover:border-accent-border">Review / Operator</Link>
        <Link href="/sandbox/settings" className="chip hover:border-accent-border">Policies / Settings</Link>
        <Link href="/sandbox/operator" className="chip hover:border-accent-border">Conflicts</Link>
        <Link href="/api/project-memory/export" className="chip hover:border-accent-border" target="_blank">Export</Link>
        <Link href="/sandbox/memory-audit" className="chip hover:border-accent-border">Delete / Purge</Link>
      </div>
    </Card>
  );
}

export default SecondBrainStatusCard;
