export default function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = variant === 'primary'
    ? 'px-5 py-2 bg-primary text-white rounded-full font-bold text-xs cursor-pointer shadow-card hover:opacity-90 transition'
    : 'px-5 py-2 bg-white text-text-mid border border-border rounded-full font-semibold text-xs cursor-pointer hover:bg-primary-bg transition';
  return (
    <button className={`${base} ${className}`} {...props}>
      {children}
    </button>
  );
}
