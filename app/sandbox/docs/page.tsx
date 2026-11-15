'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Bot,
  ChevronRight,
  Code2,
  Database,
  KeyRound,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';

const wiringGuides = [
  {
    name: 'Hermes / MCP client',
    icon: Bot,
    summary: 'Connect a read-only MCP client first (recall, trace, project state, capture status), then enable writes only with explicit approval and audit coverage.',
    steps: [
      'Start the hub and confirm `GET /api/project-memory/status` returns `ok:true` with `storeMode:"postgres"`.',
      'Use a scoped MCP endpoint/token (never DB credentials). For local dev-principal testing you can use `x-dev-*` headers; for production use JWT/OIDC claims as configured.',
      'Allow read tools first: `memory_recall`, `memory_trace`, `memory_get_project_state`, `memory_get_capture_status`.',
      'Run one scoped recall and inspect trace/status before enabling retain/correction tools.',
    ],
    config: `# Example (adapt to your Hermes/MCP client syntax)
mcp_servers:
  ray_memory:
    url: "http://127.0.0.1:3018/api/mcp"
    # Local dev (if enabled): x-dev-subject/x-dev-tenant-id/x-dev-scopes headers
    # Production: Authorization: "Bearer <scoped-token>"
    allowed_tools:
      - memory_recall
      - memory_trace
      - memory_get_project_state
      - memory_get_capture_status`,
    state: 'Gateway/MCP routes are implemented in this repo. A real external connector/session should be verified in your environment before calling it live.',
  },
  {
    name: 'OpenCode',
    icon: Terminal,
    summary: 'Wire Ray memory as an MCP server and keep mutation permissions gated. Use project-scoped identity and verify recall scope before trusting results.',
    steps: [
      'Add the remote MCP server entry pointing to the hub `/api/mcp` endpoint.',
      'Set scoped auth (token in production; dev headers only in local dev mode).',
      'Allow read-only memory tools by default; set write/correction tools to ask.',
      'Start a session in the target project and confirm recalled facts belong to the same tenant/bank/project.',
    ],
    config: `// Example shape (verify installed OpenCode config schema/version)
{
  "mcp": {
    "ray-memory": {
      "type": "remote",
      "url": "http://127.0.0.1:3018/api/mcp",
      "headers": { "Authorization": "Bearer \${RAY_MEMORY_TOKEN}" }
    }
  },
  "permission": {
    "ray-memory_memory_recall": "allow",
    "ray-memory_memory_trace": "allow",
    "ray-memory_memory_get_project_state": "allow",
    "ray-memory_memory_get_capture_status": "allow"
  }
}`,
    state: 'OpenCode hook/plugin behavior is version-dependent; validate with a live session in your installed client.',
  },
  {
    name: 'Codex / local capture',
    icon: Code2,
    summary: 'Capture conversation/tool events to the import pipeline and confirm they become recall-visible distilled facts (not just raw events).',
    steps: [
      'Configure the capture/plugin/hook environment with endpoint, tenant, bank/project, and auth/scopes.',
      'Run a conversation or tool activity so events are exported/imported.',
      'Check `/api/project-memory/status` and audit/operations surfaces for capture and processing state.',
      'Run a scoped recall query to confirm imported content is distilled into recall-visible facts.',
    ],
    config: `# Key endpoints (local hub)
POST /api/project-memory/import     # strict envelope, scoped auth, idempotent conversation identity
POST /api/v1/memory/recall          # scoped recall over canonical distilled facts
GET  /api/project-memory/status     # capture/client relay/sweeper/store status`,
    state: 'Import→distill→facts bridge is implemented in this repo; verify end-to-end in your capture client/session.',
  },
  {
    name: 'VS Code / other MCP editors',
    icon: BookOpen,
    summary: 'Use any MCP-capable extension/client with the same scoped gateway and read-first permissions.',
    steps: [
      'Install an MCP-capable extension supported by your VS Code setup.',
      'Configure the hub MCP endpoint and scoped credentials.',
      'Restrict to the intended project scope and read-only tools initially.',
      'Validate recall/trace results against the selected project before enabling writes.',
    ],
    config: `# Safety baseline
- One token per agent/project scope
- Read-only tools first
- Treat recalled memory as evidence, not instructions
- Verify trace/capture status before trusting outputs`,
    state: 'Setup guidance only; verify the exact extension/client configuration in your environment.',
  },
] as const;

