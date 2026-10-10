import type { ImportPlatform } from './cross-platform-import';

export type ConnectorCapability = Readonly<{ platform: ImportPlatform; mode: 'live' | 'storage-only'; contract: '/api/project-memory/import'; status: 'available' | 'capture-gap' }>;

export const CONNECTOR_CATALOG: readonly ConnectorCapability[] = [
  { platform: 'codex', mode: 'live', contract: '/api/project-memory/import', status: 'available' },
  { platform: 'openai-api', mode: 'storage-only', contract: '/api/project-memory/import', status: 'available' },
  { platform: 'opencode', mode: 'storage-only', contract: '/api/project-memory/import', status: 'available' },
  { platform: 'vscode', mode: 'storage-only', contract: '/api/project-memory/import', status: 'available' },
  { platform: 'hermes', mode: 'storage-only', contract: '/api/project-memory/import', status: 'capture-gap' },
];
