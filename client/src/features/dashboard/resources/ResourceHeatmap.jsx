import ResourceHeatmapRow from './ResourceHeatmapRow';
import { formatMonth } from '../../../lib/dateUtils';
import { useData } from '../../../contexts/DataContext';

export default function ResourceHeatmap({ months, onResourceClick }) {
  const { resources } = useData();

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-auto">
      <h3 className="text-base font-bold text-text px-5 pt-4 pb-2">Capacity Heatmap</h3>
      <div className="flex items-center border-b-2 border-border sticky top-0 bg-white z-10">
        <div className="w-[270px] shrink-0 px-3 py-2">
          <span className="text-xs font-semibold text-text-mid">Name</span>
        </div>
        {months.map((m) => (
          <div key={m} className="w-[82px] shrink-0 text-center text-[10px] font-mono font-bold text-primary py-2">
            {formatMonth(m)}
          </div>
        ))}
      </div>
      {resources.map((r) => (
        <ResourceHeatmapRow key={r.id} resource={r} months={months} onClick={() => onResourceClick(r)} />
      ))}
    </div>
  );
}
