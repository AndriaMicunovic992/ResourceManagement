// Live role-taxonomy registry.
//
// The domain/role/seniority taxonomy is org-scoped and editable (managed in
// Settings, served by GET /api/taxonomy). DataContext hydrates this registry on
// load via setTaxonomy(). The pure lookup helpers below read the live registry,
// so the many components that only need a color or a short label don't have to
// thread a hook through — they re-render on the next DataContext update.
//
// Built-in defaults seed the registry before the first load and act as a
// fallback for any name not present in the org's taxonomy.
import { DOMAINS as DEFAULT_DOMAINS, SENIORITIES as DEFAULT_SENIORITIES, SENIORITY_SHORT as DEFAULT_SHORT } from './constants';

const FALLBACK_COLOR = '#6B8A9E';
const FALLBACK_BG = '#F0F0F0';

// Blend a hex color toward white to get a light badge background.
function lightTint(hex, ratio = 0.88) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return FALLBACK_BG;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  const to2 = (c) => c.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

function build(domains, seniorities) {
  const colorByDomain = {};
  const bgByDomain = {};
  for (const d of domains) {
    colorByDomain[d.name] = d.color;
    bgByDomain[d.name] = lightTint(d.color);
  }
  const shortBySeniority = {};
  const levelBySeniority = {};
  const fullByShort = {};
  seniorities.forEach((s, i) => {
    shortBySeniority[s.name] = s.shortLabel;
    levelBySeniority[s.name] = s.level ?? i;
    fullByShort[s.shortLabel] = s.name;
  });
  return { domains, seniorities, colorByDomain, bgByDomain, shortBySeniority, levelBySeniority, fullByShort };
}

function fromDefaults() {
  const domains = Object.entries(DEFAULT_DOMAINS).map(([name, d], i) => ({
    name,
    color: d.color,
    sortOrder: i,
    roles: d.roles.map((r) => ({ name: r })),
  }));
  const seniorities = DEFAULT_SENIORITIES.map((name, i) => ({
    name,
    shortLabel: DEFAULT_SHORT[name] || name,
    level: i,
  }));
  return build(domains, seniorities);
}

let registry = fromDefaults();

export function setTaxonomy(domains, seniorities) {
  if (!Array.isArray(domains) || !Array.isArray(seniorities)) return;
  registry = build(domains, seniorities);
}

export function domainColor(name) {
  return registry.colorByDomain[name] || FALLBACK_COLOR;
}

export function domainBg(name) {
  return registry.bgByDomain[name] || FALLBACK_BG;
}

export function seniorityShort(name) {
  return registry.shortBySeniority[name] || name;
}

export function seniorityLevel(name) {
  const l = registry.levelBySeniority[name];
  return l === undefined ? -1 : l;
}

/** Map a short seniority label (e.g. "Mid") back to its full name. */
export function seniorityFromShort(short) {
  return registry.fullByShort[short] || short;
}

export function taxonomyDomains() {
  return registry.domains;
}

export function taxonomySeniorities() {
  return registry.seniorities;
}
