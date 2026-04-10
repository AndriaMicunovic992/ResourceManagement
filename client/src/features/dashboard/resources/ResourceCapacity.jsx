import DomainCards from './DomainCards';
import ResourceHeatmap from './ResourceHeatmap';

export default function ResourceCapacity({ months, onResourceClick }) {
  return (
    <div>
      <DomainCards />
      <ResourceHeatmap months={months} onResourceClick={onResourceClick} />
    </div>
  );
}
