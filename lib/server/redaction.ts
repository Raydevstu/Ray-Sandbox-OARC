// Hub-side L3 redaction — defense in depth on the server for every intake
// route (import / hermes-push / codex-event). Mirrors the client core rule set
// (plugins/ray-memory/core.mjs, L2 content scan + L1 secret-path scan) so a
// misbehaving client cannot launder secrets past the hub. Shared corpus fixture:
// tests/runtime/fixtures/redaction-corpus.ts is imported by both the client
// (Task 4) and hub (Task 9) suites so the rule sets cannot drift.

export interface RedactTextResult {
  text: string;
  skipped: number;
}

// L2 content scan: line-level secret detection. A line that matches any rule
// is dropped entirely (never partially rewritten) so no partial secret remains.
const SECRET_LINE_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'github-token', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: 'llm-api-key', re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/ },
  { name: 'llm-api-key', re: /\bsk-(?:proj|svcacct|svc)-[A-Za-z0-9_-]{16,}\b/ },
  { name: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: 'private-key', re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { name: 'url-credentials', re: /\/\/[^/\s:@]+:[^/\s@]+@/ },
  { name: 'secret-assign', re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|credential)\b\s*[:=]\s*\S/i },
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/i },
];

// Shannon entropy of a string over its own symbol distribution (bits/char).
function shannon(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let e = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    e -= p * Math.log2(p);
  }
  return e;
}

// High-entropy token rule: a >=32-char run of letters/digits whose symbol
// entropy exceeds 4.2 bits. Hex (16-symbol alphabet) can never exceed 4.0, so
// longer hex runs stay clean (mirrors client boundary: hex git SHAs stay clean).
function looksLikeHighEntropyToken(line: string): boolean {
  const runs = line.match(/[A-Za-z0-9]{32,}/g) ?? [];
  return runs.some((r) => shannon(r) > 4.2);
}

export function isSecretLine(line: string): boolean {
  return SECRET_LINE_RULES.some(({ re }) => re.test(line)) || looksLikeHighEntropyToken(line);
}

export function redactText(text: string): RedactTextResult {
  const lines = String(text).split('\n');
  let skipped = 0;
  const kept: string[] = [];
  for (const line of lines) {
    if (isSecretLine(line)) {
      skipped++;
      continue;
    }
    kept.push(line);
  }
  return { text: kept.join('\n'), skipped };
}

// L1 path scan: a file path that may hold secrets is never read into memory.
export function isSecretPath(p: string): boolean {
  const n = String(p ?? '').replace(/\\/g, '/').toLowerCase();
  const base = n.slice(n.lastIndexOf('/') + 1);
  if (/(^|\/)\.env($|\.)/.test(n)) return true;
  if (/\.(pem|p12|pfx|keystore)$/.test(base)) return true;
  if (/(^|\/)id_(rsa|ed25519|ecdsa)($|\.)/.test(n)) return true;
  if (/(^|\/)\.ssh($|\/)/.test(n)) return true;
  if (/(^|\/)\.aws($|\/)/.test(n)) return true;
  if (/\.git-credentials$/.test(base)) return true;
  if (/\.npmrc$/.test(base)) return true;
  if (/(^|\/)credentials\.json$/.test(base)) return true;
  return false;
}

// Deep redaction over JSON-like payloads: strings are line-scanned, secret
// lines dropped (counted), benign strings byte-identical. Non-string leaves
// pass through untouched.
function redactDeep(value: unknown, counter: { skipped: number }): unknown {
  if (typeof value === 'string') {
    const { text, skipped: n } = redactText(value);
    counter.skipped += n;
    return n > 0 ? text : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, counter));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = redactDeep(item, counter);
    return out;
  }
  return value;
}

/**
 * Redact an incoming intake payload (import envelope / push body / codex event)
 * before hashing, dedup, or persistence. Returns the redacted payload plus the
 * number of secret lines dropped.
 */
export function redactIncoming(payload: unknown): { payload: unknown; skipped: number } {
  const counter = { skipped: 0 };
  const redacted = redactDeep(payload, counter);
  return { payload: redacted, skipped: counter.skipped };
}
