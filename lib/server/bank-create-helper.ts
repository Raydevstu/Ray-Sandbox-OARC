export interface ParsedBankBody {
  name: string;
  watchPath: string;
}

export function parseBankBody(body: any): ParsedBankBody {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new Error("bank name is required");
  return { name, watchPath: String(body?.watchPath ?? "").trim() };
}
