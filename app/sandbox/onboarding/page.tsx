'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Eye, MessageSquarePlus, Search } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui';

const steps = [
  { number: '01', title: 'Connect your agent', detail: 'Start with a safe sample project, then switch to your real project scope.', href: '/sandbox/integrations', icon: Bot },
  { number: '02', title: 'Retain one conversation', detail: 'Store one useful decision or preference in durable project memory.', href: '/sandbox/memory', icon: MessageSquarePlus },
  { number: '03', title: 'Recall it later', detail: 'Ask a question and see the selected memories with their rationale.', href: '/sandbox/memory', icon: Search },
  { number: '04', title: 'Inspect the evidence', detail: 'Open Memory Trace, review a result, replay the event, and evaluate the outcome.', href: '/sandbox/memory-trace', icon: Eye },
] as const;

export default function OnboardingPage() {
  const [status, setStatus] = useState<{ state: string; projectId?: string; error?: string }>({ state: 'connecting' });
  useEffect(() => { void fetch('/api/project-memory/onboarding', { cache: 'no-store' }).then(async (response) => { const body = await response.json(); setStatus({ state: body.state ?? 'failed', projectId: body.data?.projectId, error: body.error }); }).catch(() => setStatus({ state: 'unavailable', error: 'Memory service is unavailable.' })); }, []);
  const connected = status.state === 'healthy';
  return <div className="max-w-4xl mx-auto space-y-6"><div><p className="text-xs uppercase tracking-widest text-accent font-semibold">Getting started</p><h1 className="text-2xl font-bold text-ink mt-2">From conversation to explainable memory</h1><p className="text-sm text-muted mt-2 max-w-2xl">Memory binds automatically to the authenticated workspace. No project IDs or code changes are required.</p></div><Card><CardHeader title={connected ? 'Connected · Memory ready' : status.state === 'connecting' ? 'Connecting memory…' : 'Memory setup required'} subtitle={connected ? `Project scope: ${status.projectId}` : status.error ?? 'Authenticate a workspace with a project scope to continue.'} /></Card><div className="grid gap-3">{steps.map(({ number, title, detail, href, icon: Icon }) => <Link key={number} href={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Card className="transition-colors hover:border-accent"><div className="flex items-start gap-4"><span className="text-xs font-mono text-faint pt-1">{number}</span><Icon size={18} className="text-accent mt-0.5" aria-hidden="true" /><div className="flex-1"><h2 className="text-sm font-semibold text-ink">{title}</h2><p className="text-xs text-muted mt-1">{detail}</p></div><ArrowRight size={16} className="text-faint mt-1" aria-hidden="true" /></div></Card></Link>)}</div><Card><CardHeader title="What you will be able to explain" subtitle="Every recalled memory keeps its lineage" /><ul className="grid sm:grid-cols-3 gap-3 text-xs text-muted"><li>Why it was selected</li><li>Which source supports it</li><li>How current and confident it is</li></ul></Card></div>;
}
