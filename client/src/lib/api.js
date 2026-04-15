const API = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('databob_token');
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, { ...options, headers });

  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (data) => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => apiFetch('/auth/me'),

  // Orgs
  getOrgs: () => apiFetch('/orgs'),
  createOrg: (name) => apiFetch('/orgs', { method: 'POST', body: JSON.stringify({ name }) }),
  switchOrg: (orgId) => apiFetch('/orgs/switch', { method: 'POST', body: JSON.stringify({ orgId }) }),

  updateOrg: (data) => apiFetch('/org', { method: 'PATCH', body: JSON.stringify(data) }),

  // Org Members
  getMembers: () => apiFetch('/org/members'),
  addMember: (email, role) => apiFetch('/org/members', { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateMemberRole: (id, role) => apiFetch('/org/members/' + id, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (id) => apiFetch('/org/members/' + id, { method: 'DELETE' }),

  // Customers
  getCustomers: () => apiFetch('/customers'),
  createCustomer: (data) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => apiFetch('/customers/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCustomer: (id) => apiFetch('/customers/' + id, { method: 'DELETE' }),

  // Projects
  getProjects: () => apiFetch('/projects'),
  createProject: (data) => apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => apiFetch('/projects/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id) => apiFetch('/projects/' + id, { method: 'DELETE' }),

  // Resources
  getResources: () => apiFetch('/resources'),
  createResource: (data) => apiFetch('/resources', { method: 'POST', body: JSON.stringify(data) }),
  updateResource: (id, data) => apiFetch('/resources/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteResource: (id) => apiFetch('/resources/' + id, { method: 'DELETE' }),

  // Teams
  getTeams: () => apiFetch('/teams'),
  createTeam: (data) => apiFetch('/teams', { method: 'POST', body: JSON.stringify(data) }),
  updateTeam: (id, data) => apiFetch('/teams/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTeam: (id) => apiFetch('/teams/' + id, { method: 'DELETE' }),

  // Me
  getMyResource: () => apiFetch('/me/resource'),
  getMyAllocations: () => apiFetch('/me/allocations'),

  // Performance Log Categories
  getLogCategories: () => apiFetch('/log-categories'),
  createLogCategory: (data) => apiFetch('/log-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateLogCategory: (id, data) => apiFetch('/log-categories/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLogCategory: (id) => apiFetch('/log-categories/' + id, { method: 'DELETE' }),

  // Skills
  getSkills: () => apiFetch('/skills'),
  createSkill: (data) => apiFetch('/skills', { method: 'POST', body: JSON.stringify(data) }),
  updateSkill: (id, data) => apiFetch('/skills/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSkill: (id) => apiFetch('/skills/' + id, { method: 'DELETE' }),

  // Person Skills
  getPersonSkills: () => apiFetch('/person-skills'),
  upsertPersonSkill: (data) => apiFetch('/person-skills', { method: 'POST', body: JSON.stringify(data) }),
  updatePersonSkill: (id, data) => apiFetch('/person-skills/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePersonSkill: (id) => apiFetch('/person-skills/' + id, { method: 'DELETE' }),

  // 1:1 Meetings
  listOneOnOnes: (resourceId) => apiFetch('/people/' + resourceId + '/oneonones'),
  createOneOnOne: (resourceId, data) => apiFetch('/people/' + resourceId + '/oneonones', { method: 'POST', body: JSON.stringify(data) }),
  updateOneOnOne: (resourceId, id, data) => apiFetch('/people/' + resourceId + '/oneonones/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOneOnOne: (resourceId, id) => apiFetch('/people/' + resourceId + '/oneonones/' + id, { method: 'DELETE' }),

  // Logs
  listLogs: (resourceId, params) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') query.set(k, v);
      }
    }
    const qs = query.toString();
    return apiFetch('/people/' + resourceId + '/logs' + (qs ? '?' + qs : ''));
  },
  getLog: (resourceId, id) => apiFetch('/people/' + resourceId + '/logs/' + id),
  createLog: (resourceId, data) => apiFetch('/people/' + resourceId + '/logs', { method: 'POST', body: JSON.stringify(data) }),
  updateLog: (resourceId, id, data) => apiFetch('/people/' + resourceId + '/logs/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLog: (resourceId, id) => apiFetch('/people/' + resourceId + '/logs/' + id, { method: 'DELETE' }),

  // Needs
  getNeeds: () => apiFetch('/needs'),
  createNeed: (data) => apiFetch('/needs', { method: 'POST', body: JSON.stringify(data) }),
  updateNeed: (id, data) => apiFetch('/needs/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteNeed: (id) => apiFetch('/needs/' + id, { method: 'DELETE' }),

  // Assignments
  getAssignments: () => apiFetch('/assignments'),
  upsertAssignment: (data) => apiFetch('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id, data) => apiFetch('/assignments/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAssignment: (id) => apiFetch('/assignments/' + id, { method: 'DELETE' }),

  // Evaluations
  listEvaluations: (params) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') query.set(k, v);
      }
    }
    const qs = query.toString();
    return apiFetch('/evaluations' + (qs ? '?' + qs : ''));
  },
  getEvaluation: (id) => apiFetch('/evaluations/' + id),
  createEvaluation: (data) => apiFetch('/evaluations', { method: 'POST', body: JSON.stringify(data) }),
  createEvaluationBatch: (data) => apiFetch('/evaluations/batch', { method: 'POST', body: JSON.stringify(data) }),
  updateEvaluationScore: (id, snapshotId, data) =>
    apiFetch('/evaluations/' + id + '/scores/' + snapshotId, { method: 'PATCH', body: JSON.stringify(data) }),
  submitEmployeeEvaluation: (id) =>
    apiFetch('/evaluations/' + id + '/transitions/submit-employee', { method: 'POST', body: JSON.stringify({}) }),
  submitResponsibleEvaluation: (id) =>
    apiFetch('/evaluations/' + id + '/transitions/submit-responsible', { method: 'POST', body: JSON.stringify({}) }),
  finalizeEvaluation: (id, data) =>
    apiFetch('/evaluations/' + id + '/transitions/finalize', { method: 'POST', body: JSON.stringify(data || {}) }),
  deleteEvaluation: (id) => apiFetch('/evaluations/' + id, { method: 'DELETE' }),

  getPerformanceOverall: (resourceId, params) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') query.set(k, v);
      }
    }
    const qs = query.toString();
    return apiFetch('/people/' + resourceId + '/performance/overall' + (qs ? '?' + qs : ''));
  },
  getPerformanceTrend: (resourceId, params) => {
    const query = new URLSearchParams();
    if (typeof params === 'string') {
      // Back-compat: called as getPerformanceTrend(id, 'quarter')
      if (params) query.set('bucket', params);
    } else if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') query.set(k, v);
      }
    }
    const qs = query.toString();
    return apiFetch('/people/' + resourceId + '/performance/trend' + (qs ? '?' + qs : ''));
  },
  getPerformanceCategories: (resourceId, params) => {
    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') query.set(k, v);
      }
    }
    const qs = query.toString();
    return apiFetch('/people/' + resourceId + '/performance/categories' + (qs ? '?' + qs : ''));
  },

  // Org-wide performance insights (admin only)
  getInsightsPerformanceSummary: (params) => apiFetch(_qs('/insights/performance/summary', params)),
  getInsightsPerformanceDistribution: (params) => apiFetch(_qs('/insights/performance/distribution', params)),
  getInsightsPerformanceCategories: (params) => apiFetch(_qs('/insights/performance/categories', params)),
  getInsightsPerformanceHeatmap: (params) => apiFetch(_qs('/insights/performance/heatmap', params)),
  getInsightsPerformanceTrend: (params) => apiFetch(_qs('/insights/performance/trend', params)),
  getInsightsPerformancePeople: (params) => apiFetch(_qs('/insights/performance/people', params)),

  // Visibility scope for the current user in the current org.
  getMyVisibility: () => apiFetch('/me/visibility'),

  // Customer detail + performance
  getCustomerDetail: (id) => apiFetch('/customers/' + id + '/detail'),
  getCustomerActivity: (id, params) => apiFetch(_qs('/customers/' + id + '/activity', params)),
  getCustomerPerformanceOverall: (id, params) =>
    apiFetch(_qs('/customers/' + id + '/performance/overall', params)),
  getCustomerPerformancePerPerson: (id, params) =>
    apiFetch(_qs('/customers/' + id + '/performance/per-person', params)),
  getCustomerPerformanceTrend: (id, params) =>
    apiFetch(_qs('/customers/' + id + '/performance/trend', params)),
};

function _qs(path, params) {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') query.set(k, v);
    }
  }
  const qs = query.toString();
  return path + (qs ? '?' + qs : '');
}
