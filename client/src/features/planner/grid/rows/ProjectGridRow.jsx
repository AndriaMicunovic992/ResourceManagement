import { useMemo } from 'react';
import { CW } from '../../../../lib/constants';
import { monthRange } from '../../../../lib/dateUtils';
import { isProjectOk } from '../../../../lib/gridUtils';
import { useData } from '../../../../contexts/DataContext';

export default function ProjectGridRow({ project, months }) {
  const { needs, assignments } = useData();
  const ok = useMemo(() => isProjectOk(project, needs, assignments), [project, needs, assignments]);
  const projMonths = useMemo(() => monthRange(project.startMonth, project.endMonth), [project]);

  return (
    <div className="flex h-[34px]">
      {months.map((m) => {
        const inRange = projMonths.includes(m);
        const bg = inRange ? (ok ? '#EAFAF008' : '#F8FBFC') : 'transparent';
        return <div key={m} className="shrink-0 border-r border-border-light" style={{ width: CW, background: bg }} />;
      })}
    </div>
  );
}
