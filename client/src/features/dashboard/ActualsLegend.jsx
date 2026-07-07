/**
 * Legend for the bullet heatmaps: what the track, tick, fill and label mean.
 * `showAct` toggles the actual-layer entries (they disappear when no hours
 * are synced, or while a team filter hides the layer on the client view).
 */
export default function ActualsLegend({ showAct = true }) {
  return (
    <span className="ml-2 inline-flex items-center gap-3 text-[9.5px] font-normal text-text-light whitespace-nowrap align-[1px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="relative inline-block w-[22px] h-[10px]">
          <i className="absolute inset-y-0 left-0 w-[17px] rounded-[3px]" style={{ background: '#E4E5FB' }} />
          <i className="absolute top-[-2px] left-[16px] w-[2.5px] h-[14px] rounded-sm" style={{ background: '#4d51c0' }} />
        </span>
        plan · tick = target
      </span>
      {showAct && (
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-[14px] h-[6px] rounded-[3px]"
            style={{ background: 'linear-gradient(100deg,#34C98E,color-mix(in srgb,#34C98E 78%,white))' }} />
          actual
        </span>
      )}
      {showAct && (
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-[14px] h-[6px] rounded-[3px]" style={{ background: '#CBD8E2' }} />
          in progress
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block w-[2.5px] h-[12px] rounded-sm" style={{ background: '#E8636F' }} />
        needs attention
      </span>
    </span>
  );
}
