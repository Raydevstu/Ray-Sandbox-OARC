type ProjectionFact = { id: string; text: string; entities: string[]; tags: string[] };
export interface FilesystemProjection { bankId: string; files: { path: string; content: string; sourceFactIds: string[] }[]; manifest: string; }
const safe = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "untitled";

export function buildFilesystemProjection(input: { bankId: string; bankName: string; facts: ProjectionFact[] }): FilesystemProjection {
  const files = input.facts.flatMap((fact) => [
    { path: `memories/${safe(fact.id)}.md`, content: `# ${fact.id}\n\n${fact.text}\n\nTags: ${fact.tags.join(", ") || "none"}\n`, sourceFactIds: [fact.id] },
    ...fact.entities.map((entity) => ({ path: `entities/${safe(entity)}/${safe(fact.id)}.md`, content: `# ${entity}\n\n${fact.text}\n`, sourceFactIds: [fact.id] })),
  ]);
  const manifest = JSON.stringify({ bankId: input.bankId, bankName: input.bankName, files: files.map((file) => ({ path: file.path, sourceFactIds: file.sourceFactIds })) }, null, 2);
  return { bankId: input.bankId, files, manifest };
}
