import { describe, it, expect } from 'vitest';
import {
  SYSTEM_ROLES,
  SEGMENT_KEYS,
  canDo,
  canView,
  scopeFor,
  normalizeMatrix,
  emptyMatrix,
  tierForLevel,
} from '../src/lib/permissions.js';

const byKey = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.key, r]));

describe('system role matrices', () => {
  it('defines all four system roles, ranked', () => {
    expect(byKey.owner.level).toBe(4);
    expect(byKey.admin.level).toBe(3);
    expect(byKey.member.level).toBe(2);
    expect(byKey.viewer.level).toBe(1);
  });

  it('owner & admin can view & do everything, everywhere', () => {
    for (const key of ['owner', 'admin']) {
      const m = byKey[key].permissions;
      for (const seg of SEGMENT_KEYS) {
        expect(scopeFor(m, seg)).toBe('all');
        expect(canView(m, seg)).toBe(true);
        expect(canDo(m, seg, 'create')).toBe(true);
        expect(canDo(m, seg, 'edit')).toBe(true);
        expect(canDo(m, seg, 'delete')).toBe(true);
      }
    }
  });

  it('member: scoped reads, feedback writes, no record CRUD', () => {
    const m = byKey.member.permissions;
    expect(scopeFor(m, 'people')).toBe('team');
    expect(canView(m, 'people')).toBe(true);
    expect(canDo(m, 'people', 'edit')).toBe(false); // person records stay admin-only
    expect(canDo(m, 'oneOnOne', 'create')).toBe(true);
    expect(canDo(m, 'pmReview', 'create')).toBe(true);
    expect(canDo(m, 'customers', 'edit')).toBe(false);
    expect(canDo(m, 'planner', 'create')).toBe(false);
    expect(canView(m, 'settings')).toBe(false); // members don't see org settings
  });

  it('viewer: themselves only, no writes outside own journal', () => {
    const m = byKey.viewer.permissions;
    expect(canView(m, 'people')).toBe(true);
    expect(scopeFor(m, 'people')).toBe('own');
    expect(canView(m, 'customers')).toBe(false);
    expect(canDo(m, 'oneOnOne', 'create')).toBe(false);
    expect(canDo(m, 'customers', 'create')).toBe(false);
  });
});

describe('matrix helpers', () => {
  it('canDo (and canView) are false when view is off, whatever the flags', () => {
    const m = emptyMatrix();
    m.customers = { scope: 'all', view: false, create: true, edit: true, delete: true };
    expect(canView(m, 'customers')).toBe(false);
    expect(canDo(m, 'customers', 'create')).toBe(false);
  });

  it('tierForLevel maps custom levels onto visibility tiers', () => {
    expect(tierForLevel(4)).toBe('admin'); // owner
    expect(tierForLevel(3)).toBe('admin');
    expect(tierForLevel(2)).toBe('member');
    expect(tierForLevel(1)).toBe('viewer');
    expect(tierForLevel(0)).toBe('viewer');
  });

  it('normalizeMatrix fills missing segments, clamps input, back-fills view', () => {
    const m = normalizeMatrix({
      customers: { scope: 'bogus', view: true, create: 1, edit: 'yes' }, // invalid scope, explicit view
      planner: { scope: 'team', create: true }, // legacy shape (no view) → view back-filled true
      pmReview: { scope: 'none' }, // legacy "no access" → view false
      junk: {},
    });
    expect(m.customers.scope).toBe('own'); // invalid scope → default own
    expect(m.customers.view).toBe(true);
    expect(m.customers.create).toBe(true); // truthy coerced
    expect(m.planner.view).toBe(true); // back-filled from non-none scope
    expect(m.pmReview.view).toBe(false); // legacy 'none' → no view
    expect(m.people.view).toBe(false); // missing segment filled, no access
    expect(Object.keys(m).sort()).toEqual([...SEGMENT_KEYS].sort());
  });
});
