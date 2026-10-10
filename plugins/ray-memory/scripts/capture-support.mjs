import crypto from 'node:crypto';

const MAX_TRANSCRIPT_MESSAGES = 32;
const MAX_MESSAGE_CHARS = 12000;
const TRANSCRIPT_PATH_KEY = /^transcript[_-]?path$/i;
const SECRET_KEY = /token|secret|password|authorization|api[-_]?key/i;
const SECRET_VALUE = /((?:bearer\s+)?(?:token|secret|password|authorization|api[-_]?key)\s*[:=]\s*)([^\s,;]+)/gi;

const asString = (value) => typeof value === 'string' && value.trim() ? value : undefined;

export const stableHash = (...parts) => crypto.createHash('sha256').update(parts.map((part) => String(part ?? '')).join('\u001f')).digest('hex');

export const redactString = (value) => value.replace(SECRET_VALUE, '$1[REDACTED_SECRET]');

export const redactValue = (value) => {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    if (TRANSCRIPT_PATH_KEY.test(key)) return [];
    if (SECRET_KEY.test(key)) return [[key, '[REDACTED_SECRET]']];
    return [[key, redactValue(entry)]];
  }));
};

const contentOf = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const parts = value.map((part) => contentOf(part)).filter(Boolean);
    return parts.length ? parts.join('\n') : undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value;
  return asString(record.text) ?? asString(record.content) ?? contentOf(record.message);
};

const roleOf = (value) => ['user', 'assistant', 'tool', 'system'].includes(value) ? value : undefined;

const transcriptMessage = (line, index) => {
  if (!line || typeof line !== 'object' || Array.isArray(line)) return undefined;
  const record = line;
  const nested = record.message && typeof record.message === 'object' && !Array.isArray(record.message) ? record.message : undefined;
  const role = roleOf(record.role) ?? roleOf(record.author) ?? roleOf(record.sender) ?? roleOf(nested?.role) ?? roleOf(nested?.author) ?? roleOf(nested?.sender);
  const content = contentOf(record.content) ?? contentOf(record.text) ?? contentOf(nested?.content) ?? contentOf(nested?.text);
  if (!role || !content?.trim()) return undefined;
  const timestamp = asString(record.timestamp) ?? asString(record.createdAt) ?? asString(nested?.timestamp) ?? asString(nested?.createdAt);
  const sourceId = asString(record.id) ?? asString(record.message_id) ?? asString(record.messageId) ?? asString(record.uuid) ?? asString(nested?.id) ?? asString(nested?.uuid);
  return { id: sourceId, role, content: redactString(content).slice(0, MAX_MESSAGE_CHARS), timestamp, line: index };
};

export const parseTranscriptJsonl = (raw, options = {}) => {
  const maxMessages = Math.max(1, Math.min(MAX_TRANSCRIPT_MESSAGES, options.maxMessages ?? MAX_TRANSCRIPT_MESSAGES));
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const messages = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const message = transcriptMessage(JSON.parse(line), index);
      if (message) messages.push(message);
    } catch {
      // A single malformed transcript line must not discard the usable context.
    }
  }
  return messages.slice(-maxMessages);
};

const firstString = (...values) => values.map(asString).find(Boolean);

export const deriveProjectIdentity = (input, repositoryRoot) => {
  const repository = input?.repository && typeof input.repository === 'object' ? input.repository : {};
  const git = input?.git && typeof input.git === 'object' ? input.git : {};
  const root = firstString(repositoryRoot, input?.project_root, input?.projectRoot, input?.repository_root, input?.repo_root, repository.root, repository.path, input?.workspace_root, input?.workspaceRoot, input?.workspace?.root, input?.workspace?.path, input?.cwd);
  const normalizedRoot = root ? root.replace(/[\\/]+$/, '') : undefined;
  const explicitProjectId = firstString(input?.project_id, input?.projectId);
  const explicitWorkspaceId = firstString(input?.workspace_id, input?.workspaceId);
  const remote = firstString(input?.repository_remote, input?.repositoryRemote, repository.remote, repository.url, git.remote);
  const projectId = explicitProjectId ?? `codex-${stableHash(remote ? `remote:${remote}` : `root:${normalizedRoot ?? 'unknown'}`).slice(0, 24)}`;
  const workspaceId = explicitWorkspaceId ?? `workspace-${stableHash(normalizedRoot ?? projectId).slice(0, 24)}`;
  return { projectId, workspaceId, workspacePath: normalizedRoot };
};

const messageKey = (message) => `${message.role}\u0000${message.content}`;

export const buildCaptureEnvelope = (input, { repositoryRoot, transcriptRaw = '' } = {}) => {
  const eventName = firstString(input?.hook_event_name, input?.event) ?? 'codex-hook';
  const identity = deriveProjectIdentity(input, repositoryRoot);
  const directPrompt = asString(input?.prompt);
  const directAssistant = asString(input?.last_assistant_message);
  const conversationId = firstString(input?.session_id, input?.conversation_id, input?.thread_id) ?? `codex-transcript-${stableHash(input?.transcript_path ?? identity.projectId).slice(0, 24)}`;
  const timestamp = firstString(input?.timestamp, input?.created_at) ?? '1970-01-01T00:00:00.000Z';
  const explicitPromptId = firstString(input?.prompt_id, input?.message_id);
  const explicitAssistantId = firstString(input?.response_id, input?.assistant_message_id, input?.stop_id);
  const direct = [
    directPrompt ? { id: explicitPromptId ?? `hook-${stableHash(conversationId, eventName, 'user', directPrompt, timestamp)}`, role: 'user', content: redactString(directPrompt) } : undefined,
    directAssistant ? { id: explicitAssistantId ?? `hook-${stableHash(conversationId, eventName, 'assistant', directAssistant, timestamp)}`, role: 'assistant', content: redactString(directAssistant) } : undefined,
  ].filter(Boolean);
  const transcript = parseTranscriptJsonl(transcriptRaw).map((message) => ({
    id: message.id ? `transcript-${stableHash(conversationId, message.id).slice(0, 24)}` : `transcript-${stableHash(conversationId, message.line, message.role, message.content).slice(0, 24)}`,
    role: message.role,
    content: message.content,
    ...(message.timestamp ? { timestamp: message.timestamp } : {}),
  }));
  const messages = [];
  const seen = new Set();
  const directContent = new Set(direct.map((message) => messageKey(message)));
  for (const message of [...direct, ...transcript]) {
    const key = messageKey(message);
    if (transcript.includes(message) && directContent.has(key)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      messages.push(message);
    }
  }
  if (!messages.length) messages.push({ id: `hook-${stableHash(conversationId, eventName, timestamp)}`, role: 'system', content: JSON.stringify({ hookEvent: eventName }) });
  return {
    ...identity,
    platform: 'codex',
    conversationId,
    exportedAt: timestamp,
    sourceReference: `codex-hook:${eventName}:${stableHash(conversationId, eventName, messages.map((message) => message.id).join(','))}`,
    messages: messages.map((message) => redactValue(message)),
  };
};
