import { describe, it, expect } from 'vitest';
import { monthRange } from '../src/utils/months.js';

describe('monthRange', () => {
  it('returns [] for missing inputs', () => {
    expect(monthRange('', '')).toEqual([]);
    expect(monthRange('2026-01', '')).toEqual([]);
    expect(monthRange('', '2026-01')).toEqual([]);
  });

  it('returns a single month when start === end', () => {
    expect(monthRange('2026-04', '2026-04')).toEqual(['2026-04']);
  });

  it('lists inclusive months within a year', () => {
    expect(monthRange('2026-04', '2026-07')).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
  });

  it('crosses the year boundary and zero-pads months', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('returns [] when end precedes start', () => {
    expect(monthRange('2026-06', '2026-03')).toEqual([]);
  });
});
