import type { ExtractionCandidate } from './memory-extraction';
import type { MemoryPolicy } from './memory-policy';
import { ProjectMemoryRecordSchema } from './schemas';

export const proposalDispositions = ['allow', 'deny', 'redact', 'require_review', 'defer'] as const;
export type ProposalDisposition = typeof proposalDispositions[number];
export type ProposalDispositionInput = Readonly<{ timedOut?: boolean; budgetExceeded?: boolean; ambiguous?: boolean }>;
export type ProposalDispositionResult = Readonly<{ disposition: ProposalDisposition; reason: string }>;

const sensitive = /(bearer\s+\S+|api[_-]?key\s*[:=]|\b\d{3}-\d{2}-\d{4}\b)/i;

export const routeProposalForApproval = (candidate: unknown, policy: MemoryPolicy, input: ProposalDispositionInput = {}): ProposalDispositionResult => {
  if (input.timedOut || input.budgetExceeded) return { disposition: 'defer', reason: input.timedOut ? 'provider timed out' : 'provider cost budget exceeded' };
  const parsed = ProjectMemoryRecordSchema.safeParse((candidate as ExtractionCandidate | undefined)?.record);
  if (!parsed.success) return { disposition: 'deny', reason: 'proposal does not satisfy the canonical record schema' };
  const record = parsed.data;
  if (sensitive.test(record.content)) return { disposition: 'redact', reason: 'proposal contains sensitive-looking content' };
  if (input.ambiguous || record.relatedRecords.length > 0) return { disposition: 'require_review', reason: 'proposal has ambiguous entity or relationship evidence' };
  if (record.confidence < policy.minimumConfidence || policy.approvalRequiredFor.includes(record.type) || policy.approvalRequiredFor.includes(record.importance)) return { disposition: 'require_review', reason: 'policy requires human approval' };
  if (!policy.connectorAllowlist.includes(record.source.platform)) return { disposition: 'deny', reason: 'proposal source is not allowed by policy' };
  return { disposition: 'allow', reason: 'proposal is schema-valid, provenance-linked, and policy-allowed' };
};
