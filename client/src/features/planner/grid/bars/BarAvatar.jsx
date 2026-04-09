import { initials } from '../../../../lib/resourceUtils';

export default function BarAvatar({ name, color }) {
  return (
    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white font-bold text-[9px] shrink-0 shadow-sm"
      style={{ backgroundColor: color }}>
      {initials(name)}
    </div>
  );
}
