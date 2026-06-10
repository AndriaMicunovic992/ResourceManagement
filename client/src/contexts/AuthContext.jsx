import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getToken, setToken, removeToken, clearImpersonation } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.getMe()
      .then((data) => { setUser(data.user); })
      .catch(() => { removeToken(); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password);
    // A fresh session must never inherit a stale "view as" stash.
    clearImpersonation();
    setToken(result.token);
    setUser(result.user);
    return result;
  }, []);

  const signup = useCallback(async (data) => {
    const result = await api.signup(data);
    clearImpersonation();
    setToken(result.token);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(() => {
    clearImpersonation();
    removeToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
