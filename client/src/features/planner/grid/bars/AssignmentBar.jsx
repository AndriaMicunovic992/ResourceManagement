import { useMemo, useState, useEffect, Fragment } from 'react';
import AssignmentSegment from './AssignmentSegment';
import ResizeHandle from './ResizeHandle';
import { buildSegments } from '../../../../lib/gridUtils';
import { domainColor } from '../../../../lib/resourceUtils';
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
    if (vis.length > 0) visibleSegments.push({ ...seg, months: vis, start: vis[0] });
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

      const allocs = assignment.monthAllocations || {};
      const newAllocs = { ...allocs };
      for (let i = segStartIdx; i <= segEndIdx; i++) newAllocs[months[i]] = 0;
      for (let i = newStartIdx; i <= newEndIdx; i++) newAllocs[months[i]] = fte;

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
      className="absolute flex items-center group/bar"
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
        return (
          <Fragment key={i}>
            {gapBefore > 0 && <div className="shrink-0 self-stretch" style={{ width: gapBefore * CW }} />}
            <div className="relative shrink-0" style={{ height: BAR_H }}>
              {/* A resize handle on every free edge — including the start of a
                  second engagement after a gap. */}
              {roundLeft && <ResizeHandle side="left" onMouseDown={startSegResize(i, 'left')} />}
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
              {roundRight && <ResizeHandle side="right" onMouseDown={startSegResize(i, 'right')} />}
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
          </Fragment>
        );
      })}
      {/* Ghost of the new extent while dragging a segment edge. */}
      {resizePreview && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: (resizePreview.newStartIdx - baseStartIdx) * CW,
            width: (resizePreview.newEndIdx - resizePreview.newStartIdx + 1) * CW,
            top: 0,
            height: BAR_H,
            border: `1.5px dashed ${color}`,
            borderRadius: 12,
            background: color + '22',
          }}
        />
      )}
    </div>
  );
}
