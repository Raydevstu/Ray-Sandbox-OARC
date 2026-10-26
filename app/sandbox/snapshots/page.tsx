"use client";

import { useState } from "react";
import { History, GitCompare, RotateCcw, RefreshCw, Camera } from "lucide-react";
import { Badge, Button, Card, CardHeader, Empty, Input } from "@/components/ui";
import { useSandbox } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

export default function SnapshotsPage() {
  const s = useSandbox();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const create = () => { const snapshot = s.createSnapshot(name || `checkpoint-${new Date().toLocaleTimeString()}`, "manual checkpoint"); setSelected(snapshot.id); setName(""); setMessage(`Created ${snapshot.name}`); };
  const diff = selected ? s.diffSnapshot(selected) : null;
  const selectedSnapshot = s.snapshots.find((snapshot) => snapshot.id === selected);
  const currentEval = s.evalRuns[0];
  const snapshotEval = selectedSnapshot?.data.evalRuns[0];
  if (!s.hydrated) return <Empty title="Restoring sandbox state…" />;
  return <div className="max-w-[1100px] mx-auto space-y-4">
    <Card><CardHeader title="Experiment snapshots" subtitle="Create safe checkpoints before changing memory or retrieval behavior." icon={<History size={15} />} />
      <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Snapshot name" /><Button onClick={create}><Camera size={13} /> Create snapshot</Button><Button variant="outline" onClick={() => { const report = s.rebuildIndexes(); setMessage(`Indexes rebuilt: ${report.factCount} facts · ${report.entityCount} entities`); }}><RefreshCw size={13} /> Rebuild indexes</Button></div>{message && <p className="text-xs text-ok mt-2">{message}</p>}</Card>
    <div className="grid lg:grid-cols-[1fr_360px] gap-4"><Card><CardHeader title="Checkpoint history" subtitle={`${s.snapshots.length} retained snapshots`} icon={<History size={15} />} />
      <div className="space-y-2">{s.snapshots.map((snapshot) => <button key={snapshot.id} onClick={() => setSelected(snapshot.id)} className={`w-full text-left border rounded-lg p-3 ${selected === snapshot.id ? "border-accent bg-accent/5" : "border-line"}`}><div className="flex items-center gap-2"><span className="font-medium text-ink">{snapshot.name}</span><Badge color="var(--muted)">{snapshot.checksum}</Badge></div><p className="text-xs text-muted mt-1">{timeAgo(snapshot.createdAt)} · {snapshot.data.facts.length} facts · {snapshot.data.links.length} links</p></button>)}{!s.snapshots.length && <Empty icon={<Camera size={24} />} title="No snapshots yet" hint="Create a checkpoint before experimenting." />}</div></Card>
      <Card><CardHeader title="Diff, evaluation, and restore" subtitle={selected ? "Compared with current state" : "Select a snapshot"} icon={<GitCompare size={15} />} />{diff && <div className="space-y-3 text-xs"><div className="grid grid-cols-2 gap-2"><div className="metric"><b>{diff.addedFacts.length}</b><span>added facts</span></div><div className="metric"><b>{diff.removedFacts.length}</b><span>removed facts</span></div><div className="metric"><b>{diff.changedFacts.length}</b><span>changed facts</span></div><div className="metric"><b>{diff.evalRunsAdded}</b><span>new eval runs</span></div></div>{currentEval && snapshotEval && <div className="border border-line rounded-lg p-3"><p className="text-[10px] uppercase tracking-widest text-faint">Latest deterministic evaluation</p><div className="flex justify-between mt-2"><span>snapshot <b className="text-ink">{snapshotEval.accuracy}%</b></span><span>current <b className="text-ink">{currentEval.accuracy}%</b></span><Badge color={currentEval.accuracy >= snapshotEval.accuracy ? "var(--ok)" : "var(--danger)"}>{(currentEval.accuracy - snapshotEval.accuracy).toFixed(1)} pts</Badge></div></div>}<Button variant="outline" className="w-full" onClick={() => { if (selected && window.confirm("Restore this snapshot? A safety snapshot will be created first.")) { s.restoreSnapshot(selected); setMessage("Snapshot restored; safety checkpoint preserved."); } }}><RotateCcw size={13} /> Restore selected snapshot</Button></div>}{!diff && <p className="text-xs text-muted">Select a checkpoint to inspect changes and restore it explicitly.</p>}</Card></div>
  </div>;
}
