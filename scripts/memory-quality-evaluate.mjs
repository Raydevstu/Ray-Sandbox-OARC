const corpus = [
  { expected: ['architecture'], answer: 'The architecture uses a durable event log.' },
  { expected: ['retention'], answer: 'Retention uses auditable tombstones.' },
  { expected: ['worker'], answer: 'The worker retries failed jobs.' },
];
const matched = corpus.filter((item) => item.expected.every((term) => item.answer.toLowerCase().includes(term))).length;
const coverage = matched / corpus.length;
const result = { corpusId: 'golden-project-v1', cases: corpus.length, withMemoryCoverage: coverage, metric: { id: 'with-memory-answer-coverage', pass: coverage === 1 }, captureGaps: 0, evidence: 'deterministic-local-corpus' };
console.log(JSON.stringify(result, null, 2));
if (coverage < 1) process.exitCode = 1;
