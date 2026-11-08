export interface SessionEvent {
  type: string;
  file?: string;
  timestamp: number;
  content?: string;
}

export interface Investigation {
  id: string;
  task: string;
  filesTouched: string[];
  tests: string[];
  findings: string[];
  resolution?: string;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const TEST_RE = /\.(spec|test)\.(ts|tsx|js|jsx)$|__tests__/i;

export function buildInvestigation(input: {
  task: string;
  events: SessionEvent[];
  findings?: string[];
  resolution?: string;
}): Investigation {
  const files = new Set<string>();
  const tests = new Set<string>();
  for (const e of input.events) {
    if (!e.file) continue;
    if (e.type === "TEST_RUN" || TEST_RE.test(e.file)) tests.add(e.file);
    else files.add(e.file);
    if (e.type === "FILE_MODIFIED" || e.type === "FILE_VIEWED") files.add(e.file);
  }
  // TEST_RUN file should appear in both when it is a test file
  for (const e of input.events) {
    if (e.type === "TEST_RUN" && e.file) tests.add(e.file);
  }
  return {
    id: uid("inv"),
    task: input.task,
    filesTouched: [...files],
    tests: [...tests],
    findings: [...(input.findings ?? [])],
    ...(input.resolution ? { resolution: input.resolution } : {}),
  };
}
