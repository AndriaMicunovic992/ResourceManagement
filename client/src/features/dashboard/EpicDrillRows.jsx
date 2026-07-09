import { useEffect, useMemo, useState } from 'react';
import BulletCell from './BulletCell';
import { TipRow } from './Tip';
import { formatMonth } from '../../lib/dateUtils';

/**
 * The two deepest drill levels shared by the Insights tables: the Jira epics
 * behind one row's logged hours, each expanding into its issues. No plan
 * exists at this depth — rows carry actual hours only, on a shared hour scale
 * (the caller's, or one computed from the loaded epics).
 *
 *  load     () => Promise<[{ key, name, months, issues: [{ key, description, months }] }]>
 *  loadKey  reruns the fetch when it changes (the load closure itself is
 *           recreated every render, so it can't be the dependency)
 *  tipPrefix  leads every tooltip title (person or customer name)
 */
export default function EpicDrillRows({ load, loadKey, months, cur, color, scaleMax = null, accent, tipPrefix }) {
  const [epics, setEpics] = useState(null);
  useEffect(() => {
    let dead = false;
    setEpics(null);
    load()
      .then((d) => { if (!dead) setEpics(Array.isArray(d) ? d : []); })
      .catch(() => { if (!dead) setEpics([]); });
    return () => { dead = true; };
  }, [loadKey]);

  // Without a caller-supplied scale (the client table works in FTE, not
  // hours), scale to the loaded epics themselves — floored like the people
  // breakdown so small values stay visibly small.
  const ownMax = useMemo(() => {
    let max = 40;
    for (const e of epics || []) for (const m of months) max = Math.max(max, e.months?.[m] || 0);
    return max;
  }, [epics, months]);
  const max = scaleMax ?? ownMax;

  if (epics == null) {
    return (
      <div className="flex items-center border-b border-border-light/50 bg-[#F6F9FC] pl-[80px] py-1.5 text-[10px] text-text-light">
        Loading epics…
      </div>
    );
  }
  if (epics.length === 0) {
    return (
      <div className="flex items-center border-b border-border-light/50 bg-[#F6F9FC] pl-[80px] py-1.5 text-[10px] text-text-light">
        No logged hours in this window.
      </div>
    );
  }
  return epics.map((e) => (
    <EpicRow key={e.key} epic={e} months={months} cur={cur}
      color={color} scaleMax={max} accent={accent} tipPrefix={tipPrefix} />
  ));
}

/* One epic — expands into its issues (already in the fetched data). */
function EpicRow({ epic, months, cur, color, scaleMax, accent, tipPrefix }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActRow
        level={2}
        name={epic.name}
        titleText={epic.name === epic.key ? epic.name : `${epic.name} (${epic.key})`}
        caret={epic.issues.length > 0}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        months={months} cur={cur}
        hoursByMonth={epic.months || {}}
        color={color} scaleMax={scaleMax} accent={accent}
        tipTitle={(m) => `${tipPrefix} · ${epic.name} · ${formatMonth(m)}`}
      />
      {open && epic.issues.map((i) => (
        <IssueRow key={i.key} issue={i} months={months} cur={cur}
          color={color} scaleMax={scaleMax} accent={accent} />
      ))}
    </>
  );
}

/* One issue — when the payload carries who logged it (the customer drill),
   it expands one level further into those people. */
function IssueRow({ issue, months, cur, color, scaleMax, accent }) {
  const [open, setOpen] = useState(false);
  const people = issue.people || [];
  return (
    <>
      <ActRow
        level={3}
        name={issue.key}
        desc={issue.description}
        titleText={issue.description ? `${issue.key} · ${issue.description}` : issue.key}
        caret={people.length > 0}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        months={months} cur={cur}
        hoursByMonth={issue.months || {}}
        color={color} scaleMax={scaleMax} accent={accent}
        tipTitle={(m) => `${issue.key} · ${formatMonth(m)}`}
      />
      {open && people.map((p) => (
        <ActRow key={p.resourceId}
          level={4}
          name={p.name}
          titleText={p.name}
          months={months} cur={cur}
          hoursByMonth={p.months || {}}
          color={color} scaleMax={scaleMax} accent={accent}
          tipTitle={(m) => `${p.name} · ${issue.key} · ${formatMonth(m)}`}
        />
      ))}
    </>
  );
}

/* An actuals-only drill row (epic, issue or person): no plan track at this
   depth, just the logged bar. */
function ActRow({ level, name, desc, titleText, caret = false, open = false, onToggle, months, cur, hoursByMonth, color, scaleMax, accent, tipTitle }) {
  const indent = level === 4 ? 'pl-[108px]' : level === 3 ? 'pl-[88px]' : 'pl-[68px]';
  const bg = level === 4 ? 'bg-[#EEF3F8]' : level === 3 ? 'bg-[#F2F6FA]' : 'bg-[#F6F9FC]';
  const total = months.reduce((s, m) => s + (hoursByMonth[m] || 0), 0);
  return (
    <div
      className={`flex items-center border-b border-border-light/50 ${bg} ${caret ? 'cursor-pointer hover:bg-[#EFF4F9]' : ''}`}
      onClick={caret ? onToggle : undefined}
    >
      <div className={`w-[270px] shrink-0 ${indent} pr-3 py-1 flex items-center gap-1.5 min-w-0`}>
        <span
          className={`text-[9px] w-2.5 shrink-0 transition-transform ${caret ? 'text-text-light' : 'text-transparent'}`}
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >▶</span>
        <span className="w-1.5 h-1.5 rounded-[2px] shrink-0" style={{ background: color }} />
        <span className="text-[10.5px] font-medium text-text-mid truncate shrink-0 max-w-[60%]" title={titleText}>{name}</span>
        {desc && <span className="text-[9.5px] text-text-light truncate" title={desc}>{desc}</span>}
        <span className="text-[9px] font-mono text-text-light ml-auto shrink-0">Σ {Math.round(total)}h</span>
      </div>
      {months.map((m) => {
        const act = m <= cur ? hoursByMonth[m] || 0 : null;
        const partial = m === cur;
        const tip = (act || 0) > 0 ? (
          <>
            <b className="text-[11px]">{tipTitle(m)}</b>
            <TipRow swatch={color} label="Logged" value={`${Math.round(act * 10) / 10}h${partial ? ' so far' : ''}`} />
            {desc && <div className="opacity-80 mt-0.5 max-w-[210px]">{desc}</div>}
            {partial && <div className="opacity-80">month in progress</div>}
          </>
        ) : null;
        return (
          <BulletCell key={m}
            plan={0}
            act={act}
            actSegments={act != null && act > 0 ? [{ value: act, color }] : null}
            max={scaleMax}
            accent={accent}
            inProgress={act != null && partial}
            labelAct={act != null && act > 0 ? `${Math.round(act)}h` : null}
            tip={tip}
          />
        );
      })}
    </div>
  );
}
