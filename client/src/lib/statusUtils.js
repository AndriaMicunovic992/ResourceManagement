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

export function isRealised(item) {
  return item?.status === 'realised';
}

export function isPotential(item) {
  return item?.status === 'potential';
}
