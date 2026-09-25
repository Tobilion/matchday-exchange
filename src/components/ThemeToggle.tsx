import React from "react";
import { AppTheme } from "../hooks/useTheme";

interface ThemeToggleProps {
  theme: AppTheme;
  onChange: (theme: AppTheme) => void;
  compact?: boolean;
}

const OPTIONS: { id: AppTheme; label: string; dot: string; title: string }[] = [
  { id: "matte", label: "Matte", dot: "bg-[#0b0e14] border-white/30", title: "Matte black (default)" },
  { id: "navy", label: "Navy", dot: "bg-[#0d1530] border-blue-300/50", title: "Navy blue dark" },
  { id: "cream", label: "Cream", dot: "bg-[#f6f1e7] border-amber-900/30", title: "Cream light" },
];

/** Three-way theme switcher. Full labels on the entry screen, dot-only when compact (header). */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onChange, compact = false }) => {
  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1 ${
        compact ? "" : "w-fit"
      }`}
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              active
                ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className={`h-3 w-3 rounded-full border ${opt.dot}`} />
            {!compact && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
