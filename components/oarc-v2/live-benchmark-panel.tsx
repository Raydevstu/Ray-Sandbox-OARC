"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { summarizeBenchmark, type ControlledBenchmarkRun, type BenchmarkMode } from "@/lib/runtime/benchmark-contract";

type BenchmarkRun = {
  id: string;
  mode: string;
  answerScore: number | null;
  citationPrecision: number | null;
  unsupportedClaimRate: number | null;
  latencyMs: number | null;
  captureStatus: string;
  generatedAt: string;
};

export function LiveBenchmarkPanel() {
  const [projectId, setProjectId] = useState("current-project");
  const [tenantId, setTenantId] = useState("tenant-local");
  const [bankId, setBankId] = useState("oarc-bank");
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("No live run loaded.");

  async function loadRuns() {
    setState("loading");
    try {
      const query = new URLSearchParams({ tenantId, bankId, projectId, limit: "20" });
      const response = await fetch(`/api/project-memory/benchmark?${query.toString()}`, { cache: "no-store" });
      const body = await response.json() as { data?: { runs?: ControlledBenchmarkRun[] }; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
      const persistedRuns = body.data?.runs ?? [];
      const modes: BenchmarkMode[] = ["without-memory", "local-memory", "postgres-memory", "manifest-memory"];
      const rows = persistedRuns.flatMap((run) => {
        const summary = summarizeBenchmark(run);
        return modes.map((mode) => {
          const item = summary[mode];
          const captured = run.cases.filter((entry) => entry.mode === mode).map((entry) => entry.captureStatus);
          return { id: run.id, mode, answerScore: item.cases ? item.answerScore : null, citationPrecision: item.cases ? item.citationPrecision : null, unsupportedClaimRate: item.cases ? item.unsupportedClaimRate : null, latencyMs: item.cases ? item.p50LatencyMs : null, captureStatus: captured.length ? [...new Set(captured)].join(", ") : "no cases", generatedAt: run.generatedAt };
        });
      });
      setRuns(rows);
      setMessage(persistedRuns.length ? `${persistedRuns.length} persisted run(s) loaded.` : "No persisted runs for this project yet.");
      setState("ready");
    } catch (error) {
      setRuns([]);
      setMessage(error instanceof Error ? error.message : "Unable to load live benchmark runs.");
      setState("error");
    }
  }

  useEffect(() => { void loadRuns(); }, []);

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader title="Live project benchmark" subtitle="Persisted comparison runs from the authenticated runtime; published charts below are reference data." icon={<Activity size={15} />} />
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor="benchmark-tenant-id" className="text-[11px] text-muted">Tenant ID<input id="benchmark-tenant-id" name="tenantId" value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="mt-1 block rounded border border-border-soft bg-bg px-2 py-1.5 text-xs text-ink" /></label>
        <label htmlFor="benchmark-bank-id" className="text-[11px] text-muted">Bank ID<input id="benchmark-bank-id" name="bankId" value={bankId} onChange={(event) => setBankId(event.target.value)} className="mt-1 block rounded border border-border-soft bg-bg px-2 py-1.5 text-xs text-ink" /></label>
        <label htmlFor="benchmark-project-id" className="text-[11px] text-muted">Project ID<input id="benchmark-project-id" name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 block rounded border border-border-soft bg-bg px-2 py-1.5 text-xs text-ink" /></label>
        <button type="button" onClick={() => void loadRuns()} disabled={state === "loading"} className="chip inline-flex items-center gap-1 hover:border-accent-border disabled:opacity-50"><RefreshCw size={11} className={state === "loading" ? "animate-spin" : ""} /> Refresh</button>
        <a href={`/api/project-memory/benchmark?tenantId=${encodeURIComponent(tenantId)}&bankId=${encodeURIComponent(bankId)}&projectId=${encodeURIComponent(projectId)}&format=markdown&limit=100`} className="chip hover:border-accent-border">Export Markdown</a>
      </div>
      <p role="status" aria-live="polite" className={`mt-3 text-xs ${state === "error" ? "text-danger" : "text-muted"}`}>{message}</p>
      {runs.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr className="border-b border-border-soft text-faint"><th className="py-1 pr-3">Mode</th><th className="py-1 pr-3">Answer</th><th className="py-1 pr-3">Citation</th><th className="py-1 pr-3">Unsupported</th><th className="py-1 pr-3">Latency</th><th className="py-1">Capture</th></tr></thead><tbody>{runs.map((run) => <tr key={`${run.id}-${run.mode}`} className="border-b border-border-soft/60 text-muted"><td className="py-1.5 pr-3">{run.mode}</td><td className="py-1.5 pr-3">{run.answerScore === null ? "—" : `${(run.answerScore * 100).toFixed(1)}%`}</td><td className="py-1.5 pr-3">{run.citationPrecision === null ? "—" : `${(run.citationPrecision * 100).toFixed(1)}%`}</td><td className="py-1.5 pr-3">{run.unsupportedClaimRate === null ? "—" : `${(run.unsupportedClaimRate * 100).toFixed(1)}%`}</td><td className="py-1.5 pr-3">{run.latencyMs === null ? "—" : `${run.latencyMs} ms`}</td><td className="py-1.5">{run.captureStatus}</td></tr>)}</tbody></table></div>}
      <p className="mt-3 text-[11px] leading-relaxed text-faint">A browser 401/403 here is evidence that the page is not authenticated to the project-memory API; it is not a benchmark result. Real Codex comparison requires the host hook to submit both without-memory and memory-enabled runs.</p>
    </Card>
  );
}
