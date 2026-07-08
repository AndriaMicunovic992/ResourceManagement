import { WORK_TYPE_COLORS } from '../../lib/constants';

/**
 * The People-capacity work-type lens. `types` is one month's hours keyed by
 * work type ({ client?, internal?, absence? }); `filter` is 'work'
 * (client + internal — the default worked-time view), 'client', 'internal'
 * or 'absence'.
 *
 * Under the 'work' lens the stacked bar *shows* absences too (slate, after
 * the worked segments) so time off is visible right where it explains a plan
 * shortfall — but hoursForFilter (the Actual number) still counts worked time
 * only, so absences never inflate utilization.
 */
export function hoursForFilter(types, filter) {
  if (!types) return 0;
  if (filter === 'work') return (types.client || 0) + (types.internal || 0);
  return types[filter] || 0;
}

/** Stacked act segments (hours) for a month under the given lens. */
export function segmentsForFilter(types, filter) {
  if (!types) return [];
  const keys = filter === 'work' ? ['client', 'internal', 'absence'] : [filter];
  return keys
    .map((k) => ({ key: k, value: types[k] || 0, color: WORK_TYPE_COLORS[k] }))
    .filter((s) => s.value > 0);
}

/** Total stacked length (hours) — may exceed hoursForFilter when absences render. */
export function stackTotalForFilter(types, filter) {
  return segmentsForFilter(types, filter).reduce((s, seg) => s + seg.value, 0);
}

/** Legend swatch keys for the lens. */
export function typesForFilter(filter) {
  return filter === 'work' ? ['client', 'internal', 'absence'] : [filter];
}
