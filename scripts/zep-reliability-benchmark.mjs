import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createZepAdapter } from '../lib/runtime/zep-adapter.ts';
import { createZepReliabilityReport } from '../lib/runtime/zep-reliability-report.ts';

const apiKey = process.env.ZEP_API_KEY?.trim();
if (!apiKey) throw new Error('ZEP_API_KEY is required');

const outputPath = path.resolve(process.env.ZEP_RELIABILITY_REPORT ?? 'docs/benchmarks/zep-reliability-benchmark.json');
const generatedAt = new Date().toISOString();
const runId = `zep-reliability-${Date.now()}`;
const sourceMessage = { name: 'benchmark-source', role: 'user', content: 'Synthetic benchmark fact: the deployment window is Friday at 09:00 UTC.', referenceTime: generatedAt };
const queryMessage = { name: 'benchmark-query', role: 'user', content: 'When is the deployment window?', referenceTime: generatedAt };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const users = [];
const cleanup = [];
const adapter = createZepAdapter({ apiKey, timeoutMs: 5_000, retryDelayMs: 0 });

const createIsolatedThread = async (suffix) => {
  const user = await adapter.createUser(`${runId}-${suffix}`);
  users.push(user.uuid);
  const thread = await adapter.createThread(user.uuid);
  return { userUuid: user.uuid, threadUuid: thread.uuid };
};

let duplicate = { status: 'failed', acceptedWrites: 0, contextChars: 0 };
let retry = { status: 'failed', attempts: 0 };
let timeout = { status: 'failed', timeoutMs: 25 };
let concurrency = { status: 'failed', requested: 5, completed: 0 };

try {
  const duplicateThread = await createIsolatedThread('duplicate');
  await adapter.addMessages(duplicateThread.threadUuid, [sourceMessage]);
  duplicate.acceptedWrites += 1;
  await adapter.addMessages(duplicateThread.threadUuid, [sourceMessage]);
  duplicate.acceptedWrites += 1;
  await wait(1_000);
  const duplicateContext = await adapter.addMessages(duplicateThread.threadUuid, [queryMessage], true);
  duplicate = { status: 'observed', acceptedWrites: duplicate.acceptedWrites, contextChars: typeof duplicateContext.context === 'string' ? duplicateContext.context.length : 0 };

  let retryAttempts = 0;
  const retryAdapter = createZepAdapter({
    apiKey,
    retryDelayMs: 0,
    fetchImpl: async (input, init) => {
      retryAttempts += 1;
      if (retryAttempts === 1) throw new TypeError('synthetic transient transport failure');
      return fetch(input, init);
    },
  });
  await retryAdapter.getContext(duplicateThread.threadUuid);
  retry = { status: retryAttempts === 2 ? 'passed' : 'failed', attempts: retryAttempts };

  const timeoutAdapter = createZepAdapter({
    apiKey,
    timeoutMs: timeout.timeoutMs,
    fetchImpl: (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
  });
  await timeoutAdapter.getUser('synthetic-timeout').then(
    () => undefined,
    (error) => { timeout = { status: error instanceof Error && error.message === `Zep request timed out after ${timeout.timeoutMs}ms` ? 'passed' : 'failed', timeoutMs: timeout.timeoutMs }; },
  );

  const concurrentResults = await Promise.allSettled(Array.from({ length: concurrency.requested }, async (_, index) => {
    const isolated = await createIsolatedThread(`concurrent-${index}`);
    await adapter.addMessages(isolated.threadUuid, [sourceMessage]);
    await wait(1_000);
    const response = await adapter.addMessages(isolated.threadUuid, [queryMessage], true);
    return typeof response.context === 'string' && response.context.length > 0;
  }));
  const completed = concurrentResults.filter((result) => result.status === 'fulfilled' && result.value).length;
  concurrency = { status: completed === concurrency.requested ? 'passed' : 'failed', requested: concurrency.requested, completed };
} finally {
  for (const userUuid of users) {
    const requested = await adapter.deleteUser(userUuid).then(() => true).catch(() => false);
    await wait(500);
    const deleted = await adapter.getUser(userUuid).then(() => false).catch((error) => error instanceof Error && error.message.includes('404'));
    cleanup.push({ requested, deleted });
  }
}

const recovery = {
  status: cleanup.length === users.length && cleanup.every((item) => item.requested && item.deleted) ? 'passed' : 'failed',
  deletedUsers: cleanup.filter((item) => item.requested).length,
  verifiedDeletedUsers: cleanup.filter((item) => item.deleted).length,
};
const report = createZepReliabilityReport({ generatedAt, duplicate, retry, timeout, concurrency, recovery });
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, probes: report.probes, metrics: report.metrics, evidence: report.evidence }, null, 2));
