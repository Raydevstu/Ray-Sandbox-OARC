import { describe, expect, it } from 'vitest';
import { advanceGallerySnapshot, createGallerySnapshot, filterEvidenceRows, resolveSelectedEvidenceRow, resolveTopologySelection, sortEvidenceRows } from '../../lib/design-gallery';

describe('enterprise visual gallery data', () => {
  it('advances a bounded synthetic snapshot without mutating the prior sample', () => {
    const initial = createGallerySnapshot(42);
    const next = advanceGallerySnapshot(initial);

    expect(next.lastUpdatedAt).toBeGreaterThan(initial.lastUpdatedAt);
    expect(next.timeline).toHaveLength(initial.timeline.length);
    expect(next.timeline).not.toEqual(initial.timeline);
    expect(initial.label).toBe('Synthetic preview data');
  });

  it('returns an explicit empty collection when no evidence rows match a query', () => {
    const snapshot = createGallerySnapshot(42);

    expect(filterEvidenceRows(snapshot.evidenceRows, 'no-such-evidence', 'all')).toEqual([]);
  });

  it('keeps equal-confidence evidence in source order while sorting', () => {
    const snapshot = createGallerySnapshot(42);
    const rows = [
      { ...snapshot.evidenceRows[0], id: 'first', confidence: 0.8 },
      { ...snapshot.evidenceRows[1], id: 'second', confidence: 0.8 },
    ];

    expect(sortEvidenceRows(rows, 'confidence')).toEqual(rows);
  });

  it('clears the selected evidence row when filtering hides it', () => {
    const snapshot = createGallerySnapshot(42);
    const criticalRows = filterEvidenceRows(snapshot.evidenceRows, '', 'critical');

    expect(resolveSelectedEvidenceRow(criticalRows, 'evt-91a')).toBeNull();
    expect(resolveSelectedEvidenceRow(criticalRows, 'evt-91b')?.id).toBe('evt-91b');
  });

  it('resolves an accessible topology summary for a selected node', () => {
    const snapshot = createGallerySnapshot(42);

    expect(resolveTopologySelection(snapshot.topologyNodes, 'policy')).toMatchObject({
      id: 'policy',
      summary: expect.stringContaining('policy'),
    });
    expect(resolveTopologySelection(snapshot.topologyNodes, 'missing')).toBeNull();
  });
});
