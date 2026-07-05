import { describe, it, expect } from 'vitest';
import { monthKey, fteValue, monthAllocations, httpUrl } from '../src/schemas/common.js';
import { upsertAssignmentSchema } from '../src/schemas/assignment.schema.js';
import { createLogSchema } from '../src/schemas/log.schema.js';
import { outboundUrlProblem } from '../src/utils/ssrf.js';

describe('monthKey', () => {
  it('accepts real months', () => {
    for (const m of ['2026-01', '2026-12', '1999-06']) {
      expect(monthKey.safeParse(m).success).toBe(true);
    }
  });
  it('rejects out-of-range and malformed months', () => {
    for (const m of ['2026-00', '2026-13', '2026-99', '2026-1', 'garbage', '2026/01', '']) {
      expect(monthKey.safeParse(m).success).toBe(false);
    }
  });
});

describe('fteValue', () => {
  it('accepts 0..2', () => {
    for (const v of [0, 0.5, 1, 2]) expect(fteValue.safeParse(v).success).toBe(true);
  });
  it('rejects negative and above-cap', () => {
    for (const v of [-0.1, -3, 2.01, 50, 1e308]) expect(fteValue.safeParse(v).success).toBe(false);
  });
});

describe('monthAllocations', () => {
  it('accepts a well-formed per-month map', () => {
    expect(monthAllocations.safeParse({ '2026-07': 0.5, '2026-08': 0 }).success).toBe(true);
  });
  it('rejects garbage keys, out-of-range values, and prototype-pollution keys', () => {
    expect(monthAllocations.safeParse({ 'not-a-month': 1 }).success).toBe(false);
    expect(monthAllocations.safeParse({ '2026-13': 1 }).success).toBe(false);
    expect(monthAllocations.safeParse({ '2026-07': -1 }).success).toBe(false);
    expect(monthAllocations.safeParse({ '2026-07': 99 }).success).toBe(false);
    expect(monthAllocations.safeParse(JSON.parse('{"__proto__":5,"2026-07":0.5}')).success).toBe(false);
  });
  it('is enforced by the assignment upsert schema', () => {
    const base = { needId: 'n1', resourceId: 'r1' };
    expect(upsertAssignmentSchema.safeParse({ ...base, monthAllocations: { '2026-07': 0.5 } }).success).toBe(true);
    expect(upsertAssignmentSchema.safeParse({ ...base, monthAllocations: { bad: -5 } }).success).toBe(false);
  });
});

describe('httpUrl', () => {
  const schema = httpUrl(500);
  it('accepts http(s) URLs', () => {
    expect(schema.safeParse('https://acme.atlassian.net/browse/AB-1').success).toBe(true);
    expect(schema.safeParse('http://jira.internal.example.com/x').success).toBe(true);
  });
  it('rejects javascript: and data: schemes (stored-XSS vectors)', () => {
    expect(schema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(schema.safeParse('data:text/html,<script>alert(1)</script>').success).toBe(false);
  });
  it('is enforced on the log jiraUrl field', () => {
    const ok = createLogSchema.safeParse({ content: 'x', kind: 'note', jiraUrl: 'https://x.atlassian.net/y' });
    const bad = createLogSchema.safeParse({ content: 'x', kind: 'note', jiraUrl: 'javascript:alert(1)' });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });
});

describe('outboundUrlProblem (SSRF guard)', () => {
  it('allows public http(s) hosts', () => {
    for (const u of ['https://acme.atlassian.net', 'https://jira.example.com:8443/x', 'http://example.org']) {
      expect(outboundUrlProblem(u)).toBeNull();
    }
  });
  it('blocks internal / reserved targets and non-http schemes', () => {
    for (const u of [
      'http://169.254.169.254/latest/meta-data/', // cloud metadata
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://10.0.0.5',
      'http://192.168.1.10',
      'http://172.16.0.1',
      'http://[::1]/',
      'file:///etc/passwd',
      'gopher://x',
      'not a url',
    ]) {
      expect(outboundUrlProblem(u)).not.toBeNull();
    }
  });
});
