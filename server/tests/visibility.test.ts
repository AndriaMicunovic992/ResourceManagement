import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isSelf,
  assertAdmin,
  assertCanViewPerson,
  assertCanViewCustomer,
  assertCanViewProject,
  type VisibilityScope,
} from '../src/services/visibility.service.js';
import { NotFoundError, ForbiddenError } from '../src/utils/errors.js';

/** A member scope that can see only themselves, for the negative cases. */
function scope(overrides: Partial<VisibilityScope> = {}): VisibilityScope {
  return {
    orgId: 'org1',
    userId: 'user1',
    role: 'member',
    isAdmin: false,
    selfResourceId: 'self',
    managedPersonIds: new Set(),
    responsibleCustomerIds: new Set(),
    responsibleProjectIds: new Set(),
    visiblePersonIds: new Set(['self']),
    visibleCustomerIds: new Set(['cust-ok']),
    visibleProjectIds: new Set(['proj-ok']),
    ...overrides,
  };
}

describe('isAdmin', () => {
  it('treats owner and admin as admin', () => {
    expect(isAdmin('owner')).toBe(true);
    expect(isAdmin('admin')).toBe(true);
  });
  it('treats member and viewer as non-admin', () => {
    expect(isAdmin('member')).toBe(false);
    expect(isAdmin('viewer')).toBe(false);
  });
});

describe('assertCanViewPerson', () => {
  it('lets admins view anyone without consulting the scope set', () => {
    expect(() => assertCanViewPerson(scope({ isAdmin: true }), 'stranger')).not.toThrow();
  });
  it('allows a person in scope', () => {
    expect(() => assertCanViewPerson(scope(), 'self')).not.toThrow();
  });
  it('returns 404 (NotFoundError), NOT 403, for a person out of scope', () => {
    // "visibility == existence": leaking 403 here would reveal the record exists.
    expect(() => assertCanViewPerson(scope(), 'stranger')).toThrow(NotFoundError);
  });
});

describe('assertCanViewCustomer / assertCanViewProject', () => {
  it('allows in-scope customer/project and 404s out-of-scope ones', () => {
    expect(() => assertCanViewCustomer(scope(), 'cust-ok')).not.toThrow();
    expect(() => assertCanViewCustomer(scope(), 'cust-no')).toThrow(NotFoundError);
    expect(() => assertCanViewProject(scope(), 'proj-ok')).not.toThrow();
    expect(() => assertCanViewProject(scope(), 'proj-no')).toThrow(NotFoundError);
  });
  it('lets admins through regardless of scope sets', () => {
    expect(() => assertCanViewCustomer(scope({ isAdmin: true }), 'cust-no')).not.toThrow();
    expect(() => assertCanViewProject(scope({ isAdmin: true }), 'proj-no')).not.toThrow();
  });
});

describe('assertAdmin', () => {
  it('passes for admins', () => {
    expect(() => assertAdmin(scope({ isAdmin: true }))).not.toThrow();
  });
  it('throws ForbiddenError (a true 403) for non-admins', () => {
    expect(() => assertAdmin(scope())).toThrow(ForbiddenError);
  });
});

describe('isSelf', () => {
  it('is true only for the requesting user’s own resource id', () => {
    expect(isSelf(scope(), 'self')).toBe(true);
    expect(isSelf(scope(), 'someone-else')).toBe(false);
  });
  it('is false when the user has no linked resource', () => {
    expect(isSelf(scope({ selfResourceId: null }), 'self')).toBe(false);
  });
});
