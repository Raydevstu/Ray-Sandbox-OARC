export type SloEventAttempt = Readonly<{ messageId: string; attempt: number; duplicateOf?: string }>;

export const buildSloEventPlan = (options: Readonly<{ runId: string; uniqueEvents: number; duplicateEvery: number }>): readonly SloEventAttempt[] => {
  if (!options.runId.trim()) throw new Error('runId is required');
  if (!Number.isInteger(options.uniqueEvents) || options.uniqueEvents < 1) throw new Error('uniqueEvents must be positive');
  if (!Number.isInteger(options.duplicateEvery) || options.duplicateEvery < 1) throw new Error('duplicateEvery must be positive');
  return Array.from({ length: options.uniqueEvents }, (_, index) => {
    const messageId = `${options.runId}-event-${index}`;
    const original = { messageId, attempt: 1 };
    return index % options.duplicateEvery === 0 ? [original, { messageId, attempt: 2, duplicateOf: messageId }] : [original];
  }).flat();
};
