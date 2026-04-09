import DomainCard from './DomainCard';

export default function DomainCards() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <DomainCard domain="Data" />
      <DomainCard domain="Web" />
      <DomainCard domain="General" />
    </div>
  );
}
