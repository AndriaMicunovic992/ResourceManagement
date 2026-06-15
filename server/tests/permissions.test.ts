import { describe, it, expect } from 'vitest';
import {
  SYSTEM_ROLES,
  SEGMENT_KEYS,
  canDo,
  scopeFor,
  normalizeMatrix,
  emptyMatrix,
} from '../src/lib/permissions.js';

const byKey = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.key, r]));

describe('system role matrices', () => {
  it('defines all four system roles, ranked', () => {
    expect(byKey.owner.level).toBe(4);
    expect(byKey.admin.level).toBe(3);
    expect(byKey.member.level).toBe(2);
    expect(byKey.viewer.level).toBe(1);
  });

  it('owner & admin can do everything, everywhere', () => {
    for (const key of ['owner', 'admin']) {
      const m = byKey[key].permissions;
      for (const seg of SEGMENT_KEYS) {
        expect(scopeFor(m, seg)).toBe('all');
        expect(canDo(m, seg, 'create')).toBe(true);
        expect(canDo(m, seg, 'edit')).toBe(true);
        expect(canDo(m, seg, 'delete')).toBe(true);
      }
    }
  });

  it('member: scoped reads, feedback writes, no record CRUD', () => {
    const m = byKey.member.permissions;
    expect(scopeFor(m, 'people')).toBe('team');
    expect(canDo(m, 'people', 'edit')).toBe(false); // person records stay admin-only
    expect(canDo(m, 'oneOnOne', 'create')).toBe(true);
    expect(canDo(m, 'pmReview', 'create')).toBe(true);
    expect(canDo(m, 'customers', 'edit')).toBe(false);
    expect(canDo(m, 'planner', 'create')).toBe(false);
  });

  it('viewer: themselves only, no writes outside own journal', () => {
    const m = byKey.viewer.permissions;
    expect(scopeFor(m, 'people')).toBe('own');
    expect(scopeFor(m, 'customers')).toBe('none');
    expect(canDo(m, 'oneOnOne', 'create')).toBe(false);
    expect(canDo(m, 'customers', 'create')).toBe(false);
  });
});

describe('matrix helpers', () => {
  it('canDo is false when scope is none regardless of action flags', () => {
    const m = emptyMatrix();
    m.customers = { scope: 'none', create: true, edit: true, delete: true };
    expect(canDo(m, 'customers', 'create')).toBe(false);
  });

  it('normalizeMatrix fills missing segments and clamps bad input', () => {
    const m = normalizeMatrix({ customers: { scope: 'bogus', create: 1, edit: 'yes' }, junk: {} });
    expect(m.customers.scope).toBe('none'); // invalid scope → none
    expect(m.customers.create).toBe(true); // truthy coerced
    expect(m.customers.edit).toBe(true);
    expect(m.people.scope).toBe('none'); // missing segment filled
    expect(Object.keys(m).sort()).toEqual([...SEGMENT_KEYS].sort());
  });
});
