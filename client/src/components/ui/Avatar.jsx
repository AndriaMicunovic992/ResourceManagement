import { initials } from '../../lib/resourceUtils';

export default function Avatar({ name, color = '#4CBAD4', size = 36, className = '' }) {
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {initials(name)}
    </div>
  );
}
