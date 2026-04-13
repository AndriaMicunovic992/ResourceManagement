import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useOrg } from './OrgContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { currentOrg } = useOrg();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [teams, setTeams] = useState([]);
  const [skills, setSkills] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const reload = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [c, p, r, t, s, n, a] = await Promise.all([
        api.getCustomers(), api.getProjects(), api.getResources(), api.getTeams(), api.getSkills(), api.getNeeds(), api.getAssignments(),
      ]);
      setCustomers(c); setProjects(p); setResources(r); setTeams(t); setSkills(s); setNeeds(n); setAssignments(a);
    } catch (e) {
      console.error('Load failed:', e);
    }
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { reload(); }, [reload]);

  // Customer CRUD
  const addCustomer = useCallback(async (data) => {
    const created = await api.createCustomer(data);
    setCustomers((prev) => [...prev, created]);
    return created;
  }, []);
  const updateCustomer = useCallback(async (id, data) => {
    const updated = await api.updateCustomer(id, data);
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);
  const deleteCustomer = useCallback(async (id) => {
    await api.deleteCustomer(id);
    const pIds = projects.filter((p) => p.customerId === id).map((p) => p.id);
    const nIds = needs.filter((n) => pIds.includes(n.projectId)).map((n) => n.id);
    setAssignments((prev) => prev.filter((a) => !nIds.includes(a.needId)));
    setNeeds((prev) => prev.filter((n) => !pIds.includes(n.projectId)));
    setProjects((prev) => prev.filter((p) => p.customerId !== id));
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, [projects, needs]);

  // Project CRUD
  const addProject = useCallback(async (data) => {
    const created = await api.createProject(data);
    setProjects((prev) => [...prev, created]);
    return created;
  }, []);
  const updateProject = useCallback(async (id, data) => {
    const updated = await api.updateProject(id, data);
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);
  const deleteProject = useCallback(async (id) => {
    await api.deleteProject(id);
    const nIds = needs.filter((n) => n.projectId === id).map((n) => n.id);
    setAssignments((prev) => prev.filter((a) => !nIds.includes(a.needId)));
    setNeeds((prev) => prev.filter((n) => n.projectId !== id));
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, [needs]);

  // Resource CRUD
  const addResource = useCallback(async (data) => {
    const created = await api.createResource(data);
    setResources((prev) => [...prev, created]);
    return created;
  }, []);
  const updateResource = useCallback(async (id, data) => {
    const updated = await api.updateResource(id, data);
    setResources((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }, []);
  const deleteResource = useCallback(async (id) => {
    await api.deleteResource(id);
    setAssignments((prev) => prev.filter((a) => a.resourceId !== id));
    setResources((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Team CRUD
  const addTeam = useCallback(async (data) => {
    const created = await api.createTeam(data);
    setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);
  const updateTeam = useCallback(async (id, data) => {
    const updated = await api.updateTeam(id, data);
    setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name)));
  }, []);
  const deleteTeam = useCallback(async (id) => {
    await api.deleteTeam(id);
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setResources((prev) => prev.map((r) => (r.teamId === id ? { ...r, teamId: null, team: null } : r)));
  }, []);

  // Skill CRUD
  const addSkill = useCallback(async (data) => {
    const created = await api.createSkill(data);
    setSkills((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);
  const updateSkill = useCallback(async (id, data) => {
    const updated = await api.updateSkill(id, data);
    setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name)));
  }, []);
  const deleteSkill = useCallback(async (id) => {
    await api.deleteSkill(id);
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Need CRUD
  const addNeed = useCallback(async (data) => {
    const created = await api.createNeed(data);
    setNeeds((prev) => [...prev, created]);
    return created;
  }, []);
  const updateNeed = useCallback(async (id, data) => {
    const updated = await api.updateNeed(id, data);
    setNeeds((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }, []);
  const deleteNeed = useCallback(async (id) => {
    await api.deleteNeed(id);
    setAssignments((prev) => prev.filter((a) => a.needId !== id));
    setNeeds((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Assignment CRUD
  const upsertAssignment = useCallback(async (data) => {
    const result = await api.upsertAssignment(data);
    setAssignments((prev) => {
      const idx = prev.findIndex((a) => a.id === result.id);
      if (idx >= 0) return prev.map((a) => (a.id === result.id ? result : a));
      return [...prev, result];
    });
    return result;
  }, []);
  const updateAssignment = useCallback(async (id, data) => {
    const result = await api.updateAssignment(id, data);
    setAssignments((prev) => prev.map((a) => (a.id === id ? result : a)));
  }, []);
  const deleteAssignment = useCallback(async (id) => {
    await api.deleteAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const value = {
    loading, customers, projects, resources, teams, skills, needs, assignments, reload,
    addCustomer, updateCustomer, deleteCustomer,
    addProject, updateProject, deleteProject,
    addResource, updateResource, deleteResource,
    addTeam, updateTeam, deleteTeam,
    addSkill, updateSkill, deleteSkill,
    addNeed, updateNeed, deleteNeed,
    upsertAssignment, updateAssignment, deleteAssignment,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
