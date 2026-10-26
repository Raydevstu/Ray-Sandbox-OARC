const SECRET_KEY = /(token|secret|password|api[-_]?key|authorization|credential)/i;
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED_SECRET]' : redactSecrets(item)]));
  return value;
}
