import { useMemo, useCallback, useState, useEffect, Fragment } from 'react';
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

  // Live resize preview: { side, delta } tracks how many months to add/remove
  const [resizePreview, setResizePreview] = useState(null);

  // Keep the preview up until the refreshed assignment actually arrives —
  // clearing it on API response made the bar snap back to its old position
  // for a beat while the cache refetched.
  useEffect(() => {
    setResizePreview(null);
  }, [assignment]);

  // Compute how far we can extend/shrink in each direction
  const resizeLimits = useMemo(() => {
    const allocs = assignment.monthAllocations || {};
    const allMonths = Object.keys(allocs).sort();
    const activeMonths = allMonths.filter((m) => allocs[m] > 0);
    if (activeMonths.length === 0) return { maxExtendRight: 0, maxExtendLeft: 0, maxShrinkLeft: 0, maxShrinkRight: 0 };

    const needAllocs = need.monthAllocations || {};
    const otherAssigns = assignments.filter((a) => a.needId === need.id && a.id !== assignment.id);

    // Max extend right: only into months with remaining capacity
    const lastActive = activeMonths[activeMonths.length - 1];
    const lastFte = allocs[lastActive];
    const lastIdx = allMonths.indexOf(lastActive);
    let maxExtendRight = 0;
    for (let i = lastIdx + 1; i < allMonths.length; i++) {
      const m = allMonths[i];
      const needed = needAllocs[m] || 0;
      const otherFilled = otherAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
      if (otherFilled + lastFte <= needed) maxExtendRight++;
      else break;
    }

    // Max extend left: only into months with remaining capacity
    const firstActive = activeMonths[0];
    const firstFte = allocs[firstActive];
    const firstIdx = allMonths.indexOf(firstActive);
    let maxExtendLeft = 0;
    for (let i = firstIdx - 1; i >= 0; i--) {
      const m = allMonths[i];
      const needed = needAllocs[m] || 0;
      const otherFilled = otherAssigns.reduce((s, a) => s + ((a.monthAllocations || {})[m] || 0), 0);
      if (otherFilled + firstFte <= needed) maxExtendLeft++;
      else break;
    }

    return {
      maxExtendRight,
      maxExtendLeft,
      maxShrinkLeft: activeMonths.length - 1,
      maxShrinkRight: activeMonths.length - 1,
    };
  }, [assignment, need, assignments]);

  const handleResize = useCallback((side) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;

    const clamp = (delta) => {
      if (side === 'right') {
        return Math.max(-resizeLimits.maxShrinkRight, Math.min(delta, resizeLimits.maxExtendRight));
      }
      return Math.max(-resizeLimits.maxExtendLeft, Math.min(delta, resizeLimits.maxShrinkLeft));
    };

    const onMove = (moveE) => {
      setResizePreview({ side, delta: clamp(Math.round((moveE.clientX - startX) / CW)) });
    };

    const onUp = async (upE) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const delta = clamp(Math.round((upE.clientX - startX) / CW));
      if (delta === 0) { setResizePreview(null); return; }

      const allocs = assignment.monthAllocations || {};
      const allMonths = Object.keys(allocs).sort();
      const activeMonths = allMonths.filter((m) => allocs[m] > 0);
      const newAllocs = { ...allocs };

      if (side === 'right') {
        if (delta < 0) {
          activeMonths.slice(Math.max(1, activeMonths.length + delta)).forEach((m) => { newAllocs[m] = 0; });
        } else {
          const last = activeMonths[activeMonths.length - 1];
          const idx = allMonths.indexOf(last);
          for (let i = 1; i <= delta && idx + i < allMonths.length; i++) newAllocs[allMonths[idx + i]] = allocs[last];
        }
      } else {
        if (delta > 0) {
          activeMonths.slice(0, Math.min(delta, activeMonths.length - 1)).forEach((m) => { newAllocs[m] = 0; });
        } else {
          const first = activeMonths[0];
          const idx = allMonths.indexOf(first);
          for (let i = 1; i <= Math.abs(delta) && idx - i >= 0; i++) newAllocs[allMonths[idx - i]] = allocs[first];
        }
      }

      const prevAllocs = { ...allocs };
      try {
        await upsertAssignment({ needId: assignment.needId, resourceId: assignment.resourceId, monthAllocations: newAllocs });
        onUndoable?.(`Resized ${resource.name}`, () =>
          upsertAssignment({
            needId: assignment.needId,
            resourceId: assignment.resourceId,
            monthAllocations: prevAllocs,
          })
        );
        // Preview stays on until the updated assignment renders (effect above).
      } catch {
        setResizePreview(null); // request failed — snap back honestly
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [assignment, upsertAssignment, resizeLimits, onUndoable, resource.name]);

  if (segments.length === 0) return null;

  // Clip segments to the visible window: an assignment that started before
  // (or ends after) the current time range still renders its visible part —
  // previously a bar whose first month was out of view vanished entirely.
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

  const firstMonth = visibleSegments[0].start;
  const lastSeg = visibleSegments[visibleSegments.length - 1];
  const lastMonth = lastSeg.months[lastSeg.months.length - 1];
  const baseStartIdx = months.indexOf(firstMonth);
  const baseEndIdx = months.indexOf(lastMonth);
  if (baseStartIdx < 0) return null;

  // Span the full extent first→last visible month INCLUDING internal gaps (a
  // month covered by someone else), so the bar renders a real gap there instead
  // of bridging across it. Segments sit at their true month offset in this span.
  const baseSpanCount = baseEndIdx - baseStartIdx + 1;

  // Apply live resize preview offsets
  let displayStartIdx = baseStartIdx;
  let displaySpanCount = baseSpanCount;
  if (resizePreview) {
    if (resizePreview.side === 'left') {
      displayStartIdx = baseStartIdx + resizePreview.delta;
      displaySpanCount = baseSpanCount - resizePreview.delta;
    } else {
      displaySpanCount = baseSpanCount + resizePreview.delta;
    }
  }

  return (
    <div
      className="absolute flex items-center group/bar"
      style={{
        left: displayStartIdx * CW,
        top: 0,
        height: BAR_H,
        width: displaySpanCount * CW,
        transition: resizePreview ? 'none' : 'left 0.15s, width 0.15s',
      }}
    >
      <ResizeHandle side="left" onMouseDown={handleResize('left')} />
      {resizePreview ? (
        <div
          className="flex items-center gap-1 px-1 w-full"
          style={{ height: BAR_H, backgroundColor: color + '25', border: `1.5px solid ${color}50`, borderRadius: 12 }}
        >
          <span className="text-[9px] font-semibold truncate" style={{ color }}>{resource.name}</span>
          <div className="flex-1" />
          <span className="text-[8px] font-mono px-0.5 rounded shrink-0"
            style={{ backgroundColor: color + '15', color }}>{displaySpanCount}mo</span>
        </div>
      ) : (
        visibleSegments.map((seg, i) => {
          const prevSeg = visibleSegments[i - 1];
          const nextSeg = visibleSegments[i + 1];
          const gapBefore = prevSeg
            ? months.indexOf(seg.months[0]) - months.indexOf(prevSeg.months[prevSeg.months.length - 1]) - 1
            : 0;
          const gapAfter = nextSeg
            ? months.indexOf(nextSeg.months[0]) - months.indexOf(seg.months[seg.months.length - 1]) - 1
            : 0;
          const contLeft = i === 0 && clippedLeft;
          const contRight = i === visibleSegments.length - 1 && clippedRight;
          // A free (rounded) end: the bar's outer edge, or a side facing a gap.
          const roundLeft = (i === 0 && !clippedLeft) || gapBefore > 0;
          const roundRight = (i === visibleSegments.length - 1 && !clippedRight) || gapAfter > 0;
          return (
            <Fragment key={i}>
              {gapBefore > 0 && <div className="shrink-0 self-stretch" style={{ width: gapBefore * CW }} />}
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
            </Fragment>
          );
        })
      )}
      <ResizeHandle side="right" onMouseDown={handleResize('right')} />
      {!resizePreview && (
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
}
