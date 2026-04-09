import { DOMAINS } from './constants';

export function resourceMatchesNeed(resource, need) {
  return resource.roles?.some(
    (r) => r.domain === need.domain && r.role === need.role && r.seniority === need.seniority
  );
}

export function resourcePrimaryDomain(resource) {
  return resource.roles?.[0]?.domain || 'Web';
}

export function domainColor(domain) {
  return DOMAINS[domain]?.color || '#6B8A9E';
}

export function domainBg(domain) {
  return DOMAINS[domain]?.bg || '#F0F0F0';
}

export function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function firstName(name) {
  return name?.split(' ')[0] || '';
}
