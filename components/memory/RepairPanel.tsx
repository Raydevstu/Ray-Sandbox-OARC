"use client";

import { useState } from "react";
import { HardDrive, RotateCcw, Wrench } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui";
import { useSandbox } from "@/lib/store";

export function RepairPanel() {
  const s = useSandbox();
  const [message, setMessage] = useState<string | null>(null);
  const rebuild = () => { const report = s.rebuildIndexes(); setMessage(`Rebuilt ${report.factCount} facts and ${report.linkCount} links.`); };
  const replay = () => { const result = s.replayOfflineQueue(); setMessage(`Replayed ${result.delivered} queued event(s)${result.errors.length ? ` with ${result.errors.length} error(s)` : "."}`); };
  return (
    <Card>
      <CardHeader title="Operator controls" subtitle="Local recovery actions are explicit and reversible; they do not claim to repair the remote runtime." icon={<Wrench size={15} />} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={rebuild}><HardDrive size={13} /> Rebuild local indexes</Button>
        <Button size="sm" variant="outline" onClick={replay}><RotateCcw size={13} /> Replay offline queue</Button>
      </div>
      {message && <p className="text-[11px] text-muted mt-2">{message}</p>}
    </Card>
  );
}

