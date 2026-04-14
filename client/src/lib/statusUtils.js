export function utilColor(pct) {
  if (pct > 100) return '#E8636F';
  if (pct >= 80) return '#5BC68A';
  if (pct >= 50) return '#F5A623';
  if (pct > 0) return '#E8636F';
  return '#A0BCC9';
}

export function utilBg(pct) {
  if (pct > 100) return '#FDE8EA';
  if (pct >= 80) return '#EAFAF0';
  if (pct >= 50) return '#FFF6E8';
  if (pct > 0) return '#FDE8EA';
  return 'transparent';
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
