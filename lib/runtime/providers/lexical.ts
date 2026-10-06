import type { MemoryFactRevision, MemoryScope } from '../contracts';
import type { CanonicalRepository } from '../repositories/interfaces';

export type LexicalSearchRequest = MemoryScope & Readonly<{ query: string; limit: number }>;
export type RankedCandidate = Readonly<{ fact: MemoryFactRevision; score: number; matchedTerms: readonly string[] }>;
const terms = (text: string) => [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1))];
export class LexicalProvider {
  constructor(private readonly repository: CanonicalRepository) {}
  async search(request: LexicalSearchRequest): Promise<readonly RankedCandidate[]> {
    const queryTerms = terms(request.query);
    const facts = await this.repository.findFacts(request);
    return facts.map((fact) => { const matchedTerms = queryTerms.filter((term) => fact.claim.toLowerCase().includes(term)); return { fact, matchedTerms, score: matchedTerms.length / Math.max(1, queryTerms.length) }; }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || b.fact.revision - a.fact.revision).slice(0, request.limit);
  }
}
