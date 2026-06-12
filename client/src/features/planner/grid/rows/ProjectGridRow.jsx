import { useMemo } from 'react';
import { CW } from '../../../../lib/constants';
import { monthRange } from '../../../../lib/dateUtils';

export default function ProjectGridRow({ project, periods }) {
  const projMonths = useMemo(() => monthRange(project.startMonth, project.endMonth), [project]);

  return (
    <div className="flex h-[34px]">
      {periods.map((p) => {
        return <div key={p.label} className="shrink-0" style={{ width: p.months.length * CW }} />;
      })}
    </div>
  );
}
