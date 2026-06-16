import { domainColor, domainBg, seniorityShort } from '../../lib/taxonomy';

export default function RoleBadge({ domain, role, seniority, small, full }) {
  const d = { color: domainColor(domain), bg: domainBg(domain) };
  const senShort = seniority ? seniorityShort(seniority) : null;

  if (full) {
    return (
      <span
        className="inline-flex items-center rounded-md font-semibold whitespace-nowrap gap-1"
        style={{
          padding: '3px 10px',
          fontSize: 11,
          backgroundColor: d.bg,
          color: d.color,
        }}
      >
        <span>{domain}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>{role}</span>
        {seniority && (
          <>
            <span style={{ opacity: 0.6 }}>·</span>
            <span>{seniority}</span>
          </>
        )}
      </span>
    );
  }

  const abbr = domain?.slice(0, 3);
  return (
    <span
      className="inline-flex items-center rounded-md font-mono whitespace-nowrap"
      style={{
        padding: small ? '1px 5px' : '2px 8px',
        fontSize: small ? 9 : 10,
        backgroundColor: d.bg,
        color: d.color,
      }}
    >
      <span style={{ opacity: 0.5 }}>{abbr}</span>
      <span className="ml-0.5 font-semibold">{role}</span>
      {senShort && <span style={{ opacity: 0.4 }} className="ml-0.5">·{senShort}</span>}
    </span>
  );
}
