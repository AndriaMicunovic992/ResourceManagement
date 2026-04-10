export default function HoverButtons({ onEdit, onDelete, size = 'default' }) {
  const sizeClass = size === 'small' ? 'w-5 h-5 text-[10px]' : size === 'medium' ? 'w-[22px] h-[22px] text-[11px]' : 'w-[26px] h-[26px] text-xs';
  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className={`${sizeClass} rounded flex items-center justify-center cursor-pointer border-0 bg-primary-light text-primary hover:brightness-95 active:scale-90 transition-all duration-100`}
        >
          ✎
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`${sizeClass} rounded flex items-center justify-center cursor-pointer border-0 bg-danger-bg text-danger hover:brightness-95 active:scale-90 transition-all duration-100`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