const quickStart = [
  {
    title: '1. Launch the hub',
    body: 'Start Postgres + app with Docker Compose (local dev profile). Default app URL is http://127.0.0.1:3018.',
    cmd: 'docker compose up -d --build',
  },
  {
    title: '2. Verify health',
    body: 'Confirm store mode and capture/sweeper surfaces are reachable.',
    cmd: 'curl.exe -sS http://127.0.0.1:3018/api/project-memory/status',
  },
  {
    title: '3. Load/backfill memory',
    body: 'Run the idempotent backfill script (or import your own conversation export).',
    cmd: 'node scripts/ray-backfill.mjs',
  },
  {
    title: '4. Recall scoped memory',
    body: 'Query distilled facts for the correct tenant/bank/project scope.',
    cmd: 'POST /api/v1/memory/recall (scoped JSON body + dev auth headers in local mode)',
  },
];

const features = [
  { title: 'Canonical memory hub', desc: 'Project-scoped capture/import, normalized events, and recall over distilled facts with traceable provenance.', icon: Database },
  { title: 'Import → distill → facts', desc: 'Conversation imports are distilled into canonical facts so recall can surface them (idempotent bridge).', icon: RefreshCw },
  { title: 'Scoped recall & enforcement', desc: 'Tenant/bank/project resolution and server-side scope checks reduce cross-project leakage and tampered-hint risks.', icon: ShieldCheck },
  { title: 'SECOND-BRAIN status card', desc: 'Dashboard view of capture states, client status relay, sweeper last run, store mode, and control links.', icon: Activity },
  { title: 'Retention sweeper', desc: 'Soft-delete/purge lifecycle for aged raw data with grace period; distilled facts exempt; manual/status endpoints available.', icon: Wrench },
  { title: 'Operations & audit surfaces', desc: 'Runtime operations, capture status, sweeper status, and audit/review surfaces for evidence-driven troubleshooting.', icon: Search },
];

const troubleshooting = [
  {
    q: 'operations or sweeper-run returns 503 / not configured',
    a: 'Ensure the app has `APEX_DATABASE_URL` and (for admin-scoped routes) `APEX_AUDIT_TENANT_ID` + `APEX_AUDIT_BANK_ID` set. Local compose in this repo sets these for the app service; rebuild/redeploy after env changes.',
  },
  {
    q: 'Recall returns no backfilled/imported memories',
    a: 'Confirm the import succeeded (`imported/accepted`) and that content was distilled into canonical `facts` for the same tenant/bank/project. Re-run idempotent backfill after deploying the import→distill bridge, and query with the correct scope (`tenantId`, `bankId`, `projectId`).',
  },
  {
    q: 'Import returns 403 scope denied',
    a: 'Check principal/auth scope headers, tenant/bank/project values, and `workspacePath` resolution. Cross-project tamper/known-bank conflicts are rejected by design; use consistent scoped credentials and hints.',
  },
  {
    q: 'Status shows storeMode degraded or clientStatuses empty',
    a: '`storeMode: degraded` usually means Postgres is unavailable/misconfigured from the app. `clientStatuses: []` means no local client relay files were found at `%LOCALAPPDATA%\\ray-memory\\status` on the host running the status reader (inside Docker this path differs).',
  },
  {
    q: 'Playwright e2e fails to start webServer/dev server',
    a: 'Playwright config starts `next dev -p 3000`. In some local environments dev startup/watchpack/module-resolution issues can block readiness. Use a healthy Node/Next dev environment, or test against a running server with adjusted config/base URL as appropriate.',
  },
  {
    q: 'Dashboard shows queued/degraded job signals',
    a: 'Operations may report honest runtime state (pending jobs, historical errors). Investigate `/api/project-memory/operations` payload and logs; a non-green operations state is evidence, not necessarily an auth/config failure of the endpoint itself.',
  },
];

