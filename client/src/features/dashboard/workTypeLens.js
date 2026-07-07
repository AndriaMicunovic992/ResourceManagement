import { WORK_TYPE_COLORS } from '../../lib/constants';

/**
 * The People-capacity work-type lens. `types` is one month's hours keyed by
 * work type ({ client?, internal?, absence? }); `filter` is 'work'
 * (client + internal — the default worked-time view), 'client', 'internal'
 * or 'absence'.
 */
export function hoursForFilter(types, filter) {
  if (!types) return 0;
  if (filter === 'work') return (types.client || 0) + (types.internal || 0);
  return types[filter] || 0;
}

/** Stacked act segments (hours) for a month under the given lens. */
export function segmentsForFilter(types, filter) {
  if (!types) return [];
  const keys = filter === 'work' ? ['client', 'internal'] : [filter];
  return keys
    .map((k) => ({ key: k, value: types[k] || 0, color: WORK_TYPE_COLORS[k] }))
    .filter((s) => s.value > 0);
}

/** Legend swatch keys for the lens. */
export function typesForFilter(filter) {
  return filter === 'work' ? ['client', 'internal'] : [filter];
}
