import type { MemoryFactRevision, RetrievalResponse, RetrievalRequest } from '../contracts';
import type { CanonicalRepository } from '../repositories/interfaces';
import { LexicalProvider, type RankedCandidate } from '../providers/lexical';

export type RetrievalPolicy = 'current' | 'historical' | 'all-evidence';
export type RuntimeRetrievalRequest = RetrievalRequest & Readonly<{ policy?: RetrievalPolicy; tokenBudget?: number }>;
export type PackedContext = Readonly<{ facts: readonly MemoryFactRevision[]; tokens: number; excluded: readonly string[] }>;
const tokenCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const applyPolicy = (candidates: readonly RankedCandidate[], policy: RetrievalPolicy): readonly RankedCandidate[] => policy === 'historical' || policy === 'all-evidence' ? candidates : candidates.filter((candidate, index, all) => all.findIndex((other) => other.fact.claim.toLowerCase() === candidate.fact.claim.toLowerCase()) === index);
export const packContext = (candidates: readonly RankedCandidate[], budget: number): PackedContext => { let tokens = 0; const facts: MemoryFactRevision[] = []; const excluded: string[] = []; for (const candidate of candidates) { const next = tokenCount(candidate.fact.claim); if (tokens + next <= budget) { facts.push(candidate.fact); tokens += next; } else excluded.push(candidate.fact.id); } return { facts, tokens, excluded }; };
export const recallMemory = async (request: RuntimeRetrievalRequest, repository: CanonicalRepository): Promise<RetrievalResponse & Readonly<{ policy: RetrievalPolicy; packed: PackedContext }>> => { const policy = request.policy ?? 'current'; const provider = new LexicalProvider(repository); const candidates = applyPolicy(await provider.search({ ...request, limit: request.limit ?? 20 }), policy); const packed = packContext(candidates, request.tokenBudget ?? 1000); return { facts: packed.facts, traceId: `trace-${Date.now()}`, policy, packed }; };
