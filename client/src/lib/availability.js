import { MONTHLY_HOURS_PER_FTE } from './constants';

/**
 * Absence-adjusted availability. Planning someone 1.0 on a client means "all
 * their working time", so synced absence hours shrink what any plan can
 * deliver that month. Expectations are judged against available hours —
 * plan × availabilityRatio — never against raw capacity.
 *
 * `typedMonth` is one person-month of per-work-type hours
 * ({ client?, internal?, absence? }); missing data means full availability,
 * so months without synced absences behave exactly as before. Future months
 * always ride at full capacity (no absence actuals exist yet, by decision).
 */
export function capacityHours(capacity) {
  return (capacity || 1) * MONTHLY_HOURS_PER_FTE;
}

export function absenceHours(typedMonth) {
  return typedMonth?.absence || 0;
}

export function availableHours(typedMonth, capacity) {
  return Math.max(0, capacityHours(capacity) - absenceHours(typedMonth));
}

export function availabilityRatio(typedMonth, capacity) {
  const cap = capacityHours(capacity);
  return cap > 0 ? availableHours(typedMonth, capacity) / cap : 1;
}

/**
 * The on/under/over verdict for an actual against an expectation, with the
 * shared ±15% band. Returns null when the expectation is too small to judge.
 */
export function verdictWord(actual, expected) {
  if (!(expected > 0.0001)) return null;
  const r = actual / expected - 1;
  return Math.abs(r) <= 0.15 ? 'on plan' : r < 0 ? 'under plan' : 'over plan';
}
