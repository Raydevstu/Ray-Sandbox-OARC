export type MemoryPolicyScope = Readonly<{ bankId?: string; projectId?: string; userId?: string }>;
export type MemoryPolicy = Readonly<{
  policyId: string;
  version: number;
  scope: MemoryPolicyScope;
  retentionDays: number;
  minimumConfidence: number;
  approvalRequiredFor: readonly string[];
  connectorAllowlist: readonly string[];
  model: Readonly<{ provider: string; model: string; maxCostUsd: number }>;
  explainability: Readonly<{ required: boolean; includeSource: boolean; includeRationale: boolean }>;
  audit: Readonly<{ createdBy: string; changeReason: string }>;
  fingerprint: string;
  updatedAt: string;
}>;

export type MemoryPolicyInput = Omit<MemoryPolicy, 'fingerprint' | 'updatedAt' | 'audit'> & {
  audit?: Partial<MemoryPolicy['audit']>;
  fingerprint?: string;
  updatedAt?: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ (code + index), 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

function policyMaterial(policy: Omit<MemoryPolicy, 'fingerprint' | 'updatedAt'>): string {
  return stable(policy);
}

export function policyFingerprint(policy: MemoryPolicyInput | MemoryPolicy): string {
  const { fingerprint: _fingerprint, updatedAt: _updatedAt, ...material } = policy;
  return hash(policyMaterial(material as Omit<MemoryPolicy, 'fingerprint' | 'updatedAt'>));
}

export function validateMemoryPolicy(policy: MemoryPolicy): MemoryPolicy {
  if (!policy.policyId.trim()) throw new Error('policyId is required');
  if (!Number.isInteger(policy.version) || policy.version < 1) throw new Error('version must be a positive integer');
  if (!Number.isInteger(policy.retentionDays) || policy.retentionDays < 1) throw new Error('retentionDays must be a positive integer');
  if (!Number.isFinite(policy.minimumConfidence) || policy.minimumConfidence < 0 || policy.minimumConfidence > 1) throw new Error('minimumConfidence must be between 0 and 1');
  if (!policy.model.provider.trim() || !policy.model.model.trim() || policy.model.maxCostUsd < 0) throw new Error('model configuration is invalid');
  if (!policy.explainability.required || !policy.explainability.includeSource || !policy.explainability.includeRationale) throw new Error('explainability must include source and rationale');
  if (!policy.audit.createdBy.trim() || !policy.audit.changeReason.trim()) throw new Error('audit createdBy and changeReason are required');
  const fingerprint = policyFingerprint(policy);
  if (policy.fingerprint !== fingerprint) throw new Error('fingerprint does not match policy contents');
  return policy;
}

export function createMemoryPolicy(input: MemoryPolicyInput): MemoryPolicy {
  const audit = { createdBy: input.audit?.createdBy ?? 'system', changeReason: input.audit?.changeReason ?? 'initial policy' };
  if (!audit.changeReason.trim()) throw new Error('changeReason is required');
  const material = { ...input, audit };
  const policy = { ...material, fingerprint: '', updatedAt: input.updatedAt ?? new Date().toISOString() } as MemoryPolicy;
  const complete = { ...policy, fingerprint: policyFingerprint(policy) };
  return validateMemoryPolicy(complete);
}
