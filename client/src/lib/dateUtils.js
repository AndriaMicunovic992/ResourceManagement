import { MONTHS } from './constants';

export function monthRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  const cur = new Date(start + '-01');
  const endDate = new Date(end + '-01');
  while (cur <= endDate) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
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
  const d = new Date(m + '-01');
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
