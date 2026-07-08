import DomainCard from './DomainCard';
import { useData } from '../../../contexts/DataContext';

/**
 * One summary card per taxonomy domain (not the hardcoded defaults — a custom
 * fourth domain gets its card too), led by an "Everyone" card so the row
 * always shows the whole picture. Auto-fit grid: 4 cards sit 4-across, more
 * wrap gracefully.
 */
export default function DomainCards({ months, includePotential, teamId, actuals }) {
  const { domains } = useData();
  const names = domains.length > 0 ? domains.map((d) => d.name) : ['Data', 'Web', 'General'];
  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
      <DomainCard domain={null} months={months} includePotential={includePotential} teamId={teamId} actuals={actuals} />
      {names.map((n) => (
        <DomainCard key={n} domain={n} months={months} includePotential={includePotential} teamId={teamId} actuals={actuals} />
      ))}
    </div>
  );
}
