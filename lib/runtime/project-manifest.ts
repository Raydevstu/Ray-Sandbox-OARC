import type { ProjectMemoryProjection } from './project-memory';
import type { ProjectMemoryRecord } from './contracts';

export type ProjectManifest = Readonly<{
  projectId: string;
  generatedAt: string;
  records: readonly ProjectMemoryRecord[];
  sections: Readonly<Record<string, readonly ProjectMemoryRecord[]>>;
}>;

const sectionFor = (record: ProjectMemoryRecord): string => {
  if (record.status === 'blocked') return 'blocked';
  if (record.status === 'pending') return 'pending';
  if (record.status === 'stale') return 'stale';
  if (record.status === 'conflict') return 'conflicting';
  if (record.status === 'verified') return 'verified';
  return 'active';
};

export const generateProjectManifest = (projectId: string, projection: ProjectMemoryProjection, generatedAt: string): ProjectManifest => {
  const records = Object.values(projection.records).filter((record) => record.projectId === projectId).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
  const sections: Record<string, ProjectMemoryRecord[]> = {};
  for (const record of records) (sections[sectionFor(record)] ??= []).push(record);
  return { projectId, generatedAt, records, sections };
};

export const renderProjectManifestMarkdown = (manifest: ProjectManifest): string => {
  const sectionOrder = ['active', 'verified', 'pending', 'blocked', 'stale', 'conflicting'];
  const lines = [`# Project Memory Manifest`, ``, `Project: ${manifest.projectId}`, `Generated: ${manifest.generatedAt}`, ``];
  for (const section of sectionOrder) {
    const records = manifest.sections[section] ?? [];
    lines.push(`## ${section[0].toUpperCase()}${section.slice(1)}`, ``);
    if (!records.length) lines.push('_None_', ``);
    else for (const record of records) lines.push(`- **${record.title}** (${record.type}, confidence ${record.confidence}): ${record.content}`);
  }
  return lines.join('\n');
};
