// Minimal Tempo Cloud client for pulling worklogs (the actual hours). Auth is a
// Bearer token (the Tempo API token, separate from Jira). Network calls can't
// run in CI; covered by tests against a mock server.

export interface TempoWorklog {
  tempoWorklogId: string;
  seconds: number;
  date: string; // "YYYY-MM-DD"
  accountId: string;
  issueId: string;
  description: string | null;
}

export class TempoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TempoError';
  }
}

const DEFAULT_BASE = process.env.TEMPO_BASE_URL || 'https://api.tempo.io/4';

export async function fetchWorklogs(
  token: string | null,
  from: string,
  to: string,
  baseUrl: string = DEFAULT_BASE
): Promise<TempoWorklog[]> {
  if (!token) throw new TempoError('Missing Tempo API token');
  const out: TempoWorklog[] = [];
  const limit = 50;
  let offset = 0;
  for (let page = 0; page < 500; page++) {
    const url = new URL(baseUrl.replace(/\/+$/, '') + '/worklogs');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    let res: Response;
    try {
      res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    } catch {
      throw new TempoError('Could not reach Tempo');
    }
    if (res.status === 401 || res.status === 403) throw new TempoError('Tempo rejected the API token', res.status);
    if (!res.ok) throw new TempoError(`Tempo request failed (${res.status})`, res.status);
    const data = (await res.json()) as { results?: any[] };
    const results = data.results || [];
    for (const w of results) {
      out.push({
        tempoWorklogId: String(w.tempoWorklogId),
        seconds: Number(w.timeSpentSeconds) || 0,
        date: w.startDate,
        accountId: w.author?.accountId || '',
        issueId: String(w.issue?.id ?? ''),
        description: w.description ?? null,
      });
    }
    if (results.length < limit) break;
    offset += limit;
  }
  return out;
}

export const tempoClient = { fetchWorklogs };
