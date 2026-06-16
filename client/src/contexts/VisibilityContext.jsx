import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useOrg } from './OrgContext';

const VisibilityContext = createContext(null);

/**
 * Server-sourced visibility scope. Mirrors server/src/services/visibility.service.ts.
 * Arrays are exposed as Sets to make membership checks O(1) in consumers.
 */
export function VisibilityProvider({ children }) {
  const { currentOrg } = useOrg();
  const [scope, setScope] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!currentOrg) { setScope(null); setLoading(false); return; }
    setLoading(true);
    try {
      const s = await api.getMyVisibility();
      setScope(s);
    } catch (e) {
      console.error('Visibility load failed:', e);
      setScope(null);
    }
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { reload(); }, [reload]);

  const value = useMemo(() => {
    if (!scope) {
      return {
        loading,
        isAdmin: false,
        role: 'viewer',
        selfResourceId: null,
        managedPersonIds: new Set(),
        responsibleCustomerIds: new Set(),
        responsibleProjectIds: new Set(),
        visiblePersonIds: new Set(),
        visibleCustomerIds: new Set(),
        visibleProjectIds: new Set(),
        canViewPerson: () => false,
        canViewCustomer: () => false,
        canViewProject: () => false,
        viewModeForPerson: () => 'denied',
        permissions: null,
        canViewArea: () => true,
        reload,
      };
    }
    const managedPersonIds = new Set(scope.managedPersonIds || []);
    const responsibleCustomerIds = new Set(scope.responsibleCustomerIds || []);
    const responsibleProjectIds = new Set(scope.responsibleProjectIds || []);
    const visiblePersonIds = new Set(scope.visiblePersonIds || []);
    const visibleCustomerIds = new Set(scope.visibleCustomerIds || []);
    const visibleProjectIds = new Set(scope.visibleProjectIds || []);

    const canViewPerson = (id) => scope.isAdmin || visiblePersonIds.has(id);
    const canViewCustomer = (id) => scope.isAdmin || visibleCustomerIds.has(id);
    const canViewProject = (id) => scope.isAdmin || visibleProjectIds.has(id);

    /**
     * viewMode values:
     *   'admin'    — admin/owner viewing anyone (full)
     *   'manager'  — non-admin viewing someone they manage (full minus admin-only extras)
     *   'self'     — non-admin viewing their own card (Overview + restricted Performance)
     *   'denied'   — no access; page should render as 404
     */
    const viewModeForPerson = (personId) => {
      if (scope.isAdmin) return 'admin';
      if (scope.selfResourceId && scope.selfResourceId === personId) return 'self';
      if (visiblePersonIds.has(personId)) return 'manager';
      return 'denied';
    };

    return {
      loading,
      isAdmin: !!scope.isAdmin,
      role: scope.role,
      selfResourceId: scope.selfResourceId ?? null,
      managedPersonIds,
      responsibleCustomerIds,
      responsibleProjectIds,
      visiblePersonIds,
      visibleCustomerIds,
      visibleProjectIds,
      canViewPerson,
      canViewCustomer,
      canViewProject,
      viewModeForPerson,
      // Per-area read permission from the role matrix. Defaults to allow when the
      // matrix is absent (older sessions) so nothing hides unexpectedly.
      permissions: scope.permissions ?? null,
      canViewArea: (segment) => {
        const p = scope.permissions;
        if (!p || !p[segment]) return true;
        return !!p[segment].view;
      },
      reload,
    };
  }, [scope, loading, reload]);

  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>;
}

export function useVisibility() {
  const ctx = useContext(VisibilityContext);
  if (!ctx) throw new Error('useVisibility must be used within VisibilityProvider');
  return ctx;
}
