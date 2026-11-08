export type JobKind = "workflow" | "replay" | "evaluate" | "trace" | "import";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface Job {
  id: string;
  tenantId: string;
  bankId: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const mem: Job[] = [];

function uid(): string {
  return `job-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function enqueue(tenantId: string, bankId: string, kind: JobKind, payload: Record<string, unknown>): Job {
  const job: Job = {
    id: uid(), tenantId, bankId, kind, payload,
    status: "queued", attempts: 0, createdAt: Date.now(), updatedAt: Date.now(),
  };
  mem.push(job);
  return job;
}

export function statusOf(id: string): Job | undefined {
  return mem.find((j) => j.id === id);
}

export function pendingJobs(): Job[] {
  return mem.filter((j) => j.status === "queued");
}

export async function drain(
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>,
  run: (kind: JobKind, payload: Record<string, unknown>) => Promise<unknown>
): Promise<Job[]> {
  const done: Job[] = [];
  void query;
  for (const job of mem.filter((j) => j.status === "queued")) {
    job.status = "running";
    job.attempts++;
    job.updatedAt = Date.now();
    try {
      job.result = await run(job.kind, job.payload);
      job.status = "done";
    } catch (e) {
      job.status = "failed";
      job.error = e instanceof Error ? e.message : String(e);
    }
    job.updatedAt = Date.now();
    done.push(job);
  }
  return done;
}

export function resetQueue(): void {
  mem.length = 0;
}
