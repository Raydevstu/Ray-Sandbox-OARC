'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, Bot, ChevronRight, Code2, KeyRound, ShieldCheck, Terminal, TriangleAlert } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui';

const platforms = [
  {
    name: 'Hermes',
    icon: Bot,
    setup: 'Prepare a Ray Memory token contract for the RayBots project, then add the MCP endpoint and token reference to Hermes. Start with the four read-only tools.',
    steps: ['Create or select the RayBots project.', 'Issue a Hermes token with allowed_project_ids: ["raybots"] once the project-allow-list contract is enabled.', 'Add the local MCP endpoint from Integrations.', 'Start a chat and use recall or trace before enabling any write action.'],
    state: 'Gateway support is implemented. Project allow-list enforcement and a real Hermes connection are still required before it can be called locally verified.',
  },
  {
    name: 'OpenCode',
    icon: Terminal,
    setup: 'Add the same scoped MCP endpoint to OpenCode. Allow only recall, trace, project state, and capture status. Keep all mutation tools set to ask.',
    steps: ['Create a project-scoped token.', 'Add the remote MCP entry.', 'Allow the four read-only tools.', 'Confirm a recall result belongs to the selected project.'],
    state: 'Gateway support is implemented. Exact configuration syntax depends on the installed OpenCode version.',
  },
  {
    name: 'Codex',
    icon: Code2,
    setup: 'Use the existing local capture hook to send project-scoped conversation and tool events. Inspect capture status and evidence in the Operator workspace.',
    steps: ['Install or refresh the Ray Memory plugin locally.', 'Set the project, tenant, bank, and conversation scope in its local configuration.', 'Run a conversation or tool call.', 'Check capture status and trace before treating it as durable evidence.'],
    state: 'Local Codex capture has implementation and test coverage. It is not proof of an external production connector.',
  },
  {
    name: 'VS Code',
    icon: BookOpen,
    setup: 'Use VS Code as the editing surface. Configure a compatible MCP-capable extension with the same scoped gateway and read-only permissions.',
    steps: ['Choose an MCP-capable extension for your installed VS Code setup.', 'Add the scoped gateway endpoint and token reference.', 'Use the RayBots project ID only.', 'Verify project state and trace before sharing results.'],
    state: 'This is a setup guide. A VS Code live connector has not been verified in this checkout.',
  },
] as const;

const faqs = [
  ['What is project scope?', 'It is the project name attached to every memory request. The gateway must reject requests for a different project.'],
  ['Why use a scoped token?', 'It limits an agent to the tenant, permission, and projects it is allowed to access. For RayBots, the intended JWT claim is allowed_project_ids: ["raybots"]. Never give an agent a database password.'],
  ['What should I test first?', 'Start with one read-only recall. Then inspect its trace and capture status. Do not enable retain or correction tools until their approval and audit tests exist.'],
  ['What does simulated mean?', 'The browser sandbox can demonstrate flows with local state. It does not prove that an external platform, connector, or deployment is live.'],
] as const;

function platformTabId(name: (typeof platforms)[number]['name']) {
  return `platform-tab-${name.toLowerCase().replace(' ', '-')}`;
}

