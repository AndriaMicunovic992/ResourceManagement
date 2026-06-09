import { describe, it, expect } from 'vitest';
import { computeFinal } from '../src/services/evaluation.service.js';

describe('computeFinal', () => {
  it('returns null when no weight contributes', () => {
    expect(computeFinal([{ id: 'a', weightSnapshot: 0 }], [])).toBeNull();
    expect(
      computeFinal(
        [{ id: 'a', weightSnapshot: 5 }],
        [{ categorySnapshotId: 'a', responsibleScore: null }]
      )
    ).toBeNull();
  });

  it('computes a weighted average of responsible scores', () => {
    const snaps = [
      { id: 'a', weightSnapshot: 1 },
      { id: 'b', weightSnapshot: 3 },
    ];
    const scores = [
      { categorySnapshotId: 'a', responsibleScore: 4 },
      { categorySnapshotId: 'b', responsibleScore: 8 },
    ];
    // (4*1 + 8*3) / (1+3) = 28/4 = 7
    expect(computeFinal(snaps, scores)).toBe(7);
  });

  it('skips categories whose responsible score is null', () => {
    const snaps = [
      { id: 'a', weightSnapshot: 1 },
      { id: 'b', weightSnapshot: 1 },
    ];
    const scores = [
      { categorySnapshotId: 'a', responsibleScore: 5 },
      { categorySnapshotId: 'b', responsibleScore: null },
    ];
    expect(computeFinal(snaps, scores)).toBe(5);
  });

  it('rounds to one decimal place', () => {
    const snaps = [
      { id: 'a', weightSnapshot: 1 },
      { id: 'b', weightSnapshot: 1 },
      { id: 'c', weightSnapshot: 1 },
    ];
    const scores = [
      { categorySnapshotId: 'a', responsibleScore: 1 },
      { categorySnapshotId: 'b', responsibleScore: 1 },
      { categorySnapshotId: 'c', responsibleScore: 2 },
    ];
    // 4/3 = 1.333... -> 1.3
    expect(computeFinal(snaps, scores)).toBe(1.3);
  });
});
