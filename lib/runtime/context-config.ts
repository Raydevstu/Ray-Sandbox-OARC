import { z } from 'zod';

const Settings = z.object({
  budget: z.enum(['low', 'mid', 'high']),
  budgetMode: z.enum(['fixed', 'adaptive']),
  maxTokens: z.number().int().positive(),
  rerankerCap: z.number().int().positive(),
  rerankEnabled: z.boolean(),
}).passthrough();

export function parseContextConfigInput(input: unknown) {
  const parsed = z.object({ configId: z.string().min(1), version: z.number().int().positive(), settings: Settings }).safeParse(input);
  if (!parsed.success) throw new Error('invalid context settings');
  return parsed.data;
}
