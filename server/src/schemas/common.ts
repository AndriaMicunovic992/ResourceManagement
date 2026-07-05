import { z } from 'zod';

// Shared field validators reused across schemas so validation can't drift.

// A month key: strictly "YYYY-MM" with a real month component (01–12). The old
// loose /^\d{4}-\d{2}$/ admitted "2026-00" / "2026-13" which then materialised
// as phantom, permanently-unfillable allocation keys.
export const monthKey = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format');

// A per-month FTE value: bounded to the same [0, 2] range the scalar `fte`
// field already enforces. 0 means "no allocation this month" (used to clear).
export const fteValue = z.number().min(0).max(2);

// Per-month FTE map on Assignment / Need. Keys must be valid months and values
// must be in range — without this a planner-edit role can persist negative /
// huge / garbage-keyed entries that corrupt every downstream utilization sum.
export const monthAllocations = z.record(monthKey, fteValue);

// A user-supplied URL that will be stored and later rendered into an href.
// Restricting the scheme to http(s) blocks stored-XSS via javascript:/data:
// URLs (which z.string().url() otherwise accepts).
export const httpUrl = (max = 500) =>
  z
    .string()
    .url()
    .max(max)
    .refine((v) => /^https?:\/\//i.test(v), { message: 'Must be an http(s) URL' });
