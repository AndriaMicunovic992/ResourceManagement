import { MONTHLY_HOURS_PER_FTE } from './constants';

/**
 * Absence-adjusted availability. Absences subtract from MAX capacity, and
 * they eat the person's SLACK (capacity − plan) first: while the hours left
 * after a leave still cover the plan, the expectation IS the plan. Only once
 * available hours fall below the plan does the expectation shrink — to the
 * available hours, spread pro-rata across the person's engagements
 * (deliverableRatio below).
 *
 * `typedMonth` is one person-month of per-work-type hours
 * ({ client?, internal?, absence? }); missing data means full availability,
 * so months without synced absences behave exactly as before.
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
 * The share of a person's total plan that still fits into their available
 * hours. 1 while the whole plan fits (absence only ate slack); below 1 the
 * shortfall is spread pro-rata across their engagements. Multiply any single
 * engagement's planned amount by this to get its expectation.
 */
export function deliverableRatio(planTotalHours, availH) {
  if (!(planTotalHours > 0.0001)) return 1;
  return Math.min(1, Math.max(0, availH) / planTotalHours);
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
