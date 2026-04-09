export default function StatCard({ icon, value, label, color }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl"
        style={{ backgroundColor: color + '15' }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-text-light font-semibold">{label}</div>
      </div>
    </div>
  );
}
