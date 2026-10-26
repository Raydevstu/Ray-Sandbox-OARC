export class RuntimeConfigError extends Error {
  readonly name = 'RuntimeConfigError';
  constructor(message: string) { super(message); }
}

export class ScopeError extends Error {
  readonly name = 'ScopeError';
  constructor(message = 'tenantId and bankId are required') { super(message); }
}
