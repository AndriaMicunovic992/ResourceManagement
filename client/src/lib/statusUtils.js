export function utilColor(pct) {
  if (pct > 100) return '#E8636F';
  if (pct >= 80) return '#5BC68A';
  if (pct >= 50) return '#F5A623';
  if (pct > 0) return '#E8636F';
  return '#A0BCC9';
}

// The plan marker hue for the plan-vs-actual bullet/stacked bars — the vertical
// tick on the bar AND the "Planned" swatch in the hover tooltip. Kept in one
// place so the legend dot always matches the line it describes: a darkened
// accent normally, red when the plan needs attention (over capacity /
// understaffed), grey for a potential-only row.
export function planTickColor(accent = '#6366f1', { alert = false, muted = false } = {}) {
  if (alert) return '#E8636F';
  if (muted) return '#9CA3AF';
  return `color-mix(in srgb, ${accent} 82%, black)`;
}

export function utilBg(pct) {
  if (pct > 100) return '#FDE8EA';
  if (pct >= 80) return '#EAFAF0';
  if (pct >= 50) return '#FFF6E8';
  if (pct > 0) return '#FDE8EA';
  return 'transparent';
}

// Color for an actual value displayed against its plan: green when roughly on
// plan (85–115%), amber when meaningfully under, red when meaningfully over
// (burning more than planned). Actuals with no plan behind them are amber —
// unplanned work worth noticing.
export function actualVsPlanColor(actual, planned) {
  if (actual == null) return '#A0BCC9';
  if (!planned || planned <= 0) return actual > 0 ? '#F5A623' : '#A0BCC9';
  const ratio = actual / planned;
  if (ratio > 1.15) return '#E8636F';
  if (ratio < 0.85) return '#F5A623';
  return '#5BC68A';
}

// Color helpers for 1-5 evaluation scores.
export function scoreColor(score) {
  if (score == null) return '#A0BCC9';
  if (score >= 4.5) return '#2E7D4F'; // deep green
  if (score >= 3.5) return '#5BC68A'; // green
  if (score >= 2.5) return '#F5A623'; // amber
  if (score >= 1.5) return '#E8636F'; // red
  return '#B42318'; // deep red
}

export function scoreBg(score) {
  if (score == null) return 'transparent';
  if (score >= 4.5) return '#DCF3E4';
  if (score >= 3.5) return '#EAFAF0';
  if (score >= 2.5) return '#FFF6E8';
  if (score >= 1.5) return '#FDE8EA';
  return '#FBD5D1';
}

export function isRealised(item) {
  return item?.status === 'realised';
}

export function isPotential(item) {
  return item?.status === 'potential';
}