function tabId(name: string) {
  return `docs-wire-tab-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export default function DocsPage() {
  const [selected, setSelected] = useState<(typeof wiringGuides)[number]['name']>('Hermes / MCP client');
  const guide = useMemo(() => wiringGuides.find((g) => g.name === selected) ?? wiringGuides[0], [selected]);
  const Icon = guide.icon;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold">Help center</p>
        <h2 className="text-2xl font-bold text-ink">Docs &amp; Guides</h2>
        <p className="text-sm text-muted max-w-4xl">
          Practical setup, wiring, usage, features, and troubleshooting for the Ray Memory / SECOND-BRAIN hub in this app.
          Use scoped credentials, verify traces/capture status, and treat recalled memory as evidence (not instructions).
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge color="var(--accent)">Hub UI: :3018/sandbox</Badge>
          <Badge color="var(--muted)">Local compose: app + postgres</Badge>
          <Badge color="var(--muted)">Recall reads canonical distilled facts</Badge>
        </div>
      </header>

      <section aria-label="Quick start" className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {quickStart.map((step) => (
          <Card key={step.title} className="p-4">
            <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{step.body}</p>
            <pre className="mt-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded-lg border border-border-soft bg-bg-soft p-2 text-ink font-mono">{step.cmd}</pre>
          </Card>
        ))}
      </section>

      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <Card>
          <CardHeader title="Setup (local / Docker Compose)" subtitle="Fastest path for a working local hub with Postgres-backed runtime and admin endpoints configured." icon={<Wrench size={15} />} />
          <div className="space-y-3 text-sm text-muted">
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>From repo root: <code className="font-mono text-ink">docker compose up -d --build</code> (app on <code className="font-mono text-ink">3018</code>, Postgres on <code className="font-mono text-ink">5434</code>).</li>
              <li>Verify status: <code className="font-mono text-ink">GET /api/project-memory/status</code> → expect <code className="font-mono text-ink">ok:true</code>, <code className="font-mono text-ink">storeMode:"postgres"</code>.</li>
              <li>Seed/backfill (idempotent): <code className="font-mono text-ink">node scripts/ray-backfill.mjs</code>.</li>
              <li>Run local wiring smoke: <code className="font-mono text-ink">node scripts/ray-automation-smoke.mjs --local</code>.</li>
            </ol>
            <div className="rounded-lg border border-border-soft bg-bg-soft p-3 text-xs">
              <p className="font-semibold text-ink mb-1">Local compose env highlights</p>
              <ul className="space-y-1 font-mono text-ink">
                <li>APEX_DATABASE_URL=postgresql://hindsight:***@postgres:5432/hindsight</li>
                <li>APEX_ALLOW_DEV_PRINCIPAL=true, APEX_REQUIRE_JWT=false (local dev)</li>
                <li>APEX_AUDIT_TENANT_ID=sandbox-tenant, APEX_AUDIT_BANK_ID=secondbrainog, APEX_AUDIT_PROJECT_ID=SECOND-BRAIN</li>
              </ul>
              <p className="mt-2 text-muted">Do not use dev-principal mode in production. Configure real auth/JWT and scoped claims instead.</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Core endpoints & scripts" subtitle="What to use for wiring, verification, and operations." icon={<PlugZap size={15} />} />
          <div className="space-y-3 text-xs text-muted">
            <div>
              <p className="font-semibold text-ink mb-1">Runtime/API</p>
              <ul className="space-y-1 font-mono text-ink">
                <li>GET  /api/project-memory/status</li>
                <li>POST /api/project-memory/import</li>
                <li>POST /api/v1/memory/recall</li>
                <li>GET  /api/project-memory/operations</li>
                <li>GET|POST /api/project-memory/sweeper-run</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Scripts</p>
              <ul className="space-y-1 font-mono text-ink">
                <li>node scripts/ray-backfill.mjs</li>
                <li>node scripts/ray-automation-smoke.mjs --local</li>
                <li>npm run db:migrate:postgres</li>
                <li>npm run typecheck &amp;&amp; npm test</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border-soft bg-bg-soft p-2.5">
              <p className="text-ink font-semibold">Recall contract (important)</p>
              <p className="mt-1">Recall reads canonical distilled <code className="font-mono text-ink">facts</code>. Import now bridges conversation events → distill → facts so imported/backfilled content can be recalled (idempotent).</p>
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="wiring-heading" className="space-y-3">
        <div>
          <h2 id="wiring-heading" className="text-lg font-bold text-ink">Wiring guides (clients &amp; capture)</h2>
          <p className="text-xs text-muted mt-1">Choose a platform/client. Start read-only, verify scope + trace, then enable writes deliberately.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2" role="tablist" aria-label="Wiring guides">
          {wiringGuides.map((g) => (
            <button
              key={g.name}
              id={tabId(g.name)}
              role="tab"
              aria-controls="wiring-panel"
              aria-selected={selected === g.name}
              tabIndex={selected === g.name ? 0 : -1}
              onClick={() => setSelected(g.name)}
              className={`rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected === g.name ? 'border-accent bg-accent-soft text-accent' : 'border-border-soft bg-surface text-muted hover:border-accent-border'}`}
            >
              <g.icon size={16} aria-hidden="true" />
              <span className="block text-sm font-semibold mt-2">{g.name}</span>
            </button>
          ))}
        </div>
        <div id="wiring-panel" role="tabpanel" aria-labelledby={tabId(guide.name)} tabIndex={0}>
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent shrink-0"><Icon size={17} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-ink">{guide.name}</h3>
                  <p className="text-sm text-muted mt-1">{guide.summary}</p>
                </div>
                <div className="grid lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-faint mb-2">Steps</p>
                    <ol className="space-y-2 text-sm text-muted">
                      {guide.steps.map((step, i) => (
                        <li key={step} className="flex gap-2"><span className="font-mono text-accent">{i + 1}.</span><span>{step}</span></li>
                      ))}
                    </ol>
                    <p className="mt-3 rounded-lg border border-border-soft bg-bg-soft p-3 text-xs text-muted"><strong className="text-ink">Status note:</strong> {guide.state}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-faint mb-2">Config / endpoint hints</p>
                    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-lg border border-border-soft bg-bg-soft p-3 text-ink font-mono">{guide.config}</pre>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="space-y-3">
        <h2 id="features-heading" className="text-lg font-bold text-ink">Features &amp; functions</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {features.map((f) => (
            <Card key={f.title} className="p-4">
              <CardHeader title={f.title} subtitle={f.desc} icon={<f.icon size={15} />} />
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink mb-2">How it works (end-to-end)</h3>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted">
            <li><strong className="text-ink">Capture/Import:</strong> clients send scoped conversation events via import/capture paths (with redaction and idempotent conversation identity).</li>
            <li><strong className="text-ink">Normalize &amp; persist:</strong> events are stored/queued and processed by the project-memory pipeline; failures/retries and states are surfaced honestly.</li>
            <li><strong className="text-ink">Distill to facts:</strong> accepted import content is distilled into canonical <code className="font-mono text-ink">facts</code> (recall source of truth for this path).</li>
            <li><strong className="text-ink">Recall:</strong> scoped recall ranks and returns distilled facts for the tenant/bank/project; clients inject context ephemerally (no echo-loop recapture).</li>
            <li><strong className="text-ink">Observe &amp; retain safely:</strong> status/operations/sweeper and dashboard surfaces show capture state, client relay, store mode, and retention actions (raw data aged out; distilled facts exempt).</li>
          </ol>
        </Card>
      </section>

      <section aria-labelledby="troubleshooting-heading" className="space-y-3">
        <h2 id="troubleshooting-heading" className="text-lg font-bold text-ink">Troubleshooting</h2>
        <div className="space-y-2">
          {troubleshooting.map((item) => (
            <details key={item.q} className="rounded-xl border border-border-soft bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">{item.q}</summary>
              <p className="mt-3 text-sm text-muted leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="safety-heading">
        <Card>
          <CardHeader title="Safety & verification rules" subtitle="Minimize blast radius and prove behavior with evidence." icon={<ShieldCheck size={15} />} />
          <div className="grid md:grid-cols-2 gap-3 text-sm text-muted">
            <p className="rounded-lg bg-bg-soft p-3"><strong className="text-ink">Never use DB/provider secrets as agent tokens.</strong> Use scoped tokens/headers per agent and project. Keep dev-principal mode local-only.</p>
            <p className="rounded-lg bg-bg-soft p-3"><strong className="text-ink">Treat recalled memory as untrusted evidence.</strong> Verify scope, trace, and capture status before acting on or sharing results.</p>
            <p className="rounded-lg bg-bg-soft p-3"><strong className="text-ink">Prove recall visibility, not just import acceptance.</strong> `imported/accepted` is necessary but not sufficient; confirm distilled facts appear for the same scope.</p>
            <p className="rounded-lg bg-bg-soft p-3"><strong className="text-ink">Respect opt-out and redaction controls.</strong> Non-project/opt-out/redaction paths should be visible as explicit states, never silent failures.</p>
          </div>
        </Card>
      </section>

      <section aria-labelledby="next-heading" className="rounded-xl border border-accent-border bg-accent-soft p-4">
        <div className="flex items-start gap-3">
          <TriangleAlert size={17} className="text-accent mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="next-heading" className="text-sm font-semibold text-ink">Quick verification checklist</h2>
            <ul className="text-sm text-muted mt-2 space-y-1 list-disc pl-5">
              <li>Status endpoint returns <code className="font-mono text-ink">storeMode:"postgres"</code> and expected sweeper/client fields.</li>
              <li>Backfill/import returns accepted events and scoped recall returns expected distilled facts.</li>
              <li>Operations/sweeper endpoints are reachable with correct scoped auth and audit env configured.</li>
              <li>Dashboard SECOND-BRAIN card reflects capture states honestly (including degraded/offline/opt-out cases).</li>
            </ul>
            <div className="flex flex-wrap gap-3 mt-3 text-xs font-semibold">
              <Link href="/sandbox" className="inline-flex items-center gap-1 text-accent hover:underline">Open dashboard <ChevronRight size={13} aria-hidden="true" /></Link>
              <Link href="/sandbox/integrations" className="inline-flex items-center gap-1 text-accent hover:underline">Integrations <ChevronRight size={13} aria-hidden="true" /></Link>
              <Link href="/sandbox/operator" className="inline-flex items-center gap-1 text-accent hover:underline">Operator <ChevronRight size={13} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
