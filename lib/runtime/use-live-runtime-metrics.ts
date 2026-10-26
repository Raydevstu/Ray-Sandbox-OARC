"use client";

import { useEffect, useState } from 'react';
import type { RuntimeMetricsSnapshot } from './live-metrics';

export type RuntimeStreamStatus = 'live' | 'stale' | 'disconnected';

export function useLiveRuntimeMetrics() {
  const [snapshot, setSnapshot] = useState<RuntimeMetricsSnapshot>();
  const [status, setStatus] = useState<RuntimeStreamStatus>('disconnected');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    const source = new EventSource('/api/runtime-metrics?stream=1');
    let receivedAt = 0;
    const onSnapshot = (event: MessageEvent<string>) => {
      setSnapshot(JSON.parse(event.data) as RuntimeMetricsSnapshot);
      receivedAt = Date.now();
      setStatus('live');
    };
    source.addEventListener('snapshot', onSnapshot);
    source.onerror = () => setStatus('disconnected');
    const freshness = window.setInterval(() => {
      if (receivedAt && Date.now() - receivedAt > 15_000) setStatus('stale');
    }, 1_000);
    return () => {
      motion.removeEventListener('change', updateMotion);
      source.removeEventListener('snapshot', onSnapshot);
      source.close();
      window.clearInterval(freshness);
    };
  }, []);

  return { snapshot, status, reducedMotion };
}
