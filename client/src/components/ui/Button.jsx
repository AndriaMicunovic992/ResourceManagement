export default function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = variant === 'primary'
    ? 'px-5 py-2 bg-primary text-white rounded-full font-bold text-xs cursor-pointer shadow-card hover:brightness-110 active:scale-95 active:brightness-95 transition-all duration-100'
    : 'px-5 py-2 bg-white text-text-mid border border-border rounded-full font-semibold text-xs cursor-pointer hover:bg-primary-bg active:scale-95 active:bg-primary-light transition-all duration-100';
  return (
    <button className={`${base} ${className}`} {...props}>
      {children}
    </button>
  );
}
