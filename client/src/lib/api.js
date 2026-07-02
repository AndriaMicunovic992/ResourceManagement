import { getToken, removeToken, isImpersonating, stopImpersonation } from './auth';

const API = import.meta.env.VITE_API_URL || '/api';

export const MICROSOFT_LOGIN_URL = API + '/auth/microsoft/login';

// Handle an authenticated request that came back 401: the session is gone or
// expired. If we were impersonating (the short-lived token timed out), drop back
// to the admin session; otherwise clear the token and bounce to login. Without
// this, an expired token leaves the user stuck on silent "Request failed".
// `path` rides along in the redirect so a bounce is never anonymous — the login
// URL shows which request killed the session.
function handleUnauthorized(path) {
  if (isImpersonating()) {
    const restored = stopImpersonation();
    if (restored) {
      window.location.reload();
      return;
    }
    // Stash existed but held no usable token — fall through to a clean logout.
  }
  removeToken();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?error=session_expired&from=' + encodeURIComponent(path);
  }
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, { ...options, headers });

  // Only treat 401 as a session failure when we actually sent a token — a 401
  // from the login call itself is just bad credentials.
  if (res.status === 401 && token) {
    handleUnauthorized(path);
  }

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
  getAuthConfig: () => apiFetch('/auth/config'),
  impersonate: (userId) => apiFetch('/auth/impersonate', { method: 'POST', body: JSON.stringify({ userId }) }),
  startMicrosoftLink: () => apiFetch('/auth/microsoft/link', { method: 'POST', body: JSON.stringify({}) }),

  // Org invites (admin)
  getInvites: () => apiFetch('/org/invites'),
  createInvite: (email, role) => apiFetch('/org/invites', { method: 'POST', body: JSON.stringify({ email, role }) }),
  revokeInvite: (id) => apiFetch('/org/invites/' + id, { method: 'DELETE' }),

  // Orgs
  getOrgs: () => apiFetch('/orgs'),
  createOrg: (name) => apiFetch('/orgs', { method: 'POST', body: JSON.stringify({ name }) }),
  switchOrg: (orgId) => apiFetch('/orgs/switch', { method: 'POST', body: JSON.stringify({ orgId }) }),

  updateOrg: (data) => apiFetch('/org', { method: 'PATCH', body: JSON.stringify(data) }),

  // Org Members
  getRoles: () => apiFetch('/roles'),
  createRole: (data) => apiFetch('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id, data) => apiFetch('/roles/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id) => apiFetch('/roles/' + id, { method: 'DELETE' }),
  getNotifications: () => apiFetch('/me/notifications'),
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

  // Role taxonomy (domains / roles / seniorities). Writes return the full
  // refreshed taxonomy.
  getTaxonomy: () => apiFetch('/taxonomy'),
  createDomain: (data) => apiFetch('/taxonomy/domains', { method: 'POST', body: JSON.stringify(data) }),
  updateDomain: (id, data) => apiFetch('/taxonomy/domains/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDomain: (id) => apiFetch('/taxonomy/domains/' + id, { method: 'DELETE' }),
  createJobRole: (domainId, name) => apiFetch('/taxonomy/domains/' + domainId + '/roles', { method: 'POST', body: JSON.stringify({ name }) }),
  updateJobRole: (id, name) => apiFetch('/taxonomy/roles/' + id, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteJobRole: (id) => apiFetch('/taxonomy/roles/' + id, { method: 'DELETE' }),
  createSeniority: (data) => apiFetch('/taxonomy/seniorities', { method: 'POST', body: JSON.stringify(data) }),
  updateSeniority: (id, data) => apiFetch('/taxonomy/seniorities/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  moveSeniority: (id, direction) => apiFetch('/taxonomy/seniorities/' + id + '/move', { method: 'POST', body: JSON.stringify({ direction }) }),
  deleteSeniority: (id) => apiFetch('/taxonomy/seniorities/' + id, { method: 'DELETE' }),

  // Integrations (Jira / Tempo). The connection GET never returns token
  // plaintext — only whether each is set.
  getJiraConnection: () => apiFetch('/integration/jira'),
  saveJiraConnection: (data) => apiFetch('/integration/jira', { method: 'PUT', body: JSON.stringify(data) }),
  testJiraConnection: () => apiFetch('/integration/jira/test', { method: 'POST', body: '{}' }),
  refreshJira: () => apiFetch('/integration/jira/refresh', { method: 'POST', body: '{}' }),
  getJiraAccounts: () => apiFetch('/integration/jira/accounts'),
  syncTempo: (updatedFrom) => apiFetch('/integration/tempo/sync', { method: 'POST', body: JSON.stringify({ updatedFrom }) }),
  getTeamsConnection: () => apiFetch('/integration/teams'),
  saveTeamsConnection: (data) => apiFetch('/integration/teams', { method: 'PUT', body: JSON.stringify(data) }),
  testTeamsConnection: () => apiFetch('/integration/teams/test', { method: 'POST', body: '{}' }),
  getActualHours: (customerId, month) => apiFetch(`/integration/tempo/actuals?customerId=${encodeURIComponent(customerId)}&month=${encodeURIComponent(month)}`),
  getMonthlyActuals: (from, to) => apiFetch(`/integration/tempo/actuals/monthly?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getMonthlyActualsByCustomer: (from, to) => apiFetch(`/integration/tempo/actuals/monthly-by-customer?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getResourceActualsByCustomer: (resourceId, from, to) => apiFetch(`/integration/tempo/actuals/resource-by-customer?resourceId=${encodeURIComponent(resourceId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getCustomerActualsByResource: (customerId, from, to) => apiFetch(`/integration/tempo/actuals/customer-by-resource?customerId=${encodeURIComponent(customerId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  getJiraWorkItems: () => apiFetch('/integration/jira/work-items'),
  createJiraWorkItem: (data) => apiFetch('/integration/jira/work-items', { method: 'POST', body: JSON.stringify(data) }),
  updateJiraWorkItem: (id, data) => apiFetch('/integration/jira/work-items/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJiraWorkItem: (id) => apiFetch('/integration/jira/work-items/' + id, { method: 'DELETE' }),

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
  getOneOnOne: (resourceId, id) => apiFetch('/people/' + resourceId + '/oneonones/' + id),
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

  // Log thread comments
  addLogComment: (resourceId, logId, content) =>
    apiFetch('/people/' + resourceId + '/logs/' + logId + '/comments', { method: 'POST', body: JSON.stringify({ content }) }),
  deleteLogComment: (resourceId, logId, commentId) =>
    apiFetch('/people/' + resourceId + '/logs/' + logId + '/comments/' + commentId, { method: 'DELETE' }),

  // Follow-ups
  listFollowUps: (resourceId, status) =>
    apiFetch(_qs('/people/' + resourceId + '/followups', status ? { status } : null)),
  createFollowUp: (resourceId, data) =>
    apiFetch('/people/' + resourceId + '/followups', { method: 'POST', body: JSON.stringify(data) }),
  updateFollowUp: (resourceId, id, data) =>
    apiFetch('/people/' + resourceId + '/followups/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFollowUp: (resourceId, id) =>
    apiFetch('/people/' + resourceId + '/followups/' + id, { method: 'DELETE' }),

  // Career thread
  listCareerEntries: (resourceId) => apiFetch('/people/' + resourceId + '/career'),
  createCareerEntry: (resourceId, data) =>
    apiFetch('/people/' + resourceId + '/career', { method: 'POST', body: JSON.stringify(data) }),
  updateCareerEntry: (resourceId, id, data) =>
    apiFetch('/people/' + resourceId + '/career/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCareerEntry: (resourceId, id) =>
    apiFetch('/people/' + resourceId + '/career/' + id, { method: 'DELETE' }),

  // Client satisfaction signals (monthly, per person per customer)
  getCustomerSignals: (customerId, params) => apiFetch(_qs('/customers/' + customerId + '/signals', params)),
  upsertCustomerSignal: (customerId, data) =>
    apiFetch('/customers/' + customerId + '/signals', { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomerSignal: (customerId, id) =>
    apiFetch('/customers/' + customerId + '/signals/' + id, { method: 'DELETE' }),
  getPersonSignals: (resourceId, params) => apiFetch(_qs('/people/' + resourceId + '/signals', params)),

  // PM review sessions (dated records per customer)
  listCustomerReviews: (customerId) => apiFetch('/customers/' + customerId + '/reviews'),
  getCustomerReview: (customerId, id) => apiFetch('/customers/' + customerId + '/reviews/' + id),
  createCustomerReview: (customerId, data) =>
    apiFetch('/customers/' + customerId + '/reviews', { method: 'POST', body: JSON.stringify(data || {}) }),
  deleteCustomerReview: (customerId, id) =>
    apiFetch('/customers/' + customerId + '/reviews/' + id, { method: 'DELETE' }),
  // General (whole-customer) review entries — no specific person.
  createCustomerGeneralLog: (customerId, data) =>
    apiFetch('/customers/' + customerId + '/general-logs', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomerGeneralLog: (customerId, logId) =>
    apiFetch('/customers/' + customerId + '/general-logs/' + logId, { method: 'DELETE' }),

  // Compensation satisfaction (on the evaluation cadence)
  setEvaluationCompensation: (id, compensationSatisfaction) =>
    apiFetch('/evaluations/' + id + '/compensation', { method: 'PATCH', body: JSON.stringify({ compensationSatisfaction }) }),

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

  // In-app reminder queue (derived from org cadence settings).
  getMyReminders: () => apiFetch('/me/reminders'),
  dismissReminder: (data) => apiFetch('/me/reminders/dismiss', { method: 'POST', body: JSON.stringify(data) }),

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
