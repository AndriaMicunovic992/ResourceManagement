import { useMemo, useRef, useState } from 'react';
import NeedCell from '../cells/NeedCell';
import AssignmentBar from '../bars/AssignmentBar';
import { computeNeedFulfillment } from '../../../../lib/gridUtils';
import { resourceMatchesNeed } from '../../../../lib/resourceUtils';
import { monthRange } from '../../../../lib/dateUtils';
import { CW } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

export default function NeedGridRow({ need, project, months, periods, heldResource, rowHeight, onCellClick, onBarClick, onPaintNeed, onPaintAssign, onUndoable }) {
  const { assignments, resources } = useData();
  const nf = useMemo(() => computeNeedFulfillment(need, assignments), [need, assignments]);
  const needMonths = useMemo(() => {
    const s = need.startMonth || project.startMonth;
    const e = need.endMonth || project.endMonth;
    return monthRange(s, e);
  }, [need, project]);
  const visibleAssignments = useMemo(() => {
    const monthSet = new Set(months);
    return assignments.filter(
      (a) =>
        a.needId === need.id &&
        Object.entries(a.monthAllocations || {}).some(([m, v]) => v > 0 && monthSet.has(m))
    );
  }, [assignments, need.id, months]);

  const canHeldPlace = heldResource && resourceMatchesNeed(heldResource, need);
  const barH = 28;
  const barGap = 3;
  const height = rowHeight || 56;

  // Remaining gap per month (needed − filled) as fused runs of equal value —
  // rendered as a dashed "open" bar in its own stack slot below the bars.
  const gapRuns = useMemo(() => {
    const active = months
      .map((m, i) => ({
        i,
        v: Math.max(0, (nf[m]?.needed || 0) - (nf[m]?.filled || 0)),
        in: needMonths.includes(m),
      }))
      .filter((x) => x.in && x.v > 0.001);
    const runs = [];
    for (const x of active) {
      const last = runs[runs.length - 1];
      if (last && x.i === last.endI + 1 && Math.abs(x.v - last.v) < 0.005) last.endI = x.i;
      else runs.push({ startI: x.i, endI: x.i, v: x.v });
    }
    return runs;
  }, [months, nf, needMonths]);

  // Shared vertical stack: assignment bars first, then the gap bar slot.
  const slotCount = visibleAssignments.length + (gapRuns.length > 0 ? 1 : 0);
  const stackH = slotCount > 0 ? slotCount * (barH + barGap) - barGap : 0;
  const stackTop = Math.max(4, Math.round((height - stackH) / 2));

  // --- Paint-fill: drag across periods to set a value for the whole range.
  // A press without horizontal movement falls back to the classic cell click.
  const rowRef = useRef(null);
  const [paint, setPaint] = useState(null); // { startIdx, endIdx, moved, cellRect }
  // The browser fires a native click right after our pointerup handling; it
  // must not bubble to the grid wrapper, which closes popovers on click.
  const suppressClickRef = useRef(false);

  const periodIndexFromX = (clientX) => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left;
    let acc = 0;
    for (let i = 0; i < periods.length; i++) {
      acc += periods[i].months.length * CW;
      if (x < acc) return i;
    }
    return periods.length - 1;
  };

  const handlePointerDown = (idx) => (e) => {
    if (e.button !== 0) return;
    if (heldResource && !canHeldPlace) return; // role mismatch — nothing to paint
    rowRef.current?.setPointerCapture?.(e.pointerId);
    setPaint({
      startIdx: idx,
      endIdx: idx,
      moved: false,
      cellRect: e.currentTarget.getBoundingClientRect(),
    });
  };

  const handlePointerMove = (e) => {
    if (!paint) return;
    const i = periodIndexFromX(e.clientX);
    if (i !== paint.endIdx) setPaint((p) => ({ ...p, endIdx: i, moved: true }));
  };

  const handlePointerUp = (e) => {
    if (!paint) return;
    suppressClickRef.current = true;
    const { startIdx, endIdx, moved, cellRect } = paint;
    setPaint(null);
    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);

    if (!moved && lo === hi) {
      // Plain click — preserve the original behavior (auto-fill / popover).
      const p = periods[lo];
      const firstInRangeMonth = p.months.find((m) => needMonths.includes(m));
      const inRangeMonths = p.months.filter((m) => needMonths.includes(m));
      if (firstInRangeMonth) {
        onCellClick(need, firstInRangeMonth, inRangeMonths, {
          currentTarget: { getBoundingClientRect: () => cellRect },
        });
      }
      return;
    }

    const painted = periods.slice(lo, hi + 1).flatMap((p) => p.months);
    const pos = { x: e.clientX, y: e.clientY + 8 };
    if (heldResource && canHeldPlace) {
      const ms = painted.filter((m) => needMonths.includes(m));
      if (ms.length > 0) onPaintAssign?.(need, ms, pos);
    } else if (!heldResource) {
      // Spreadsheet model: painting freely extends the need; its start/end
      // (and the project's range) follow the allocations server-side.
      if (painted.length > 0) onPaintNeed?.(need, painted, pos);
    }
  };

  const inPaintRange = (i) =>
    paint && i >= Math.min(paint.startIdx, paint.endIdx) && i <= Math.max(paint.startIdx, paint.endIdx);

  return (
    <div
      ref={rowRef}
      className="flex relative overflow-hidden"
      style={{ minHeight: height }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setPaint(null)}
      onClick={(e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.stopPropagation();
        }
      }}
    >
      {periods.map((p, i) => {
        const periodInRange = p.months.some((m) => needMonths.includes(m));
        const needed = p.months.reduce((sum, m) => sum + (nf[m]?.needed || 0), 0) / p.months.length;
        const filled = p.months.reduce((sum, m) => sum + (nf[m]?.filled || 0), 0) / p.months.length;
        const firstInRangeMonth = p.months.find((m) => needMonths.includes(m));

        return (
          <NeedCell
            key={p.label}
            width={p.months.length * CW}
            needed={needed} filled={filled}
            inRange={periodInRange}
            canPlace={!heldResource ? undefined : canHeldPlace && periodInRange ? true : false}
            paintActive={inPaintRange(i)}
            qEnd={parseInt(p.months[p.months.length - 1].slice(5), 10) % 3 === 0}
            onPointerDown={handlePointerDown(i)}
          />
        );
      })}
      {/* The remaining gap as a dashed segmented "open" bar — also shown when
          a need is only PARTIALLY filled (the rest of the bar, in amber).
          Decorative — clicks and paint pass through. */}
      {gapRuns.length > 0 && (() => {
        const top = stackTop + visibleAssignments.length * (barH + barGap);
        return gapRuns.map((r, k) => {
          const prevContig = k > 0 && gapRuns[k - 1].endI === r.startI - 1;
          const nextContig = k < gapRuns.length - 1 && gapRuns[k + 1].startI === r.endI + 1;
          const left = r.startI * CW + (prevContig ? 0 : 5);
          const width = (r.endI - r.startI + 1) * CW - (prevContig ? 0 : 5) - (nextContig ? 0 : 5);
          return (
            <div
              key={k}
              className="absolute pointer-events-none flex items-center justify-center"
              style={{
                left, width, top, height: barH,
                border: '1.5px dashed #F5A623',
                borderLeft: prevContig ? '1px dashed #F5C872' : '1.5px dashed #F5A623',
                borderRadius: `${prevContig ? 0 : 999}px ${nextContig ? 0 : 999}px ${nextContig ? 0 : 999}px ${prevContig ? 0 : 999}px`,
                color: '#F5A623',
              }}
            >
              <span className="text-[9.5px] font-mono font-bold whitespace-nowrap">
                {r.v.toFixed(2)}
                {gapRuns.length === 1 && visibleAssignments.length === 0 ? ' FTE open' : ' open'}
              </span>
            </div>
          );
        });
      })()}
      {/* Assignment bars overlay — stack vertically centered in the row */}
      {visibleAssignments.map((a, idx) => {
        const resource = resources.find((r) => r.id === a.resourceId);
        if (!resource) return null;
        // Months where this person's TOTAL load (all projects) exceeds their
        // capacity — surfaced as a red tick on the bar.
        const cap = resource.capacity ?? 1;
        const own = assignments.filter((x) => x.resourceId === a.resourceId);
        const overloadMonths = new Set(
          months.filter(
            (m) => own.reduce((s, x) => s + ((x.monthAllocations || {})[m] || 0), 0) > cap + 0.001
          )
        );
        return (
          <div key={a.id} className="absolute left-0 right-0" style={{ top: stackTop + idx * (barH + barGap) }}>
            <AssignmentBar
              assignment={a} need={need} resource={resource} months={months}
              overloadMonths={overloadMonths}
              onUndoable={onUndoable}
              onClickSegment={(seg, month, e) => onBarClick(a, seg, month, e)}
            />
          </div>
        );
      })}
    </div>
  );
}
