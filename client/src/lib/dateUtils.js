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
