"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Clock3, Database, FileText, Layers3, LoaderCircle, Search, WifiOff, X } from "lucide-react";
import type { MemoryFact, RecallTrace } from "@/lib/types";
import { cn, fmtMs } from "@/lib/utils";
import { OarcCard, OarcIconButton, OarcStatusBadge, OarcVisuallyHidden } from "./foundation";

export type EvidenceState = "ready" | "loading" | "empty" | "stale" | "error" | "offline";

export function MemoryQueryComposer({ query, onQueryChange, onSubmit, busy, state, presets }: { query: string; onQueryChange: (query: string) => void; onSubmit: () => void; busy: boolean; state: EvidenceState; presets: readonly string[] }) {
  const stateLabel = { ready: "Ready", loading: "Retrieving", empty: "No results", stale: "Showing stale trace", error: "Retrieval error", offline: "Offline" }[state];
  return <OarcCard title="Recall workbench" description="Ask the active memory scope and inspect how evidence was selected." actions={<OarcStatusBadge tone={state === "error" ? "danger" : state === "offline" ? "offline" : state === "stale" ? "warn" : "info"}>{stateLabel}</OarcStatusBadge>}>
    <form className="oarc-query-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label htmlFor="oarc-memory-query"><OarcVisuallyHidden>Memory query</OarcVisuallyHidden></label>
      <Search size={16} aria-hidden="true" className="text-faint shrink-0" />
      <input id="oarc-memory-query" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Ask the bank anything…" disabled={busy} />
      <button type="submit" disabled={busy || !query.trim()}>{busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : "Run recall"}</button>
    </form>
    <div className="oarc-preset-row" aria-label="Query presets">{presets.map((preset) => <button type="button" key={preset} onClick={() => onQueryChange(preset)}>{preset}</button>)}</div>
  </OarcCard>;
}

export function RetrievalTraceTimeline({ trace, state, onCitation }: { trace: RecallTrace | null; state: EvidenceState; onCitation: (fact: MemoryFact) => void }) {
  const steps = useMemo(() => trace ? [
    { label: "Lexical + dense candidate search", detail: `${trace.candidates.length} candidates`, tone: "info" as const },
    { label: "Four-arm retrieval", detail: `${trace.arms.semantic.length} semantic · ${trace.arms.bm25.length} keyword · ${trace.arms.graph.length} graph · ${trace.arms.temporal.length} temporal`, tone: "info" as const },
    { label: "Rank fusion and reranking", detail: `RRF fusion · ${fmtMs(trace.latencyMs)}`, tone: "ok" as const },
    { label: "Token-budget packing", detail: `${trace.tokensUsed}/${trace.maxTokens} tokens · ${trace.selected.length} selected`, tone: trace.selected.length ? "ok" as const : "warn" as const },
  ] : [], [trace]);
  if (state === "loading") return <OarcCard title="Retrieval trace"><div className="oarc-skeleton-stack" aria-label="Retrieval trace loading"><span /><span /><span /></div></OarcCard>;
  if (state === "offline") return <OarcCard title="Retrieval trace"><div className="oarc-state-panel"><WifiOff size={20} /><p>Offline mode is active. Connect the runtime to inspect a live retrieval trace.</p></div></OarcCard>;
  if (state === "error") return <OarcCard title="Retrieval trace"><div className="oarc-state-panel oarc-state-danger"><AlertCircle size={20} /><p>Retrieval failed. Your previous trace, if available, remains available as stale evidence.</p></div></OarcCard>;
  if (!trace) return <OarcCard title="Retrieval trace"><div className="oarc-state-panel"><Layers3 size={20} /><p>Run a query to see lexical, dense, graph, temporal, fusion, and packing decisions.</p></div></OarcCard>;
  return <OarcCard title="Retrieval trace" description="Local deterministic retrieval trace" actions={<span className="chip">{state === "stale" ? "stale" : "fresh"}</span>}>
    <ol className="oarc-trace-timeline">{steps.map((step, index) => <li key={step.label}><span className={cn("oarc-trace-marker", `oarc-trace-${step.tone}`)}>{index + 1}</span><div><strong>{step.label}</strong><span>{step.detail}</span></div>{index < steps.length - 1 && <ChevronRight size={14} className="oarc-trace-arrow" aria-hidden="true" />}</li>)}</ol>
    <div className="oarc-citation-strip"><span className="oarc-metric-label">Selected evidence</span><div>{trace.selected.length ? trace.selected.map((candidate, index) => <button type="button" key={candidate.fact.id} onClick={() => onCitation(candidate.fact)}><span>[{index + 1}]</span>{candidate.fact.text}</button>) : <span className="text-muted text-xs">No sources selected.</span>}</div></div>
  </OarcCard>;
}

export function ContextLayerStack({ trace }: { trace: RecallTrace | null }) {
  const layers = [
    ["Working", trace?.layerTokens?.l0 ?? 0, "current query and active instructions"],
    ["Episodic", trace?.layerTokens?.l1 ?? trace?.tokensUsed ?? 0, "selected recalled events"],
    ["Semantic", trace?.layerTokens?.l2 ?? 0, "compressed observations and entities"],
  ] as const;
  return <OarcCard title="Layered context" description="The context budget is visible before it reaches the agent."><div className="oarc-layer-stack">{layers.map(([name, tokens, detail]) => <div className="oarc-layer-row" key={name}><span className="oarc-layer-index">L{name === "Working" ? "0" : name === "Episodic" ? "1" : "2"}</span><div className="flex-1 min-w-0"><strong>{name}</strong><span>{detail}</span></div><code>{tokens} tokens</code></div>)}</div></OarcCard>;
}

export function EvidenceDrawer({ fact, onClose }: { fact: MemoryFact | null; onClose: () => void }) {
  if (!fact) return null;
  return <aside className="oarc-evidence-drawer" aria-label="Evidence details" role="dialog" aria-modal="false"><div className="oarc-drawer-header"><div><OarcStatusBadge tone="info">Citation</OarcStatusBadge><h2>{fact.text}</h2></div><OarcIconButton label="Close evidence" onClick={onClose}><X size={16} /></OarcIconButton></div><dl className="oarc-drawer-facts"><div><dt>Memory ID</dt><dd>{fact.id}</dd></div><div><dt>Network</dt><dd>{fact.network}</dd></div><div><dt>Source timestamp</dt><dd>{new Date(fact.mentionedAt).toLocaleString()}</dd></div><div><dt>Confidence</dt><dd>{fact.confidence == null ? "Not scored" : `${Math.round(fact.confidence * 100)}%`}</dd></div></dl><div className="oarc-drawer-section"><h3><FileText size={14} /> Provenance</h3><p>{fact.chunkRef ?? "Local deterministic memory record"}</p></div><div className="oarc-drawer-section"><h3><Database size={14} /> Scope</h3><p>{Object.entries(fact.scopes).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Unscoped"}</p></div><div className="oarc-drawer-section"><h3><Clock3 size={14} /> Timeline</h3><p>{fact.occurredStart ? `${fact.occurredStart} → ${fact.occurredEnd ?? "ongoing"}` : "No event window recorded"}</p></div></aside>;
}
