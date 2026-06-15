// Single source of truth for the RBAC model: capability segments, scopes,
// actions, and the default matrices for the four system roles (encoding today's
// behavior). Enforcement reads from a role's matrix via the helpers below.

export const SEGMENTS = [
  { key: 'people', label: 'People records' },
  { key: 'oneOnOne', label: '1:1s' },
  { key: 'activity', label: 'Activity & journal' },
  { key: 'customers', label: 'Customers & projects' },
  { key: 'planner', label: 'Planner (staffing)' },
  { key: 'pmReview', label: 'PM reviews & signals' },
  { key: 'evaluations', label: 'Evaluations' },
  { key: 'skills', label: 'Skills' },
  { key: 'teams', label: 'Teams' },
  { key: 'members', label: 'Members & roles' },
  { key: 'settings', label: 'Org settings' },
] as const;

export type SegmentKey = (typeof SEGMENTS)[number]['key'];
export const SEGMENT_KEYS = SEGMENTS.map((s) => s.key) as SegmentKey[];

// Scope governs reads (what you can see) and bounds writes:
//   none → no access · own → self only · team → managed people + responsible
//   customers/projects + self (today's "member" scope) · all → entire org.
export const SCOPES = [
  { key: 'none', label: 'No access' },
  { key: 'own', label: 'Own only' },
  { key: 'team', label: 'Team & responsible' },
  { key: 'all', label: 'Everyone' },
] as const;
export type Scope = (typeof SCOPES)[number]['key'];
export const SCOPE_KEYS = SCOPES.map((s) => s.key) as Scope[];

export const ACTIONS = ['create', 'edit', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export interface SegmentPerm {
  scope: Scope;
  create: boolean;
  edit: boolean;
  delete: boolean;
}
export type PermissionMatrix = Record<string, SegmentPerm>;

function perm(scope: Scope, create = false, edit = false, del = false): SegmentPerm {
  return { scope, create, edit, delete: del };
}

function allSegments(make: () => SegmentPerm): PermissionMatrix {
  const m: PermissionMatrix = {};
  for (const k of SEGMENT_KEYS) m[k] = make();
  return m;
}

export function emptyMatrix(): PermissionMatrix {
  return allSegments(() => perm('none'));
}

export interface SystemRoleDef {
  key: string;
  name: string;
  level: number;
  permissions: PermissionMatrix;
}

// Owner/admin: full control everywhere. Member: scoped reads + feedback writes
// for their people / responsible customers. Viewer: themselves only.
export const SYSTEM_ROLES: SystemRoleDef[] = [
  { key: 'owner', name: 'Owner', level: 4, permissions: allSegments(() => perm('all', true, true, true)) },
  { key: 'admin', name: 'Admin', level: 3, permissions: allSegments(() => perm('all', true, true, true)) },
  {
    key: 'member',
    name: 'Member',
    level: 2,
    permissions: {
      people: perm('team'),
      oneOnOne: perm('team', true, true, true),
      activity: perm('team', true, true, true),
      customers: perm('team'),
      planner: perm('team'),
      pmReview: perm('team', true, true, false),
      evaluations: perm('team'),
      skills: perm('all'),
      teams: perm('all'),
      members: perm('all'),
      settings: perm('none'),
    },
  },
  {
    key: 'viewer',
    name: 'Viewer',
    level: 1,
    permissions: {
      people: perm('own'),
      oneOnOne: perm('own'),
      activity: perm('own', true, true, true),
      customers: perm('none'),
      planner: perm('none'),
      pmReview: perm('none'),
      evaluations: perm('own'),
      skills: perm('own'),
      teams: perm('none'),
      members: perm('none'),
      settings: perm('none'),
    },
  },
];

export function systemRoleDef(key: string): SystemRoleDef | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key);
}

// Coerce arbitrary input into a complete, valid matrix (fills missing segments,
// clamps scope/booleans). Used when reading from the DB and when saving edits.
export function normalizeMatrix(input: unknown): PermissionMatrix {
  const out = emptyMatrix();
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    for (const seg of SEGMENT_KEYS) {
      const v = obj[seg];
      if (v && typeof v === 'object') {
        const e = v as Record<string, unknown>;
        const scope = (SCOPE_KEYS as string[]).includes(e.scope as string) ? (e.scope as Scope) : 'none';
        out[seg] = { scope, create: !!e.create, edit: !!e.edit, delete: !!e.delete };
      }
    }
  }
  return out;
}

export function scopeFor(matrix: PermissionMatrix, seg: SegmentKey): Scope {
  return matrix[seg]?.scope ?? 'none';
}

export function canDo(matrix: PermissionMatrix, seg: SegmentKey, action: Action): boolean {
  const e = matrix[seg];
  if (!e || e.scope === 'none') return false;
  return !!e[action];
}
