type HindsightFetch = (input: string, init?: RequestInit) => Promise<Response>;
type HindsightClientOptions = Readonly<{ apiKey: string; baseUrl?: string; fetchImpl?: HindsightFetch }>;

const json = async (response: Response): Promise<Record<string, unknown>> => {
  if (!response.ok) throw new Error(`Hindsight request failed: ${response.status}`);
  return await response.json() as Record<string, unknown>;
};

export const createHindsightAdapter = (options: HindsightClientOptions) => {
  const baseUrl = (options.baseUrl ?? 'https://api.hindsight.vectorize.io').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = async (path: string, init: RequestInit = {}) => json(await fetchImpl(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  }));
  const bankPath = (bankId: string) => `/v1/default/banks/${encodeURIComponent(bankId)}`;

  return {
    async retain(bankId: string, content: string, timestamp?: string) {
      return request(`${bankPath(bankId)}/memories`, {
        method: 'POST',
        body: JSON.stringify({ items: [{ content, ...(timestamp ? { timestamp } : {}) }] }),
      });
    },
    async recall(bankId: string, query: string, queryTimestamp?: string) {
      const response = await request(`${bankPath(bankId)}/memories/recall`, {
        method: 'POST',
        body: JSON.stringify({ query, ...(queryTimestamp ? { query_timestamp: queryTimestamp } : {}) }),
      });
      const results = Array.isArray(response.results) ? response.results : [];
      return { texts: results.flatMap((result) => typeof result === 'object' && result && typeof (result as Record<string, unknown>).text === 'string' ? [(result as Record<string, string>).text] : []) };
    },
    async deleteBank(bankId: string) {
      return request(bankPath(bankId), { method: 'DELETE' });
    },
    async bankExists(bankId: string) {
      const response = await request(`/v1/default/banks?q=${encodeURIComponent(bankId)}`);
      const banks = Array.isArray(response.banks) ? response.banks : [];
      return banks.some((bank) => typeof bank === 'object' && bank && (bank as Record<string, unknown>).bank_id === bankId);
    },
  };
};
