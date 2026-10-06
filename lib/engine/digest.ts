import { countTokens } from "@/lib/utils";

export interface DigestCandidate {
  fact: { id: string; text: string };
  finalScore: number;
  tokens: number;
}

export interface DigestBullet {
  text: string;
  factIds: string[];
  confidence: number;
}

export interface RecallDigest {
  mode: "deterministic";
  bullets: DigestBullet[];
  suppressed: boolean;
  reason?: string;
  inputTokens: number;
  outputTokens: number;
}

export function buildRecallDigest(_query: string, candidates: DigestCandidate[], maxBullets = 8): RecallDigest {
  const relevant = candidates.filter((candidate) => candidate.finalScore >= 0.15);
  if (!relevant.length) {
    return { mode: "deterministic", bullets: [], suppressed: true, reason: "no-relevant-memory", inputTokens: candidates.reduce((sum, c) => sum + c.tokens, 0), outputTokens: 0 };
  }

  const groups = new Map<string, DigestBullet>();
  for (const candidate of relevant) {
    const text = candidate.fact.text.trim();
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const existing = groups.get(key);
    if (existing) {
      existing.factIds = [...existing.factIds, candidate.fact.id];
      existing.confidence = Math.max(existing.confidence, candidate.finalScore);
      continue;
    }
    groups.set(key, { text, factIds: [candidate.fact.id], confidence: Math.min(1, candidate.finalScore) });
  }

  const bullets = [...groups.values()].sort((a, b) => b.confidence - a.confidence).slice(0, maxBullets);
  return {
    mode: "deterministic",
    bullets,
    suppressed: false,
    inputTokens: relevant.reduce((sum, c) => sum + c.tokens, 0),
    outputTokens: bullets.reduce((sum, bullet) => sum + countTokens(bullet.text), 0),
  };
}
