import type { MemoryScope } from '../contracts';
export type Checkpoint = MemoryScope & Readonly<{ consumer: string; eventId: string; updatedAt: string }>;
export const advanceCheckpoint = (current: Checkpoint | undefined, next: Checkpoint): Checkpoint => { if (current && current.eventId === next.eventId) return current; return { ...next }; };
