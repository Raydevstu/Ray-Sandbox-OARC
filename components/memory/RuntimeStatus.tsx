"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { fetchRuntimeHealth } from "@/lib/runtime/client";
import { initialRuntimeHealth, type RuntimeHealth, type UiRuntimeMode } from "@/lib/runtime/ui-mode";

export function RuntimeStatus({ mode }: { mode: UiRuntimeMode }) {
  const [health, setHealth] = useState<RuntimeHealth>(initialRuntimeHealth());
  const [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); setHealth(await fetchRuntimeHealth()); setBusy(false); };
  useEffect(() => { void check(); }, []);
  const color = health.status === "healthy" ? "var(--ok)" : health.status === "unavailable" ? "var(--danger)" : "var(--faint)";
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-accent" />
        <p className="text-[10px] uppercase tracking-widest text-faint flex-1">Runtime status</p>
        <Badge color={mode === "runtime" ? "var(--accent)" : "var(--muted)"}>{mode}</Badge>
        <Badge color={color}>{health.status}</Badge>
        <Button size="icon" variant="ghost" title="Check runtime health" onClick={() => void check()} disabled={busy}>
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        </Button>
      </div>
      <p className="text-[11px] text-muted mt-2">{health.message}</p>
      {health.requestId && <p className="text-[10px] text-faint font-mono mt-1">request {health.requestId}</p>}
    </Card>
  );
}

