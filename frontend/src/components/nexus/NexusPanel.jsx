import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const VARIANT_STYLES = {
  cyan: {
    border: "border-cyan-500/40",
    glow: "shadow-[0_0_30px_rgba(34,211,238,0.12)]",
    corner: "border-cyan-400",
    badge: "text-cyan-400 bg-cyan-950/40 border-cyan-500/30",
  },
  red: {
    border: "border-red-500/40",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.12)]",
    corner: "border-red-400",
    badge: "text-red-400 bg-red-950/40 border-red-500/30",
  },
  amber: {
    border: "border-amber-500/40",
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.12)]",
    corner: "border-amber-400",
    badge: "text-amber-400 bg-amber-950/40 border-amber-500/30",
  },
  green: {
    border: "border-emerald-500/40",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.12)]",
    corner: "border-emerald-400",
    badge: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30",
  },
  neutral: {
    border: "border-zinc-800",
    glow: "shadow-[0_0_20px_rgba(0,0,0,0.5)]",
    corner: "border-zinc-600",
    badge: "text-zinc-400 bg-zinc-900 border-zinc-700",
  },
};

export default function NexusPanel({
  children,
  className = "",
  variant = "neutral",
  title,
  subtitle,
  icon: Icon,
  glow = false,
  cornerAccents = true,
  headerRight,
  onClick,
  ...props
}) {
  const shouldReduceMotion = useReducedMotion();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;

  const animationProps = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

  return (
    <motion.div
      {...animationProps}
      onClick={onClick}
      className={`relative rounded-2xl bg-zinc-950/85 backdrop-blur-xl border ${styles.border} ${
        glow ? styles.glow : ""
      } p-5 sm:p-6 transition-all duration-300 ${
        onClick ? "cursor-pointer hover:border-opacity-80" : ""
      } ${className}`}
      {...props}
    >
      {/* Sci-fi corner brackets */}
      {cornerAccents && (
        <>
          <span
            className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 ${styles.corner} rounded-tl-sm pointer-events-none opacity-80`}
          />
          <span
            className={`absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 ${styles.corner} rounded-tr-sm pointer-events-none opacity-80`}
          />
          <span
            className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 ${styles.corner} rounded-bl-sm pointer-events-none opacity-80`}
          />
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 ${styles.corner} rounded-br-sm pointer-events-none opacity-80`}
          />
        </>
      )}

      {/* Header if title or icon provided */}
      {(title || Icon || headerRight) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800/80 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${styles.badge}`}
              >
                <Icon size={18} />
              </div>
            )}
            {title && (
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            )}
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}

      {children}
    </motion.div>
  );
}
