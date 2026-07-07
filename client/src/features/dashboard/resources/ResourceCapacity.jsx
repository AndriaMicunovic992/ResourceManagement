import DomainCards from './DomainCards';
import ResourceHeatmap from './ResourceHeatmap';

export default function ResourceCapacity({ months, includePotential, teamId, actuals, onResourceClick }) {
  return (
    <div>
      <DomainCards months={months} includePotential={includePotential} teamId={teamId} />
      <ResourceHeatmap months={months} onResourceClick={onResourceClick} includePotential={includePotential} teamId={teamId} actuals={actuals} />
    </div>
  );
}
