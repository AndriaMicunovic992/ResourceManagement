import DomainCards from './DomainCards';
import ResourceHeatmap from './ResourceHeatmap';

export default function ResourceCapacity({ months, includePotential, teamId, actuals, workTypeFilter, onResourceClick }) {
  return (
    <div>
      <DomainCards months={months} includePotential={includePotential} teamId={teamId} actuals={actuals} />
      <ResourceHeatmap months={months} onResourceClick={onResourceClick} includePotential={includePotential}
        teamId={teamId} actuals={actuals} workTypeFilter={workTypeFilter} />
    </div>
  );
}
