import InfoDot from '../../../components/ui/InfoDot';

export default function StatCard({ icon, value, label, color, info, bar }) {
  return (
    <div className="bg-white rounded-2xl border border-border-light shadow-card px-4 py-3.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-text-mid">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px]"
          style={{ backgroundColor: color + '18', color }}
        >
          {icon}
        </span>
        {label}
        {info && <InfoDot text={info} className="ml-1" />}
      </div>
      <div className="mt-2 text-[22px] font-extrabold tracking-tight leading-none" style={{ color }}>{value}</div>
      {bar && <div className="mt-2">{bar}</div>}
    </div>
  );
}
