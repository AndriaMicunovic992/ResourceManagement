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

// --- Planned absences (entered in the planner as days off per month) ---
// One day = 8 hours; a full 1.0-FTE month is MONTHLY_HOURS_PER_FTE / 8 ≈ 21.7
// working days. Planned days drive effective capacity when planning AHEAD;
// for elapsed months the synced Tempo absences above stay the truth.

export const HOURS_PER_WORKDAY = 8;
export const WORKDAYS_PER_MONTH = MONTHLY_HOURS_PER_FTE / HOURS_PER_WORKDAY;

export function plannedAbsenceDays(resource, month) {
  return (resource?.plannedAbsences || {})[month] || 0;
}

export function plannedAbsenceFte(resource, month) {
  return (plannedAbsenceDays(resource, month) * HOURS_PER_WORKDAY) / MONTHLY_HOURS_PER_FTE;
}

/** Capacity minus planned absence for the month — what's actually staffable. */
export function effectiveCapacity(resource, month) {
  return Math.max(0, (resource?.capacity ?? 1) - plannedAbsenceFte(resource, month));
}

/**
 * Availability ratio for expectations in a month that hasn't fully elapsed:
 * planned days off instead of (absent) synced hours. 1 = fully available.
 */
export function plannedAvailabilityRatio(resource, month) {
  const cap = resource?.capacity ?? 1;
  return cap > 0 ? effectiveCapacity(resource, month) / cap : 1;
}
