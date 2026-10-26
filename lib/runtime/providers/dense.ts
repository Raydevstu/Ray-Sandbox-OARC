import type { MemoryFactRevision, MemoryScope } from '../contracts';

export interface EmbeddingProvider { readonly dimension: number; embed(text: string): Promise<readonly number[]>; }
export type DenseSearchRequest = MemoryScope & Readonly<{ query: string; facts: readonly MemoryFactRevision[]; limit: number }>;
export type DenseCandidate = Readonly<{ fact: MemoryFactRevision; score: number }>;
type DenseConfig = Readonly<{ enabled: boolean; dimension: number; embed: EmbeddingProvider }>;

const cosine = (left: readonly number[], right: readonly number[]): number => {
  if (left.length !== right.length || left.length === 0) throw new Error('embedding dimension mismatch');
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const norm = (values: readonly number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  const denominator = norm(left) * norm(right);
  return denominator === 0 ? 0 : dot / denominator;
};

export class DenseProvider {
  constructor(private readonly config: DenseConfig) {}
  async search(request: DenseSearchRequest): Promise<readonly DenseCandidate[]> {
    if (!this.config.enabled) throw new Error('dense retrieval is disabled');
    if (this.config.embed.dimension !== this.config.dimension) throw new Error('embedding dimension mismatch');
    const query = await this.config.embed.embed(request.query);
    if (query.length !== this.config.dimension) throw new Error('embedding dimension mismatch');
    const candidates = await Promise.all(request.facts.map(async (fact) => ({ fact, score: cosine(query, await this.config.embed.embed(fact.claim)) })));
    return candidates.filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id)).slice(0, request.limit);
  }
}
