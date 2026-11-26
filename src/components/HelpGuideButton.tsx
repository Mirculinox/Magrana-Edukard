import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface HelpGuideItem {
  label: string;
  description: string;
}

interface HelpGuideButtonProps {
  title: string;
  subtitle?: string;
  items: HelpGuideItem[];
  align?: 'left' | 'right';
  label?: string;
}

/**
 * Botón discreto de ayuda bajo demanda (?) idéntico al del resto de apps de Magrana.
 */
export const HelpGuideButton: React.FC<HelpGuideButtonProps> = ({
  title,
  subtitle,
  items,
  align = 'right',
  label,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`Ayuda: ${title}`}
        aria-label={`Ayuda: ${title}`}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-colors cursor-pointer text-xs font-bold ${
          open
            ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300'
            : 'bg-white/90 dark:bg-[#1F2D42] border-slate-300/80 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-amber-500/50'
        }`}
      >
        <HelpCircle size={16} />
        {label && <span className="hidden sm:inline">{label}</span>}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 z-[120] w-80 sm:w-96 rounded-2xl magrana-modal p-4 text-left animate-fade-in ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h4 className="text-sm font-black flex items-center gap-1.5 text-slate-900 dark:text-white">
                <HelpCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{title}</span>
              </h4>
              {subtitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Cerrar ayuda"
            >
              <X size={15} />
            </button>
          </div>

          <ul className="mt-3 space-y-2.5">
            {items.map((item, idx) => (
              <li key={idx} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                <strong className="text-amber-700 dark:text-amber-400 font-bold">{item.label}:</strong>{' '}
                <span className="text-slate-600 dark:text-slate-300">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
