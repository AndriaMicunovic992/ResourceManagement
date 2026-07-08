import { createContext, useContext, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { setTaxonomy } from '../lib/taxonomy';
import { useOrg } from './OrgContext';

const DataContext = createContext(null);

// Display order for performance-log categories: grouping ASC (nulls last),
// then sortOrder ASC, then name ASC. Applied client-side so the order stays
// stable regardless of what the list endpoint returns.
function sortLogCategories(list) {
  return [...list].sort((a, b) => {
    const ga = a.grouping;
    const gb = b.grouping;
    if (ga == null && gb != null) return 1;
    if (gb == null && ga != null) return -1;
    if ((ga || '') !== (gb || '')) return (ga || '').localeCompare(gb || '');
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
}

/** Full-screen fallback when the initial bulk load fails (vs. silently
 *  rendering an empty app as the previous implementation did). */
function DataLoadError({ onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-bg p-6 font-sans">
      <div className="max-w-md w-full bg-white border border-border rounded-xl shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-danger-bg text-danger mx-auto mb-4 flex items-center justify-center text-2xl font-semibold">
          !
        </div>
        <h1 className="text-lg font-semibold text-text mb-2">Couldn't load your data</h1>
        <p className="text-sm text-text-mid mb-6">
          We couldn't reach the server. Check your connection and try again.
        </p>
        <button
          onClick={onRetry}
          className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/**
 * Bulk-loads the core org collections via TanStack Query and exposes the same
 * `useData()` surface the app already relies on (always-defined arrays + CRUD
 * helpers). Mutations call the API and then invalidate the affected queries —
 * the server is the source of truth, so cascades (deleting a customer removes
 * its projects/needs/assignments) resolve on refetch rather than via
 * hand-maintained client-side pruning.
 *
 * Queries are keyed by org id and only run once an org is active; the org
 * switch already triggers a full page reload, so there's no stale-org data.
 */
export function DataProvider({ children }) {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;
  const enabled = !!orgId;
  const queryClient = useQueryClient();

  const customersQ = useQuery({ queryKey: ['customers', orgId], queryFn: api.getCustomers, enabled });
  const projectsQ = useQuery({ queryKey: ['projects', orgId], queryFn: api.getProjects, enabled });
  const resourcesQ = useQuery({ queryKey: ['resources', orgId], queryFn: api.getResources, enabled });
  const teamsQ = useQuery({ queryKey: ['teams', orgId], queryFn: api.getTeams, enabled });
  const skillsQ = useQuery({ queryKey: ['skills', orgId], queryFn: api.getSkills, enabled });
  const logCategoriesQ = useQuery({
    queryKey: ['logCategories', orgId],
    queryFn: api.getLogCategories,
    enabled,
    select: (data) => sortLogCategories(data || []),
  });
  const needsQ = useQuery({ queryKey: ['needs', orgId], queryFn: api.getNeeds, enabled });
  const assignmentsQ = useQuery({ queryKey: ['assignments', orgId], queryFn: api.getAssignments, enabled });
  // Editable role taxonomy (domains/roles/seniorities). Drives the pickers,
  // planner colors and seniority ordering.
  const taxonomyQ = useQuery({ queryKey: ['taxonomy', orgId], queryFn: api.getTaxonomy, enabled });
  // Org members back the "responsible person" pickers — responsibility can be
  // any login user, not only staffable resources.
  const membersQ = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => api.getMembers().catch(() => []),
    enabled,
  });
  const meResourceQ = useQuery({
    queryKey: ['meResource', orgId],
    queryFn: () => api.getMyResource().catch(() => null),
    enabled,
  });

  const customers = customersQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const resources = resourcesQ.data ?? [];
  const teams = teamsQ.data ?? [];
  const skills = skillsQ.data ?? [];
  const logCategories = logCategoriesQ.data ?? [];
  const needs = needsQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];
  const members = membersQ.data ?? [];
  const meResource = meResourceQ.data ?? null;
  const domains = taxonomyQ.data?.domains ?? [];
  const seniorities = taxonomyQ.data?.seniorities ?? [];

  // Hydrate the module-level taxonomy registry the moment the data changes, so
  // the pure lookup helpers (domainColor, seniorityShort, …) reflect this org
  // on the same render the children paint with.
  const lastTaxRef = useRef(null);
  if (taxonomyQ.data && taxonomyQ.data !== lastTaxRef.current) {
    setTaxonomy(domains, seniorities);
    lastTaxRef.current = taxonomyQ.data;
  }

  // Gate the app on the collections the planner/dashboards can't render without.
  const coreQueries = [customersQ, projectsQ, resourcesQ, needsQ, assignmentsQ];
  const loading = !enabled || coreQueries.some((q) => q.isLoading);
  // Only treat it as a hard error on first load (no data yet). A failed
  // background refetch keeps the last-good data on screen instead of blanking.
  const loadError = coreQueries.find((q) => q.isError && q.data === undefined)?.error || null;

  // Invalidate by base key (partial match also catches the org-scoped key).
  const invalidate = useCallback(
    (...keys) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    [queryClient]
  );
  const reload = useCallback(() => queryClient.invalidateQueries(), [queryClient]);

  // Customer CRUD
  const addCustomer = useCallback(async (data) => {
    const created = await api.createCustomer(data);
    invalidate('customers');
    return created;
  }, [invalidate]);
  const updateCustomer = useCallback(async (id, data) => {
    const updated = await api.updateCustomer(id, data);
    invalidate('customers');
    return updated;
  }, [invalidate]);
  const deleteCustomer = useCallback(async (id) => {
    await api.deleteCustomer(id);
    invalidate('customers', 'projects', 'needs', 'assignments');
  }, [invalidate]);

  // Project CRUD
  const addProject = useCallback(async (data) => {
    const created = await api.createProject(data);
    invalidate('projects');
    return created;
  }, [invalidate]);
  const updateProject = useCallback(async (id, data) => {
    const updated = await api.updateProject(id, data);
    invalidate('projects');
    return updated;
  }, [invalidate]);
  const deleteProject = useCallback(async (id) => {
    await api.deleteProject(id);
    invalidate('projects', 'needs', 'assignments');
  }, [invalidate]);

  // Resource CRUD
  const addResource = useCallback(async (data) => {
    const created = await api.createResource(data);
    invalidate('resources');
    return created;
  }, [invalidate]);
  const updateResource = useCallback(async (id, data) => {
    const updated = await api.updateResource(id, data);
    invalidate('resources');
    return updated;
  }, [invalidate]);
  const deleteResource = useCallback(async (id) => {
    await api.deleteResource(id);
    invalidate('resources', 'assignments');
  }, [invalidate]);
  // Planned absences (planner): per-month days delta, merged server-side.
  const setResourceAbsences = useCallback(async (id, months) => {
    const updated = await api.setResourceAbsences(id, months);
    invalidate('resources');
    return updated;
  }, [invalidate]);

  // Team CRUD — membership changes are reflected on resources too.
  const addTeam = useCallback(async (data) => {
    const created = await api.createTeam(data);
    invalidate('teams');
    return created;
  }, [invalidate]);
  const updateTeam = useCallback(async (id, data) => {
    const updated = await api.updateTeam(id, data);
    invalidate('teams', 'resources');
    return updated;
  }, [invalidate]);
  const deleteTeam = useCallback(async (id) => {
    await api.deleteTeam(id);
    invalidate('teams', 'resources');
  }, [invalidate]);

  // Skill CRUD
  const addSkill = useCallback(async (data) => {
    const created = await api.createSkill(data);
    invalidate('skills');
    return created;
  }, [invalidate]);
  const updateSkill = useCallback(async (id, data) => {
    const updated = await api.updateSkill(id, data);
    invalidate('skills');
    return updated;
  }, [invalidate]);
  const deleteSkill = useCallback(async (id) => {
    await api.deleteSkill(id);
    invalidate('skills', 'resources');
  }, [invalidate]);

  // Role-taxonomy CRUD. Renames cascade server-side to people & needs, so those
  // collections are invalidated alongside the taxonomy.
  const addDomain = useCallback(async (data) => { await api.createDomain(data); invalidate('taxonomy'); }, [invalidate]);
  const updateDomain = useCallback(async (id, data) => { await api.updateDomain(id, data); invalidate('taxonomy', 'resources', 'needs'); }, [invalidate]);
  const deleteDomain = useCallback(async (id) => { await api.deleteDomain(id); invalidate('taxonomy'); }, [invalidate]);
  const addJobRole = useCallback(async (domainId, name) => { await api.createJobRole(domainId, name); invalidate('taxonomy'); }, [invalidate]);
  const updateJobRole = useCallback(async (id, name) => { await api.updateJobRole(id, name); invalidate('taxonomy', 'resources', 'needs'); }, [invalidate]);
  const deleteJobRole = useCallback(async (id) => { await api.deleteJobRole(id); invalidate('taxonomy'); }, [invalidate]);
  const addSeniority = useCallback(async (data) => { await api.createSeniority(data); invalidate('taxonomy'); }, [invalidate]);
  const updateSeniority = useCallback(async (id, data) => { await api.updateSeniority(id, data); invalidate('taxonomy', 'resources', 'needs'); }, [invalidate]);
  const moveSeniority = useCallback(async (id, direction) => { await api.moveSeniority(id, direction); invalidate('taxonomy'); }, [invalidate]);
  const deleteSeniority = useCallback(async (id) => { await api.deleteSeniority(id); invalidate('taxonomy'); }, [invalidate]);

  // Performance log category CRUD
  const addLogCategory = useCallback(async (data) => {
    const created = await api.createLogCategory(data);
    invalidate('logCategories');
    return created;
  }, [invalidate]);
  const updateLogCategory = useCallback(async (id, data) => {
    const updated = await api.updateLogCategory(id, data);
    invalidate('logCategories');
    return updated;
  }, [invalidate]);
  const deleteLogCategory = useCallback(async (id) => {
    await api.deleteLogCategory(id);
    invalidate('logCategories');
  }, [invalidate]);

  // PersonSkill CRUD (nested under resources)
  const upsertPersonSkill = useCallback(async (data) => {
    const result = await api.upsertPersonSkill(data);
    invalidate('resources');
    return result;
  }, [invalidate]);
  const deletePersonSkill = useCallback(async (_resourceId, personSkillId) => {
    await api.deletePersonSkill(personSkillId);
    invalidate('resources');
  }, [invalidate]);

  // Need CRUD
  const addNeed = useCallback(async (data) => {
    const created = await api.createNeed(data);
    invalidate('needs');
    return created;
  }, [invalidate]);
  const updateNeed = useCallback(async (id, data) => {
    const updated = await api.updateNeed(id, data);
    invalidate('needs');
    return updated;
  }, [invalidate]);
  const deleteNeed = useCallback(async (id) => {
    await api.deleteNeed(id);
    invalidate('needs', 'assignments');
  }, [invalidate]);

  // Assignment CRUD
  const upsertAssignment = useCallback(async (data) => {
    const result = await api.upsertAssignment(data);
    invalidate('assignments');
    return result;
  }, [invalidate]);
  const updateAssignment = useCallback(async (id, data) => {
    const result = await api.updateAssignment(id, data);
    invalidate('assignments');
    return result;
  }, [invalidate]);
  const deleteAssignment = useCallback(async (id) => {
    await api.deleteAssignment(id);
    invalidate('assignments');
  }, [invalidate]);

  if (enabled && loadError) {
    return <DataLoadError onRetry={reload} />;
  }

  const value = {
    loading, error: loadError,
    customers, projects, resources, teams, skills, logCategories, needs, assignments, members, meResource, reload,
    domains, seniorities,
    addDomain, updateDomain, deleteDomain,
    addJobRole, updateJobRole, deleteJobRole,
    addSeniority, updateSeniority, moveSeniority, deleteSeniority,
    addCustomer, updateCustomer, deleteCustomer,
    addProject, updateProject, deleteProject,
    addResource, updateResource, deleteResource, setResourceAbsences,
    addTeam, updateTeam, deleteTeam,
    addSkill, updateSkill, deleteSkill,
    addLogCategory, updateLogCategory, deleteLogCategory,
    upsertPersonSkill, deletePersonSkill,
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
