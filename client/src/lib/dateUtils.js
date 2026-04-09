import { MONTHS } from './constants';

// Pure arithmetic month range — no Date objects, no timezone issues
export function monthRange(start, end) {
  if (!start || !end) return [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const out = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function formatMonth(m) {
  if (!m) return '?';
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo) - 1]} '${y.slice(2)}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(m, n) {
  const [y, mo] = m.split('-').map(Number);
  const total = (y * 12 + (mo - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function monthToInput(m) {
  return m || '';
}

export function inputToMonth(val) {
  if (!val) return '';
  const d = new Date(val + '-01');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Group months into periods based on aggregation mode (M/Q/Y)
export function computePeriods(months, aggregation) {
  if (!months.length) return [];
  if (aggregation === 'M') {
    return months.map((m) => ({ label: formatMonth(m), months: [m] }));
  }
  const groups = {};
  for (const m of months) {
    const [y, mo] = m.split('-').map(Number);
    let key;
    if (aggregation === 'Q') {
      const q = Math.ceil(mo / 3);
      key = `Q${q} '${String(y).slice(2)}`;
    } else {
      key = String(y);
    }
    if (!groups[key]) groups[key] = { label: key, months: [] };
    groups[key].months.push(m);
  }
  return Object.values(groups);
}
