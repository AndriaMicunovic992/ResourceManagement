import { useOrg } from '../../contexts/OrgContext';

export default function SettingsView() {
  const { currentOrg, role } = useOrg();

  return (
    <div className="max-w-[600px] mx-auto px-5 py-6">
      <h2 className="text-xl font-bold text-text mb-6">Settings</h2>
      <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-text mb-3">Organization</h3>
        <div className="text-xs text-text-mid">
          <p><strong>Name:</strong> {currentOrg?.name}</p>
          <p className="mt-1"><strong>Your role:</strong> {role}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <h3 className="text-sm font-bold text-text mb-3">Members</h3>
        <p className="text-xs text-text-light">Member management coming soon.</p>
      </div>
    </div>
  );
}
