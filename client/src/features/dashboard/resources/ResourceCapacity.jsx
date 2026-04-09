import DomainCards from './DomainCards';
import ResourceHeatmap from './ResourceHeatmap';

export default function ResourceCapacity({ onResourceClick }) {
  return (
    <div>
      <DomainCards />
      <ResourceHeatmap onResourceClick={onResourceClick} />
    </div>
  );
}
