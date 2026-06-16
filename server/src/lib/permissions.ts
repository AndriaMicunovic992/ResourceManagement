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
// Reach of a role's access within a segment (only meaningful when view is on).
export const SCOPES = [
  { key: 'own', label: 'Own only' },
  { key: 'team', label: 'Team & responsible' },
  { key: 'all', label: 'Everyone' },
] as const;
export type Scope = (typeof SCOPES)[number]['key'];
export const SCOPE_KEYS = SCOPES.map((s) => s.key) as Scope[];

export const ACTIONS = ['create', 'edit', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export interface SegmentPerm {
  // view is the read gate; scope is how much they can see; create/edit/delete
  // are writes (all require view).
  scope: Scope;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}
export type PermissionMatrix = Record<string, SegmentPerm>;

function perm(scope: Scope, view = true, create = false, edit = false, del = false): SegmentPerm {
  return { scope, view, create, edit, delete: del };
}

function allSegments(make: () => SegmentPerm): PermissionMatrix {
  const m: PermissionMatrix = {};
  for (const k of SEGMENT_KEYS) m[k] = make();
  return m;
}

export function emptyMatrix(): PermissionMatrix {
  return allSegments(() => perm('own', false));
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
  { key: 'owner', name: 'Owner', level: 4, permissions: allSegments(() => perm('all', true, true, true, true)) },
  { key: 'admin', name: 'Admin', level: 3, permissions: allSegments(() => perm('all', true, true, true, true)) },
  {
    key: 'member',
    name: 'Member',
    level: 2,
    permissions: {
      people: perm('team'),
      oneOnOne: perm('team', true, true, true, true),
      activity: perm('team', true, true, true, true),
      customers: perm('team'),
      planner: perm('team'),
      pmReview: perm('team', true, true, true, false),
      evaluations: perm('team'),
      skills: perm('all'),
      teams: perm('all'),
      members: perm('all'),
      settings: perm('own', false),
    },
  },
  {
    key: 'viewer',
    name: 'Viewer',
    level: 1,
    permissions: {
      people: perm('own'),
      oneOnOne: perm('own'),
      activity: perm('own', true, true, true, true),
      customers: perm('own', false),
      planner: perm('own', false),
      pmReview: perm('own', false),
      evaluations: perm('own'),
      skills: perm('own'),
      teams: perm('own', false),
      members: perm('own', false),
      settings: perm('own', false),
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
        const rawScope = e.scope as string;
        const scope = (SCOPE_KEYS as string[]).includes(rawScope) ? (rawScope as Scope) : 'own';
        // Back-fill `view` from the older scope-only shape (scope 'none' = no view).
        const view = e.view !== undefined ? !!e.view : rawScope !== 'none';
        out[seg] = { scope, view, create: !!e.create, edit: !!e.edit, delete: !!e.delete };
      }
    }
  }
  return out;
}

export function scopeFor(matrix: PermissionMatrix, seg: SegmentKey): Scope {
  return matrix[seg]?.scope ?? 'own';
}

/** Can the role read this segment at all? */
export function canView(matrix: PermissionMatrix, seg: SegmentKey): boolean {
  return !!matrix[seg]?.view;
}

/** Can the role perform a write action? Requires view + the action flag. */
export function canDo(matrix: PermissionMatrix, seg: SegmentKey, action: Action): boolean {
  const e = matrix[seg];
  if (!e || !e.view) return false;
  return !!e[action];
}

// Legacy 1-4 role rank, used as the visibility/gate fallback while enforcement
// migrates onto the matrix.
export const LEGACY_ROLE_LEVEL: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export type Tier = 'admin' | 'member' | 'viewer';

/** Coarse visibility tier a role's level maps to (owner & admin both see all). */
export function tierForLevel(level: number): Tier {
  if (level >= 3) return 'admin';
  if (level <= 1) return 'viewer';
  return 'member';
}
