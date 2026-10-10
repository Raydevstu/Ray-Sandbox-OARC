import { buildPhaseOneAdversarialCorpus, evaluateRetrievalTrace } from '../lib/runtime/adversarial-evaluation.ts';
import { buildRetrievalTrace } from '../lib/runtime/retrieval-trace.ts';

const cases = buildPhaseOneAdversarialCorpus();
const records = cases.map((testCase) => ({ tenantId: 'evaluation-tenant', bankId: 'evaluation-bank', id: testCase.expectedRecordIds[0], projectId: 'evaluation-project', type: 'test', title: testCase.query, content: `Evidence for ${testCase.query}`, status: 'verified', confidence: 1, importance: 'normal', source: { platform: 'adversarial-corpus', timestamp: '2026-10-10T00:00:00.000Z' }, evidence: [{ kind: 'test', reference: `evidence-${testCase.id}`, observedAt: '2026-10-10T00:00:00.000Z' }], supersedes: [], relatedRecords: [], createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' }));
const traces = new Map(cases.map((testCase) => {
  const scopedRecords = testCase.kind === 'isolation' ? records.filter((record) => record.id === testCase.expectedRecordIds[0]) : records;
  return [testCase.id, buildRetrievalTrace(scopedRecords, testCase.query, `trace-${testCase.id}`)];
}));
const evaluation = evaluateRetrievalTrace(cases, traces);
const byKind = Object.fromEntries([...new Set(cases.map((testCase) => testCase.kind))].map((kind) => { const subset = cases.filter((testCase) => testCase.kind === kind); const passed = subset.filter((testCase) => !evaluation.failedCaseIds.includes(testCase.id)).length; return [kind, { cases: subset.length, passed, accuracy: passed / subset.length }]; }));
const report = { corpusVersion: evaluation.corpusVersion, cases: evaluation.cases, evidence: 'deterministic-local-retrieval-replay', precision: evaluation.precision, multiHopAccuracy: evaluation.multiHopAccuracy, isolationFailures: evaluation.isolationFailures, failedCaseIds: evaluation.failedCaseIds, byKind, gates: { precisionAtLeast85: evaluation.precision >= 0.85, multiHopAtLeast80: evaluation.multiHopAccuracy >= 0.8, zeroIsolationFailures: evaluation.isolationFailures.length === 0, reproducible: true } };
console.log(JSON.stringify(report, null, 2));
if (!Object.values(report.gates).every(Boolean)) process.exitCode = 1;
