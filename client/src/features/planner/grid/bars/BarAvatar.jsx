import { memo } from 'react';
import { initials } from '../../../../lib/resourceUtils';

function BarAvatar({ name, color, size = 18 }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: color }}>
      {initials(name)}
    </div>
  );
}

// Pure presentational leaf — memoized so it doesn't re-render with the grid.
export default memo(BarAvatar);
