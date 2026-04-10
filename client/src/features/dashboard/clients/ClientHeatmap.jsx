import ClientHeatmapHeader from './ClientHeatmapHeader';
import CustomerHeatmapRow from './CustomerHeatmapRow';
import EmptyState from '../../../components/ui/EmptyState';
import { useData } from '../../../contexts/DataContext';

export default function ClientHeatmap({ months }) {
  const { customers } = useData();

  if (customers.length === 0) {
    return <EmptyState icon="🏢" message="No customers yet" />;
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-auto">
      <h3 className="text-base font-bold text-text px-5 pt-4 pb-2">Client Staffing</h3>
      <ClientHeatmapHeader months={months} />
      {customers.map((c, i) => (
        <CustomerHeatmapRow key={c.id} customer={c} index={i} months={months} />
      ))}
    </div>
  );
}
