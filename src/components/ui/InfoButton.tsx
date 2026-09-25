import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InfoButtonProps {
  title?: string;
  body?: React.ReactNode;
  /** When set, renders an inline tooltip instead of a full modal */
  text?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ title, body, text }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Inline tooltip mode (when `text` is provided)
  if (text !== undefined) {
    return (
      <div className="relative inline-flex items-center">
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="th-muted hover:th-sub transition-colors p-1"
          title="Tap for information"
        >
          <Info size={14} />
        </button>
        {isOpen && (
          <div className="absolute top-6 left-0 z-50 w-48 p-2 text-xs th-text th-solid2 border th-border2 rounded-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-emerald-400">Info</span>
              <button onClick={() => setIsOpen(false)} className="th-muted hover:th-text"><X size={12} /></button>
            </div>
            <p className="leading-tight th-sub">{text}</p>
          </div>
        )}
      </div>
    );
  }

  // Modal mode (default)
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className="w-4 h-4 rounded-full th-solid2 th-muted hover:th-text hover:th-track flex items-center justify-center transition-colors shrink-0"
        aria-label="Information"
      >
        <Info size={12} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 th-inset backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[#121620] border th-border rounded-2xl p-6 shadow-2xl z-10"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 th-muted hover:th-text transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Info size={20} />
                </div>
                <h3 className="text-lg font-bold th-text tracking-tight">{title}</h3>
              </div>
              
              <div className="text-sm th-sub leading-relaxed space-y-3">
                {body}
              </div>
              
              <div className="mt-6 pt-4 border-t th-border">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 th-wash hover:th-wash2 th-text rounded-xl font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
