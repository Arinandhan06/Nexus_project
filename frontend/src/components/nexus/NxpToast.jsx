import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Flame, X } from "lucide-react";

export default function NxpToast({
  show,
  points = 0,
  multiplier = 1.0,
  streak = 0,
  message,
  onClose,
  autoCloseMs = 5000
}) {
  useEffect(() => {
    if (!show || autoCloseMs <= 0) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [show, autoCloseMs, onClose]);

  const formattedMultiplier = Number(multiplier || 1.0).toFixed(1);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed top-20 right-4 sm:right-8 z-50 max-w-sm w-full pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="relative overflow-hidden rounded-xl border border-cyan-400/50 bg-zinc-950/95 backdrop-blur-xl p-4 shadow-[0_0_30px_rgba(34,211,238,0.25)] font-mono">
            {/* Ambient neon scanline / top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400" />
            
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] shrink-0">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-widest uppercase text-cyan-400 font-bold">
                      NXP AWARD PROTOCOL
                    </span>
                    {streak > 1 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 border border-amber-500/40 text-amber-300">
                        <Flame size={10} className="text-amber-400 fill-amber-400/30" />
                        {streak}x
                      </span>
                    )}
                  </div>

                  {/* Main toast text required by prompt: "+250 NXP (streak x1.3)" */}
                  <div className="text-lg font-black tracking-wide text-white flex items-center gap-2 mt-0.5">
                    <span className="text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                      +{points} NXP
                    </span>
                    <span className="text-xs text-amber-300 font-semibold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30">
                      streak x{formattedMultiplier}
                    </span>
                  </div>

                  {message && (
                    <p className="text-xs text-zinc-400 mt-1 leading-snug">
                      {message}
                    </p>
                  )}
                </div>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
                  aria-label="Dismiss NXP award toast"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Timed progress indicator line */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: autoCloseMs / 1000, ease: "linear" }}
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400/60 origin-left"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
