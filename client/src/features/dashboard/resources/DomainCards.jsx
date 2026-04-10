import DomainCard from './DomainCard';

export default function DomainCards({ months, includePotential }) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <DomainCard domain="Data" months={months} includePotential={includePotential} />
      <DomainCard domain="Web" months={months} includePotential={includePotential} />
      <DomainCard domain="General" months={months} includePotential={includePotential} />
    </div>
  );
}
