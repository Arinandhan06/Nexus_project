import React from "react";

const BADGE_VARIANTS = {
  cyan: {
    badge: "bg-cyan-950/60 border-cyan-500/40 text-cyan-300",
    dot: "bg-cyan-400 shadow-[0_0_8px_#22d3ee]",
    label: "text-cyan-400/80",
    value: "text-white",
  },
  red: {
    badge: "bg-red-950/60 border-red-500/40 text-red-300",
    dot: "bg-red-400 shadow-[0_0_8px_#ef4444]",
    label: "text-red-400/80",
    value: "text-white",
  },
  amber: {
    badge: "bg-amber-950/60 border-amber-500/40 text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_8px_#f59e0b]",
    label: "text-amber-400/80",
    value: "text-white",
  },
  green: {
    badge: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_8px_#10b981]",
    label: "text-emerald-400/80",
    value: "text-white",
  },
  neutral: {
    badge: "bg-zinc-900/80 border-zinc-800 text-zinc-300",
    dot: "bg-zinc-500",
    label: "text-zinc-500",
    value: "text-zinc-200",
  },
};

export default function StatBadge({
  label,
  value,
  variant = "cyan",
  icon: Icon,
  size = "md",
  status,
  className = "",
}) {
  const styles = BADGE_VARIANTS[variant] || BADGE_VARIANTS.cyan;
  const isSm = size === "sm";

  return (
    <div
      className={`inline-flex items-center gap-2 border font-mono rounded-lg transition-colors ${
        styles.badge
      } ${isSm ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs sm:text-sm"} ${className}`}
    >
      {/* Glowing indicator dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />

      {Icon && <Icon size={isSm ? 12 : 14} className="shrink-0" />}

      {label && <span className={`uppercase tracking-wider ${styles.label}`}>{label}:</span>}

      {value !== undefined && (
        <span className={`font-bold tracking-tight ${styles.value}`}>{value}</span>
      )}

      {status && (
        <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/40 border border-white/10 ml-1">
          {status}
        </span>
      )}
    </div>
  );
}
