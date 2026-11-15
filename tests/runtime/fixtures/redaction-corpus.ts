// Single source of truth for the redaction corpus, shared by the client core
// tests (Task 4) and the hub L3 tests (Task 9) so the rule sets cannot drift.
// Reviewer-reported corpus: 11/11 fake secrets caught, 5/5 benign lines clean.

export const SECRET_LINES = [
  'aws_access_key_id = AKIAIOSFODNN7EXAMPLE',            // aws-access-key
  'ghp_abcdefghijklmnopqrstuvwxyz0123456789',            // github-token (ghp_)
  'github_pat_ABCDEFGHIJKLMNOPQRSTUVWX',                 // github-token (fine-grained)
  'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',             // llm-api-key (anthropic)
  'sk-proj-abcdefghijklmnopqrstuvwxyz0123',               // llm-api-key
  'xoxb-123456789012-abcdef',                            // slack-token
  'AIzaSyD-abcdefghij0123456789ABCDEFGHIJKLM',           // google-api-key
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // jwt
  '-----BEGIN RSA PRIVATE KEY-----',                      // private-key
  'https://user:s3cretpass@registry.example.com',        // url-credentials
  'password: hunter2secretvalue',                         // secret-assign
  'Bearer abcdef1234567890abcdef12',                      // bearer
] as const;

export const BENIGN_LINES = [
  'Fix the login flow so the token refresh happens once.',
  '3f5a1c9d8e2b4a6f0d7c1e9b3a5f7d2c1e9b0a4d', // 40-char hex git SHA
  'const key = "not-a-secret-value";',                    // code line with key in prose
  'See https://example.com/docs/import for details.',      // URL without credentials
  'The API key rotation policy is documented in onboarding.', // prose
] as const;

// 40-char hex SHA must stay clean: hex has ~4.0-4.25 entropy; token rule requires > 4.2.
// The high-entropy rule targets 32+ char mixed alnum tokens like:
export const HIGH_ENTROPY_SECRET = 'Xk9mP2vQ7zR4tW8yU1iO3pA5sD6fG0hJ' as const; // 32 chars, mixed case+digits

export const SECRET_PATHS = [
  '.env', 'server.pem', 'id_rsa', '.ssh/config', '.aws/credentials',
  '.git-credentials', '.npmrc', 'credentials.json', 'src/.env.local',
] as const;

export const BENIGN_PATHS = ['env.ts', 'environment.ts', 'src/keys.md'] as const;
