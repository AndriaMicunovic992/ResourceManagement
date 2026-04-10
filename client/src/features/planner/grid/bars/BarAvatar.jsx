import { initials } from '../../../../lib/resourceUtils';

export default function BarAvatar({ name, color, size = 18 }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: color }}>
      {initials(name)}
    </div>
  );
}
