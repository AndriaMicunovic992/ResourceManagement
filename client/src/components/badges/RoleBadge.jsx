import { DOMAINS, SENIORITY_SHORT } from '../../lib/constants';

export default function RoleBadge({ domain, role, seniority, small, full }) {
  const d = DOMAINS[domain] || { color: '#6B8A9E', bg: '#F0F0F0' };
  const senShort = seniority ? SENIORITY_SHORT[seniority] : null;

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
