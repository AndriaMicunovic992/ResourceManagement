import { useMemo, useState, useEffect } from 'react';
import AssignmentSegment from './AssignmentSegment';
import ResizeHandle from './ResizeHandle';
import { buildSegments } from '../../../../lib/gridUtils';
import { domainColor } from '../../../../lib/resourceUtils';
import { monthRange } from '../../../../lib/dateUtils';
import { CW } from '../../../../lib/constants';
import { useData } from '../../../../contexts/DataContext';

const BAR_H = 28;

export default function AssignmentBar({ assignment, need, resource, months, overloadMonths, onUndoable, onClickSegment }) {
  const { assignments, deleteAssignment, upsertAssignment } = useData();
  const segments = useMemo(() => buildSegments(assignment), [assignment]);
  const color = domainColor(need.domain);

  // Live resize preview for the dragged segment: { segIndex, newStartIdx, newEndIdx }.
  const [resizePreview, setResizePreview] = useState(null);

  // Keep the preview up until the refreshed assignment actually arrives —
  // clearing it on API response made the bar snap back for a beat.
  useEffect(() => {
    setResizePreview(null);
  }, [assignment]);

  if (segments.length === 0) return null;

  // Clip segments to the visible window: an assignment that started before
  // (or ends after) the current time range still renders its visible part.
  const monthSet = new Set(months);
  const visibleSegments = [];
  for (const seg of segments) {
    const vis = seg.months.filter((m) => monthSet.has(m));
    if (vis.length > 0) visibleSegments.push({ ...seg, months: vis, start: vis[0], full: seg });
  }
  if (visibleSegments.length === 0) return null;

  const allSegMonths = segments.flatMap((s) => s.months);
  const visibleMonths = visibleSegments.flatMap((s) => s.months);
  const clippedLeft = allSegMonths[0] !== visibleMonths[0];
  const clippedRight = allSegMonths[allSegMonths.length - 1] !== visibleMonths[visibleMonths.length - 1];

  const idxOf = (m) => months.indexOf(m);
  const firstMonth = visibleSegments[0].start;
  const lastSeg = visibleSegments[visibleSegments.length - 1];
  const lastMonth = lastSeg.months[lastSeg.months.length - 1];
  const baseStartIdx = idxOf(firstMonth);
  const baseEndIdx = idxOf(lastMonth);
  if (baseStartIdx < 0) return null;

  // Span the full extent first→last visible month INCLUDING internal gaps, so a
  // month covered by someone else renders as a real gap, not a bridged bar.
  const baseSpanCount = baseEndIdx - baseStartIdx + 1;

  const needAllocs = need.monthAllocations || {};
  const otherAssigns = assignments.filter((a) => a.needId === need.id && a.id !== assignment.id);

  // Resize ONE segment's free edge. Each segment grows/shrinks independently:
  // it can't cross an adjacent segment of the same bar and can only extend into
  // months that still have room (and are part of the need).
  const startSegResize = (segIndex, side) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const seg = visibleSegments[segIndex];
    const fte = seg.fte;
    const segStartIdx = idxOf(seg.months[0]);
    const segEndIdx = idxOf(seg.months[seg.months.length - 1]);
    const prevSeg = visibleSegments[segIndex - 1];
    const nextSeg = visibleSegments[segIndex + 1];

    const hasRoom = (i) => {
      const m = months[i];
      if (!m) return false;
      const needed = needAllocs[m] || 0;
      if (needed <= 0) return false;
      const otherFilled = otherAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
      return otherFilled + fte <= needed + 1e-9;
    };

    // How far this edge may travel: into adjacent free months with room, but
    // never onto/past the neighbouring segment.
    let lowestStart = segStartIdx;
    let highestEnd = segEndIdx;
    if (side === 'left') {
      const floor = prevSeg ? idxOf(prevSeg.months[prevSeg.months.length - 1]) + 1 : 0;
      for (let i = segStartIdx - 1; i >= floor; i--) { if (hasRoom(i)) lowestStart = i; else break; }
    } else {
      const ceil = nextSeg ? idxOf(nextSeg.months[0]) - 1 : months.length - 1;
      for (let i = segEndIdx + 1; i <= ceil; i++) { if (hasRoom(i)) highestEnd = i; else break; }
    }

    const resolve = (clientX) => {
      const delta = Math.round((clientX - startX) / CW);
      if (side === 'left') {
        const ns = Math.max(lowestStart, Math.min(segStartIdx + delta, segEndIdx));
        return { newStartIdx: ns, newEndIdx: segEndIdx };
      }
      const ne = Math.min(highestEnd, Math.max(segEndIdx + delta, segStartIdx));
      return { newStartIdx: segStartIdx, newEndIdx: ne };
    };

    const onMove = (mE) => setResizePreview({ segIndex, ...resolve(mE.clientX) });

    const onUp = async (uE) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const { newStartIdx, newEndIdx } = resolve(uE.clientX);
      if (newStartIdx === segStartIdx && newEndIdx === segEndIdx) { setResizePreview(null); return; }

      // Operate on the FULL segment (months may extend off the visible window):
      // a clipped bar still trims/keeps its off-screen part correctly.
      const fullMonths = seg.full.months;
      const fullFirst = fullMonths[0];
      const fullLast = fullMonths[fullMonths.length - 1];
      const allocs = assignment.monthAllocations || {};
      const newAllocs = { ...allocs };
      if (side === 'left') {
        const newStartMonth = months[newStartIdx];
        for (const m of fullMonths) if (m < newStartMonth) newAllocs[m] = 0;
        for (const m of monthRange(newStartMonth, fullLast)) newAllocs[m] = fte;
      } else {
        const newEndMonth = months[newEndIdx];
        for (const m of fullMonths) if (m > newEndMonth) newAllocs[m] = 0;
        for (const m of monthRange(fullFirst, newEndMonth)) newAllocs[m] = fte;
      }

      const prevAllocs = { ...allocs };
      try {
        await upsertAssignment({ needId: assignment.needId, resourceId: assignment.resourceId, monthAllocations: newAllocs });
        onUndoable?.(`Resized ${resource.name}`, () =>
          upsertAssignment({ needId: assignment.needId, resourceId: assignment.resourceId, monthAllocations: prevAllocs })
        );
        // Preview stays on until the updated assignment renders (effect above).
      } catch {
        setResizePreview(null); // request failed — snap back honestly
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      className="absolute group/bar"
      style={{ left: baseStartIdx * CW, top: 0, height: BAR_H, width: baseSpanCount * CW }}
    >
      {visibleSegments.map((seg, i) => {
        const prevSeg = visibleSegments[i - 1];
        const nextSeg = visibleSegments[i + 1];
        const segStartIdx = idxOf(seg.months[0]);
        const segEndIdx = idxOf(seg.months[seg.months.length - 1]);
        const gapBefore = prevSeg ? segStartIdx - idxOf(prevSeg.months[prevSeg.months.length - 1]) - 1 : 0;
        const gapAfter = nextSeg ? idxOf(nextSeg.months[0]) - segEndIdx - 1 : 0;
        const contLeft = i === 0 && clippedLeft;
        const contRight = i === visibleSegments.length - 1 && clippedRight;
        // A free (rounded) end: the bar's outer edge, or a side facing a gap.
        const roundLeft = (i === 0 && !clippedLeft) || gapBefore > 0;
        const roundRight = (i === visibleSegments.length - 1 && !clippedRight) || gapAfter > 0;
        const isLast = i === visibleSegments.length - 1;
        // Show a handle on free edges AND on clipped edges (a bar that runs off
        // the window can still have its visible start/end dragged).
        const showLeftHandle = roundLeft || contLeft;
        const showRightHandle = roundRight || contRight;

        // While dragging this segment's edge, render it at the previewed extent
        // so a shrink is just as visible as a stretch (the bar follows the
        // cursor instead of a ghost hiding inside the full-size bar).
        const preview = resizePreview && resizePreview.segIndex === i ? resizePreview : null;
        const showStartIdx = preview ? preview.newStartIdx : segStartIdx;
        const showEndIdx = preview ? preview.newEndIdx : segEndIdx;
        const left = (showStartIdx - baseStartIdx) * CW;
        const width = (showEndIdx - showStartIdx + 1) * CW;

        return (
          <div
            key={i}
            className="absolute"
            style={{ left, top: 0, height: BAR_H, width, transition: preview ? 'none' : 'left 0.12s ease, width 0.12s ease' }}
          >
            {/* A resize handle on every free edge — including the start of a
                second engagement after a gap, or an edge that runs off-window. */}
            {showLeftHandle && <ResizeHandle side="left" onMouseDown={startSegResize(i, 'left')} />}
            <AssignmentSegment
              segment={seg} resource={resource} domainColor={color}
              barHeight={BAR_H}
              roundLeft={roundLeft}
              roundRight={roundRight}
              showLabel={i === 0}
              contLeft={contLeft}
              contRight={contRight}
              overloadMonths={overloadMonths}
              totalSegments={visibleSegments.length}
              onClickMonth={(month, e) => { e.stopPropagation(); onClickSegment(seg, month, e); }}
            />
            {showRightHandle && <ResizeHandle side="right" onMouseDown={startSegResize(i, 'right')} />}
            {/* Duration readout sits INSIDE the bar so the row's clipping never
                hides it (it used to float above and get cut off). */}
            {preview && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm"
                  style={{ background: '#fff', color }}
                >
                  {showEndIdx - showStartIdx + 1} mo
                </span>
              </div>
            )}
            {isLast && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteAssignment(assignment.id); }}
                className="opacity-0 group-hover/bar:opacity-100 absolute -right-4 top-0 w-4 flex items-center justify-center text-[8px] text-danger bg-white/80 border-0 cursor-pointer rounded hover:bg-danger-bg transition-opacity"
                style={{ height: BAR_H }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