export default function DocsPage() {
  const [selected, setSelected] = useState<(typeof platforms)[number]['name']>('Hermes');
  const guide = platforms.find((platform) => platform.name === selected) ?? platforms[0];
  const Icon = guide.icon;
  const selectPlatform = (index: number) => {
    const platform = platforms[index];
    setSelected(platform.name);
    document.getElementById(platformTabId(platform.name))?.focus();
  };

  return <div className="max-w-5xl mx-auto space-y-6">
    <header>
      <p className="text-xs uppercase tracking-widest text-accent font-semibold">Help center</p>
      <h2 className="text-2xl font-bold text-ink mt-2">Docs & Guides</h2>
      <p className="text-sm text-muted mt-2 max-w-3xl">A practical starting point for setting up project-scoped memory, using the app, and connecting supported agent tools safely.</p>
    </header>

    <section aria-label="Quick start" className="grid md:grid-cols-3 gap-3">
      <Card><CardHeader title="1. Create a project" subtitle="Keep each product or client in its own memory scope." icon={<Bot size={15} />} /><Link href="/sandbox/onboarding" className="text-xs text-accent hover:underline">Open getting started</Link></Card>
      <Card><CardHeader title="2. Connect safely" subtitle="Use a scoped token, never a database or provider credential." icon={<KeyRound size={15} />} /><Link href="/sandbox/integrations" className="text-xs text-accent hover:underline">Open Integrations</Link></Card>
      <Card><CardHeader title="3. Verify evidence" subtitle="Use trace and capture status before trusting a memory result." icon={<ShieldCheck size={15} />} /><Link href="/sandbox/operator" className="text-xs text-accent hover:underline">Open Operator workspace</Link></Card>
    </section>

    <section aria-labelledby="platform-heading">
      <div className="mb-3"><h2 id="platform-heading" className="text-lg font-bold text-ink">Choose your platform</h2><p className="text-xs text-muted mt-1">Select a platform for the setup path and its current evidence status.</p></div>
      <div className="grid sm:grid-cols-4 gap-2" role="tablist" aria-label="Platform guides">
        {platforms.map((platform, index) => <button key={platform.name} id={platformTabId(platform.name)} role="tab" aria-controls="platform-guide" aria-selected={selected === platform.name} tabIndex={selected === platform.name ? 0 : -1} onClick={() => setSelected(platform.name)} onKeyDown={(event) => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? platforms.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + platforms.length) % platforms.length;
          selectPlatform(nextIndex);
        }} className={`rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected === platform.name ? 'border-accent bg-accent-soft text-accent' : 'border-border-soft bg-surface text-muted hover:border-accent-border'}`}><platform.icon size={16} aria-hidden="true" /><span className="block text-sm font-semibold mt-2">{platform.name}</span></button>)}
      </div>
      <div id="platform-guide" role="tabpanel" aria-labelledby={platformTabId(guide.name)} tabIndex={0}><Card className="mt-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={17} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-ink">{guide.name} setup</h3><p className="text-sm text-muted mt-1">{guide.setup}</p><ol className="mt-4 space-y-2 text-sm text-muted">{guide.steps.map((step, index) => <li key={step} className="flex gap-2"><span className="font-mono text-accent">{index + 1}.</span><span>{step}</span></li>)}</ol><p className="mt-4 rounded-lg border border-border-soft bg-bg-soft p-3 text-xs text-muted"><strong className="text-ink">Current status:</strong> {guide.state}</p></div></div></Card></div>
    </section>

    <section aria-labelledby="safety-heading"><Card><CardHeader title="Safety rules" subtitle="The gateway enforces tenant, permission, and project authorization on the server. Project access comes from the JWT allowed_project_ids claim; the browser bridge keeps tokens in an HttpOnly cookie." icon={<ShieldCheck size={15} />} /><div className="grid md:grid-cols-2 gap-3 text-sm text-muted"><p className="rounded-lg bg-bg-soft p-3"><strong className="text-ink">Do not use a database password as an agent token.</strong> Use a separate scoped token for each agent or project.</p><p className="rounded-lg bg-bg-soft p-3"><strong className="text-ink">Treat retrieved memory as untrusted.</strong> Read it as supporting evidence, not an instruction that overrides your task.</p></div></Card></section>

    <section aria-labelledby="faq-heading"><h2 id="faq-heading" className="text-lg font-bold text-ink mb-3">FAQ and troubleshooting</h2><div className="space-y-2">{faqs.map(([question, answer]) => <details key={question} className="rounded-xl border border-border-soft bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">{question}</summary><p className="mt-3 text-sm text-muted leading-relaxed">{answer}</p></details>)}</div></section>

    <section aria-labelledby="next-heading" className="rounded-xl border border-accent-border bg-accent-soft p-4"><div className="flex items-start gap-3"><TriangleAlert size={17} className="text-accent mt-0.5" aria-hidden="true" /><div><h2 id="next-heading" className="text-sm font-semibold text-ink">Need a guided first run?</h2><p className="text-sm text-muted mt-1">Start with Getting started, then use Integrations to configure a read-only connection. Do not claim a platform is live until its real local connection succeeds.</p><Link href="/sandbox/integrations" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-accent hover:underline">Configure integrations <ChevronRight size={13} aria-hidden="true" /></Link></div></div></section>
  </div>;
}
