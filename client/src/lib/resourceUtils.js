import { seniorityLevel } from './taxonomy';

// Domain colors and seniority ordering come from the org's editable taxonomy.
export { domainColor, domainBg } from './taxonomy';

// Higher seniority can cover lower positions (Senior can fill a Medior need, etc.)
export function resourceMatchesNeed(resource, need) {
  const needLevel = seniorityLevel(need.seniority);
  return resource.roles?.some(
    (r) => r.domain === need.domain && r.role === need.role && seniorityLevel(r.seniority) >= needLevel
  );
}

export function resourcePrimaryDomain(resource) {
  return resource.roles?.[0]?.domain || 'Web';
}

export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function firstName(name) {
  return name?.split(' ')[0] || '';
}

export function shortName(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length < 2) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}
