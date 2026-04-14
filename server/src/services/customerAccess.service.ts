import type { VisibilityScope } from './visibility.service.js';

/**
 * Access control for customer detail pages — now a thin wrapper around the
 * visibility service. Kept for readability in customer routes; the actual
 * rules all live in visibility.service.ts.
 */
export function canViewCustomer(scope: VisibilityScope, customerId: string): boolean {
  if (scope.isAdmin) return true;
  return scope.visibleCustomerIds.has(customerId);
}

export function listViewableCustomerIds(scope: VisibilityScope): string[] {
  return [...scope.visibleCustomerIds];
}
