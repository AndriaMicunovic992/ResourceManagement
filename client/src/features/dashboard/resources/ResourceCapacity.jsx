import DomainCards from './DomainCards';
import ResourceHeatmap from './ResourceHeatmap';

export default function ResourceCapacity({ months, includePotential, onResourceClick }) {
  return (
    <div>
      <DomainCards months={months} includePotential={includePotential} />
      <ResourceHeatmap months={months} onResourceClick={onResourceClick} includePotential={includePotential} />
    </div>
  );
}
