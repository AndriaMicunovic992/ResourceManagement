import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { setToken } from '../lib/auth';
import { useAuth } from './AuthContext';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [currentOrg, setCurrentOrg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([api.getMe(), api.getOrgs()])
      .then(([me, orgList]) => {
        setCurrentOrg(me.org);
        setRole(me.role);
        setOrgs(orgList);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const switchOrg = useCallback(async (orgId) => {
    const result = await api.switchOrg(orgId);
    setToken(result.token);
    const me = await api.getMe();
    setCurrentOrg(me.org);
    setRole(me.role);
    window.location.reload();
  }, []);

  const canEdit = role !== 'viewer';

  return (
    <OrgContext.Provider value={{ currentOrg, orgs, role, canEdit, loading, switchOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
