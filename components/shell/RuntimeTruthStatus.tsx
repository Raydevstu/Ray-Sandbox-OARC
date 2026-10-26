"use client";

import { useEffect, useState } from 'react';
import { OarcStatusBadge } from '@/components/oarc-v2/foundation';
import type { RuntimeTruth } from '@/lib/runtime/runtime-truth';

const toneFor = (truth: RuntimeTruth | undefined) => truth?.canonicalStore === 'healthy' ? 'ok' : truth ? 'warn' : 'offline';

export function RuntimeTruthStatus() {
  const [truth, setTruth] = useState<RuntimeTruth>();

  useEffect(() => {
    void fetch('/api/runtime-truth', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<RuntimeTruth> : Promise.reject(new Error('runtime metadata unavailable')))
      .then(setTruth)
      .catch(() => setTruth(undefined));
  }, []);

  if (!truth) return <OarcStatusBadge tone="offline">Runtime metadata unavailable</OarcStatusBadge>;
  return <OarcStatusBadge tone={toneFor(truth)}>Runtime: {truth.environment} · {truth.canonicalStore} · {truth.authMode} · {truth.evidence}</OarcStatusBadge>;
}
