'use client';

import { useState } from 'react';

type ReviewAction = 'approve-supersession' | 'mark-uncertain' | 'invalidate';

export function MemoryReviewPanel({ tenantId, bankId, projectId, recordId }: Readonly<{ tenantId: string; bankId: string; projectId: string; recordId: string }>) {
  const [action, setAction] = useState<ReviewAction>('mark-uncertain');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  async function submit() {
    if (!reason.trim()) { setState('error'); setMessage('A review reason is required.'); return; }
    setState('saving');
    try {
      const response = await fetch('/api/project-memory/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenantId, bankId, projectId, recordId, action, reason }) });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Review failed');
      setState('saved'); setMessage('Review recorded. Refresh the audit to see the new projection.');
    } catch (error) { setState('error'); setMessage(error instanceof Error ? error.message : 'Review failed'); }
  }
  return <div className="mt-3 rounded-lg border border-border-soft bg-surface-2 p-3">
    <div className="text-[11px] uppercase tracking-wider text-faint">Operator review</div>
    <div className="mt-2 flex flex-wrap gap-2">
      <label className="text-xs text-muted">Action <select className="ml-2 rounded border border-border-soft bg-surface px-2 py-1 text-xs text-ink" value={action} onChange={(event) => setAction(event.target.value as ReviewAction)}><option value="approve-supersession">Approve supersession</option><option value="mark-uncertain">Mark uncertain</option><option value="invalidate">Invalidate evidence</option></select></label>
      <input className="min-w-[240px] flex-1 rounded border border-border-soft bg-surface px-2 py-1 text-xs text-ink" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason linked to evidence…" aria-label="Review reason" />
      <button className="rounded border border-accent/40 px-3 py-1 text-xs text-ink disabled:opacity-50" disabled={state === 'saving'} onClick={submit}>{state === 'saving' ? 'Saving…' : 'Record review'}</button>
    </div>
    {message && <p className={`mt-2 text-xs ${state === 'error' ? 'text-danger' : 'text-muted'}`} role="status">{message}</p>}
  </div>;
}
