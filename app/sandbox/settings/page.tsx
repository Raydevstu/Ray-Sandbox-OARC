"use client";

/* Settings — appearance, layout, engine defaults, data management.
   Everything writes to persisted state instantly. */

import { useRef, useState } from "react";
import {
  Download, Eye, Monitor, Palette, RotateCcw, Settings2, Sun, Moon, Upload,
  Database, Trash2, BookOpen, Github,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, Input, Segmented, Slider, Textarea, Toggle } from "@/components/ui";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { RuntimeStatus } from "@/components/memory/RuntimeStatus";
import { RepairPanel } from "@/components/memory/RepairPanel";

const ACCENTS = [
  { name: "Violet", hue: 257 },
  { name: "Indigo", hue: 232 },
  { name: "Blue", hue: 210 },
  { name: "Teal", hue: 178 },
  { name: "Emerald", hue: 152 },
  { name: "Amber", hue: 38 },
  { name: "Rose", hue: 348 },
  { name: "Fuchsia", hue: 292 },
];

export default function SettingsPage() {
  const s = useSandbox();
  const ui = s.ui;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportState = () => {
    const state = useSandbox.getState();
    const { hydrated, ...rest } = state;
    void hydrated;
    const blob = new Blob([JSON.stringify(rest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hindsight-sandbox-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    s.logEvent({ app: "system", op: "system", message: "State exported to JSON" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ============ appearance ============ */}
      <Card>
        <CardHeader title="Appearance" subtitle="theme, accent and motion — persisted and applied before first paint" icon={<Palette size={15} />} />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div>
              <p className="text-xs text-muted mb-2">Theme</p>
              <Segmented
                value={ui.theme}
                onChange={(v) => s.setUi({ theme: v })}
                options={[
                  { value: "dark", label: <span className="flex items-center gap-1.5"><Moon size={12} /> Dark</span> },
                  { value: "light", label: <span className="flex items-center gap-1.5"><Sun size={12} /> Light</span> },
                ]}
              />
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Density</p>
              <Segmented
                value={ui.density}
                onChange={(v) => s.setUi({ density: v })}
                options={[
                  { value: "cozy", label: "Cozy" },
                  { value: "compact", label: "Compact" },
                ]}
              />
            </div>
            <Toggle checked={ui.animations} onChange={(v) => s.setUi({ animations: v })} label="Animations" description="Graph pulses, packet flow, fade-ins." />
            <Toggle checked={ui.showTraceDetails} onChange={(v) => s.setUi({ showTraceDetails: v })} label="Verbose recall traces" description="Show per-arm ranks and boost math in the Memory app." />
            <div>
              <p className="text-xs text-muted mb-2">Execution mode</p>
              <Segmented value={ui.runtimeMode} onChange={(v) => s.setUi({ runtimeMode: v })} options={[{ value: "deterministic", label: "Deterministic" }, { value: "runtime", label: "Runtime" }]} />
              <p className="text-[11px] text-faint mt-1">Runtime mode is explicit; health and canonical-store readiness are reported below.</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted">Accent hue</p>
              <span className="font-mono text-xs text-accent">hsl({ui.accentHue} 90% 68%)</span>
            </div>
            <Slider min={0} max={360} value={ui.accentHue} onChange={(v) => s.setUi({ accentHue: v })} label="Fine tune" format={(v) => `${v}°`} />
            <div className="flex flex-wrap gap-2 mt-3">
              {ACCENTS.map((a) => (
                <button
                  key={a.name}
                  title={a.name}
                  onClick={() => s.setUi({ accentHue: a.hue })}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                    ui.accentHue === a.hue ? "border-ink scale-110" : "border-transparent"
                  )}
                  style={{ background: `linear-gradient(120deg, hsl(${a.hue} 90% 65%), hsl(${a.hue + 75} 85% 60%))` }}
                />
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-border-soft bg-bg-soft p-3">
              <p className="text-[10px] uppercase tracking-widest text-faint mb-2">Preview</p>
              <div className="flex items-center gap-2">
                <Badge color="var(--accent)">accent</Badge>
                <Badge color="var(--accent-2)">accent-2</Badge>
                <Button size="sm" variant="primary">Primary</Button>
                <span className="text-xs gradient-text font-bold">gradient</span>
              </div>
              <div className="flex gap-1.5 mt-2.5">
                {["world", "experience", "observation", "opinion"].map((n) => (
                  <span key={n} className="w-full h-1.5 rounded-full" style={{ background: `var(--${n})` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ============ layout ============ */}
      <Card>
        <CardHeader title="Layout" icon={<Monitor size={15} />} />
        <div className="space-y-4">
          <Toggle checked={ui.sidebarCollapsed} onChange={(v) => s.setUi({ sidebarCollapsed: v })} label="Collapse sidebar by default" description="Maximizes canvas space for the orchestrator and graph views." />
          <Slider label="Background grid opacity" min={0} max={1} step={0.1} value={ui.gridOpacity} onChange={(v) => s.setUi({ gridOpacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      </Card>

      <RuntimeStatus mode={ui.runtimeMode} />
      <RepairPanel />

      {/* ============ data ============ */}
      <Card>
        <CardHeader title="Data" subtitle="everything lives in localStorage — export it, import it, or start over" icon={<Database size={15} />} />
        <div className="grid md:grid-cols-2 gap-3">
          <Button variant="outline" onClick={exportState}>
            <Download size={14} /> Export state (JSON)
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import state
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              const ok = s.importState(text);
              setImportMsg(ok ? "✓ State imported successfully." : "✗ Invalid JSON — nothing changed.");
            }}
          />
          {confirmReset ? (
            <div className="md:col-span-2 flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/8 p-3" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)" }}>
              <Trash2 size={15} className="text-danger shrink-0" />
              <p className="text-xs text-ink flex-1">Reset all banks, memories, prompts, learning state and canvas to the seeded demo?</p>
              <Button size="sm" variant="danger" onClick={() => { s.resetDemo(); setConfirmReset(false); }}>Yes, reset</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={14} /> Reset demo data
            </Button>
          )}
        </div>
        {importMsg && <p className="text-xs text-muted mt-2 anim-fade-up">{importMsg}</p>}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          {[
            { l: "banks", v: s.banks.length },
            { l: "memories", v: s.facts.length },
            { l: "observations", v: s.observations.length },
            { l: "opinions", v: s.opinions.length },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border border-border-soft bg-surface-2 py-2.5">
              <p className="text-lg font-bold text-ink tabular-nums">{x.v}</p>
              <p className="text-[9.5px] uppercase tracking-wider text-faint">{x.l}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ============ bank defaults ============ */}
      <Card>
        <CardHeader title="Active bank identity" subtitle="name, background and disposition for the bank selected in the top bar" icon={<Eye size={15} />} />
        <BankEditor />
      </Card>

      {/* ============ auto-import ============ */}
      <Card>
        <CardHeader title="Auto-import & project detection" subtitle="automatically detect projects and import files without manual setup" icon={<Database size={15} />} />
        <div className="space-y-4">
          <Toggle
            checked={s.autoImportEnabled}
            onChange={(v) => s.setAutoImportEnabled(v)}
            label="Enable auto-import"
            description="Watch a directory for new project files and auto-retain them into isolated banks."
          />
          <div>
            <p className="text-xs text-muted mb-1.5">Watch directory path</p>
            <Input
              value={s.autoImportPath}
              onChange={(e) => s.setAutoImportPath(e.target.value)}
              placeholder="e.g. ~/.hermes/projects or D:/Projects"
              className="text-xs"
            />
            <p className="text-[11px] text-faint mt-1">Files in this directory will be auto-imported when auto-import is enabled. Leave empty to disable.</p>
          </div>
          {s.detectedProject && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
              <p className="text-xs font-medium text-ink">Detected project: {s.detectedProject}</p>
              <p className="text-[11px] text-muted mt-0.5">New facts will be routed to this project's bank automatically.</p>
            </div>
          )}
          {Object.keys(s.projectBanks).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-faint mb-1">Project banks</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(s.projectBanks).map(([name, id]) => (
                  <span key={name} className="chip text-[10px]">{name} → {id}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ============ about ============ */}
      <Card>
        <CardHeader title="About" icon={<Settings2 size={15} />} />
        <div className="text-[12.5px] text-muted leading-relaxed space-y-2">
          <p>
            <b className="text-ink">Ray Sandbox OARC</b> is an open-source (MIT) study environment modeled on the
            Hindsight agent-memory architecture: four networks (world, experience, observation, opinion), three
            operations (retain, recall, reflect), a temporal entity graph with four link types, four-arm retrieval
            with RRF fusion, cross-encoder reranking, token-budget packing, evidence-grounded observation
            consolidation, and disposition-shaped reasoning — all simulated deterministically in the browser.
          </p>
          <p>
            The Continuous Learning app replays the inference structure of UMA (Task-Stratified GRPO, CRUD memory
            bank, Ledger-QA). The Benchmarks app displays published numbers from the source papers.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href="https://arxiv.org/abs/2512.12818" target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><BookOpen size={12} /> arXiv:2512.12818</Button></a>
            <a href="https://arxiv.org/abs/2602.18493" target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><BookOpen size={12} /> arXiv:2602.18493 (UMA)</Button></a>
            <a href="https://arxiv.org/abs/2606.06448" target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><BookOpen size={12} /> arXiv:2606.06448 (systems)</Button></a>
            <a href="https://github.com/vectorize-io/hindsight" target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Github size={12} /> Upstream Hindsight</Button></a>
            <a href="https://hindsight.vectorize.io/" target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Eye size={12} /> hindsight.vectorize.io</Button></a>
          </div>
          <p className="text-[11px] text-faint pt-1">
            Not affiliated with Vectorize.io. Built with Next.js App Router, React, Tailwind CSS v4 and zustand — no
            backend, no LLM calls, no tracking.
          </p>
        </div>
      </Card>
    </div>
  );
}

function BankEditor() {
  const s = useSandbox();
  const bank = s.banks.find((b) => b.id === s.activeBankId);
  const [name, setName] = useState(bank?.name ?? "");
  const [bg, setBg] = useState(bank?.background ?? "");
  const [newBank, setNewBank] = useState(false);
  const [nbName, setNbName] = useState("");
  const [nbBg, setNbBg] = useState("");
  const [nbPath, setNbPath] = useState("");
  const [nbCwd, setNbCwd] = useState("");
  const [nbMsg, setNbMsg] = useState("");

  if (!bank) return null;

  const createBankEverywhere = async () => {
    const clean = nbName.trim();
    if (!clean) return;
    s.createBank(clean, nbBg.trim() || `I am ${clean}.`);
    setNbMsg("Local bank created…");
    try {
      const res = await fetch("/api/v1/memory/banks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: clean, watchPath: nbPath.trim() || undefined, hermesCwd: nbCwd.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.ok) {
        setNbMsg(`Server bank ready${json.data?.imported ? ` · ${json.data.imported} files imported` : ""}${json.data?.watching ? " · watching" : ""}.`);
      } else {
        setNbMsg(`Server bank skipped (${json?.error ?? res.status}). Local bank still works.`);
      }
    } catch {
      setNbMsg("Server unreachable — local bank still works.");
    }
    setNewBank(false); setNbName(""); setNbBg(""); setNbPath(""); setNbCwd("");
    setTimeout(() => setNbMsg(""), 8000);
  };
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-[200px_1fr] gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-faint mb-1">Name</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => s.updateBank(bank.id, { name })} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-faint mb-1">Background (first person)</p>
          <Textarea rows={2} value={bg} onChange={(e) => setBg(e.target.value)} onBlur={() => s.updateBank(bank.id, { background: bg })} className="text-xs" />
        </div>
      </div>
      <div className="border-t border-border-soft pt-4">
        {newBank ? (
          <div className="space-y-2.5 anim-fade-up">
            <Input value={nbName} onChange={(e) => setNbName(e.target.value)} placeholder="New bank name — e.g. support-agent" className="text-xs w-64" autoFocus />
            <Textarea rows={2} value={nbBg} onChange={(e) => setNbBg(e.target.value)} placeholder="I am a … (first-person background)" className="text-xs" />
            <Input value={nbPath} onChange={(e) => setNbPath(e.target.value)} placeholder="Docs folder — e.g. demo (under /projects)" className="text-xs w-64" />
            <Input value={nbCwd} onChange={(e) => setNbCwd(e.target.value)} placeholder="Hermes cwd — e.g. D:\Projects\Demo (chat sync)" className="text-xs w-64" />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={!nbName.trim()} onClick={() => void createBankEverywhere()}>
                Create bank
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewBank(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setNewBank(true)}>
            + New memory bank
          </Button>
        )}
        <p className="text-[11px] text-faint mt-2">
          Banks are fully isolated: separate networks, profile Θ, directives and observation scopes. Switch with the
          selector in the top bar. A docs folder creates the server bank too and starts auto-import.
        </p>
        {nbMsg && <p className="text-[11px] text-ink mt-1">{nbMsg}</p>}
      </div>
    </div>
  );
}
