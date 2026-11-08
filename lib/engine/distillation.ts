import { buildInvestigation, type Investigation } from "./investigations";

export interface DistilledFact {
  entity: string;
  category: "architecture" | "workflow" | "dependency" | "risk" | "failure" | "solution" | "decision" | "implementation" | "progress" | "success" | "goal";
  content: string;
  confidence: number;
  importance: number;
  occurrences: number;
}

function entityFromFiles(files: string[]): string {
  const counts = new Map<string, number>();
  for (const f of files) {
    const base = f.split("/").pop() ?? f;
    const name = base.replace(/\.(ts|tsx|js|jsx)$/i, "");
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = "general";
  let bestN = 0;
  for (const [k, v] of counts) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

function categoryFor(task: string, hasResolution: boolean): DistilledFact["category"] {
  if (hasResolution) return "solution";
  if (/\b(fail|error|bug|timeout|logout|crash|race|expired)\b/i.test(task)) return "failure";
  return "workflow";
}

function localImportance(entity: string, content: string, confidence: number, occurrences: number): number {
  const arch = Math.min(40, entity.length > 4 ? 22 + Math.min(18, entity.length) : 10);
  const dep = Math.min(25, occurrences * 8);
  const freq = Math.min(20, occurrences * 6);
  const conf = Math.round(confidence * 10);
  const total = arch + dep + freq + 8 + conf;
  if (!content || !content.trim()) return 5;
  return Math.max(0, Math.min(100, Math.round(total)));
}

export function extractFacts(inv: Investigation): DistilledFact[] {
  const entity = entityFromFiles(inv.filesTouched);
  const hasResolution = Boolean(inv.resolution);
  const category = categoryFor(inv.task, hasResolution);
  const parts = [inv.task.trim(), inv.filesTouched.length > 0 ? `files: ${inv.filesTouched.join(", ")}` : ""];
  if (inv.resolution) parts.push(`resolution: ${inv.resolution}`);
  if (inv.findings.length > 0) parts.push(`findings: ${inv.findings.join("; ")}`);
  const content = parts.filter(Boolean).join(" — ");
  const confidence = hasResolution ? 0.8 : 0.55;
  return [
    {
      entity,
      category,
      content,
      confidence,
      importance: localImportance(entity, content, confidence, 1),
      occurrences: 1,
    },
  ];
}

export function distillSession(input: {
  task: string;
  events: SessionEvent[];
  findings?: string[];
  resolution?: string;
}): DistilledFact[] {
  const inv = buildInvestigation(input);
  return extractFacts(inv);
}

import type { SessionEvent } from "./investigations";
export type { Investigation };
