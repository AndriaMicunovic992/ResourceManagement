import { useOrg } from '../contexts/OrgContext';

export default function OrgSwitcher() {
  const { currentOrg, orgs, switchOrg } = useOrg();

  if (!currentOrg || orgs.length <= 1) return null;

  return (
    <select
      value={currentOrg.id}
      onChange={(e) => switchOrg(e.target.value)}
      className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border border-white/20 outline-none cursor-pointer"
    >
      {orgs.map((org) => (
        <option key={org.id} value={org.id} className="text-text">{org.name}</option>
      ))}
    </select>
  );
}
