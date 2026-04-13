export const DOMAINS = {
  Data: { color: '#3B82F6', bg: '#EBF2FF', roles: ['FE', 'BE', 'PM'] },
  Web: { color: '#F97316', bg: '#FFF3E8', roles: ['FE', 'BE', 'PM'] },
  General: { color: '#8B5CF6', bg: '#F1ECFE', roles: ['Agent', 'DevOps', 'Sales', 'AI Engineer', 'Consultant', 'PM'] },
};

export const SENIORITIES = ['Junior', 'Medior', 'Senior', 'Senior Principal'];
export const SENIORITY_SHORT = { Junior: 'Jr', Medior: 'Mid', Senior: 'Sr', 'Senior Principal': 'SP' };
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const ACCENT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const CW = 82;  // Column width
export const LW = 270; // Label width
export const BH = 28;  // Bar height
export const RH = 42;  // Row height min

export const ALL_ROLES = [...new Set(Object.values(DOMAINS).flatMap((d) => d.roles))];

// FTE ↔ Hours conversion
export const YEARLY_WORKING_DAYS = 260;
export const MONTHLY_HOURS_PER_FTE = (YEARLY_WORKING_DAYS / 12) * 8; // ≈173.33

export function fteToHours(fte) {
  return Math.round(fte * MONTHLY_HOURS_PER_FTE);
}

export function hoursToFte(hours) {
  return Math.round((hours / MONTHLY_HOURS_PER_FTE) * 100) / 100;
}

export { SKILL_LEVELS, SKILL_LEVEL_LIST } from './skillLevels';
