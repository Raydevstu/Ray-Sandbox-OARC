import { countTokens } from "@/lib/utils";

export const MEMORY_CONTEXT_OPEN = "<memory-context>";
export const MEMORY_CONTEXT_CLOSE = "</memory-context>";

export interface CaptureDiagnostics {
  strippedRecallBlocks: number;
  strippedTokens: number;
  retainedInputTokens: number;
}

export function wrapMemoryContext(text: string): string {
  const clean = text.trim();
  return clean ? `${MEMORY_CONTEXT_OPEN}\n${clean}\n${MEMORY_CONTEXT_CLOSE}` : "";
}

export function stripMemoryContext(text: string): { text: string; diagnostics: CaptureDiagnostics } {
  let strippedRecallBlocks = 0;
  let strippedTokens = 0;
  const clean = text.replace(/<memory-context>[^]*?<\/memory-context>/gi, (block) => {
    strippedRecallBlocks += 1;
    strippedTokens += countTokens(block);
    return "";
  }).trim();
  return { text: clean, diagnostics: { strippedRecallBlocks, strippedTokens, retainedInputTokens: countTokens(clean) } };
}
