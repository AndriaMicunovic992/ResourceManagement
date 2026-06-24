import Avatar from '../../../components/ui/Avatar';
import RoleBadge from '../../../components/badges/RoleBadge';
import { resourcePrimaryDomain, domainColor } from '../../../lib/resourceUtils';

export default function HeldResourceBanner({ resource, onDeselect }) {
  const color = domainColor(resourcePrimaryDomain(resource));

  return (
    <div className="m-3 p-3 rounded-xl border-2 border-primary"
      style={{ background: 'linear-gradient(135deg, #E0F4FA, white)' }}>
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar name={resource.name} color={color} size={36} />
        <div>
          <div className="font-bold text-sm text-text">{resource.name}</div>
          <div className="text-[10px] text-text-mid">Click a month cell to assign</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {resource.roles?.map((r, i) => (
          <RoleBadge key={i} domain={r.domain} role={r.role} seniority={r.seniority} small />
        ))}
      </div>
      <button onClick={onDeselect}
        className="w-full py-1 text-[10px] font-semibold text-primary bg-white border border-primary/30 rounded-full cursor-pointer hover:bg-primary-light active:scale-95 active:brightness-95 transition-all duration-100">
        ✕ Deselect
      </button>
    </div>
  );
}
