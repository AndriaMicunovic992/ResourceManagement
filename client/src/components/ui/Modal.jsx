import { useEffect } from 'react';

export default function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-text/25 backdrop-blur-sm flex items-center justify-center z-[9000]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl p-7 max-h-[85vh] overflow-y-auto shadow-2xl border border-border ${wide ? 'min-w-[560px] max-w-[700px]' : 'min-w-[380px] max-w-[480px]'}`}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="m-0 text-lg font-bold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="bg-primary-light border-0 w-7 h-7 rounded-lg text-primary text-sm cursor-pointer flex items-center justify-center hover:opacity-80"
          >x</button>
        </div>
        {children}
      </div>
    </div>
  );
}
