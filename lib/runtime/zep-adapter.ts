type ZepFetch = (input: string, init?: RequestInit) => Promise<Response>;
type ZepClientOptions = Readonly<{ apiKey: string; baseUrl?: string; fetchImpl?: ZepFetch; timeoutMs?: number; safeReadRetries?: number; retryDelayMs?: number }>;
type ZepMessage = Readonly<{ name: string; role: 'user' | 'assistant' | 'system' | 'function' | 'tool'; content: string; referenceTime?: string }>;

class ZepRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Zep request failed: ${status}`);
    this.status = status;
  }
}

const json = async (response: Response): Promise<Record<string, unknown>> => {
  if (!response.ok) throw new ZepRequestError(response.status);
  return await response.json() as Record<string, unknown>;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createZepAdapter = (options: ZepClientOptions) => {
  const baseUrl = (options.baseUrl ?? 'https://api.getzep.com/api/v4').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const safeReadRetries = options.safeReadRetries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 100;
  const request = async (path: string, init: RequestInit = {}, safeRead = false) => {
    const attempts = safeRead ? safeReadRetries + 1 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        return await json(await fetchImpl(`${baseUrl}${path}`, { ...init, signal: controller.signal, headers: { Authorization: `Api-Key ${options.apiKey}`, 'content-type': 'application/json', ...(init.headers ?? {}) } }));
      } catch (error) {
        if (timedOut) throw new Error(`Zep request timed out after ${timeoutMs}ms`);
        const retryable = safeRead && attempt + 1 < attempts && (!(error instanceof ZepRequestError) || error.status >= 500);
        if (!retryable) {
          if (error instanceof ZepRequestError) throw new Error(error.message);
          throw new Error('Zep request failed: network error');
        }
        if (retryDelayMs > 0) await wait(retryDelayMs);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error('Zep request failed: retry exhausted');
  };
  return {
    async createUser(userId: string) { return request('/users', { method: 'POST', body: JSON.stringify({ user_id: userId }) }); },
    async getUser(userUuid: string) { return request(`/users/${encodeURIComponent(userUuid)}`, {}, true); },
    async createThread(userUuid: string) { return request('/threads', { method: 'POST', body: JSON.stringify({ user_uuid: userUuid }) }); },
    async addMessages(threadId: string, messages: readonly ZepMessage[], returnContext = false) {
      return request(`/threads/${encodeURIComponent(threadId)}/messages`, { method: 'POST', body: JSON.stringify({ messages: messages.map(({ referenceTime, ...message }) => ({ ...message, ...(referenceTime ? { reference_time: referenceTime } : {}) })), return_context: returnContext }) });
    },
    async getContext(threadId: string) { return request(`/threads/${encodeURIComponent(threadId)}/context`, {}, true); },
    async deleteUser(userUuid: string) { return request(`/users/${encodeURIComponent(userUuid)}`, { method: 'DELETE' }); },
    async ingestAndRecall(input: Readonly<{ userId: string; threadId: string; messages: readonly ZepMessage[]; returnContext?: boolean }>) {
      await request(`/users/${encodeURIComponent(input.userId)}`, { method: 'GET' }, true).catch(async (error) => { if (error instanceof Error && error.message.includes('404')) await this.createUser(input.userId); else throw error; });
      const added = await this.addMessages(input.threadId, input.messages, input.returnContext ?? false);
      const context = input.returnContext ? added.context : (await this.getContext(input.threadId)).context;
      return { context: typeof context === 'string' ? context : '', task: added.task };
    },
  };
};
