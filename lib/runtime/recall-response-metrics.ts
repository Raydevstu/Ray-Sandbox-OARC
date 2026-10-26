export type RecallResponseMetrics = Readonly<{ facts: number; evidence: number; bytes: number }>;

export const measureRecallResponse = (result: { facts: readonly { evidenceIds?: readonly string[] }[] }): RecallResponseMetrics => {
  const facts = result.facts.length;
  const evidence = result.facts.reduce((total, fact) => total + (fact.evidenceIds?.length ?? 0), 0);
  const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  return { facts, evidence, bytes };
};
