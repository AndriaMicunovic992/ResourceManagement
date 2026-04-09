export default function StatusBadge({ status, small }) {
  if (status !== 'potential') return null;
  return (
    <span className="font-mono font-bold text-warning bg-warning-bg border border-warning/20 rounded px-1.5 ml-1.5"
      style={{ fontSize: small ? 7 : 9 }}
    >
      {small ? 'POT' : 'POTENTIAL'}
    </span>
  );
}
