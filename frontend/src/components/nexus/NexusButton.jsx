import React from "react";
import { motion, useReducedMotion } from "framer-motion";

const BUTTON_VARIANTS = {
  cyan: "bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-zinc-950 font-bold border border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:shadow-[0_0_25px_rgba(34,211,238,0.55)] focus-visible:ring-cyan-400",
  red: "bg-red-500 hover:bg-red-400 active:bg-red-600 text-white font-bold border border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.35)] hover:shadow-[0_0_25px_rgba(239,68,68,0.55)] focus-visible:ring-red-400",
  amber: "bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 font-bold border border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_25px_rgba(245,158,11,0.55)] focus-visible:ring-amber-400",
  green: "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-bold border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.55)] focus-visible:ring-emerald-400",
  outline: "bg-zinc-950/70 hover:bg-zinc-900 active:bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-cyan-400 hover:text-cyan-400 focus-visible:ring-cyan-400 shadow-sm",
  ghost: "bg-transparent hover:bg-zinc-900/60 active:bg-zinc-800/80 text-zinc-400 hover:text-white border border-transparent focus-visible:ring-zinc-400",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-xs sm:text-sm rounded-xl gap-2",
  lg: "px-6 py-3.5 text-sm sm:text-base rounded-xl gap-2.5",
};

export default function NexusButton({
  children,
  variant = "cyan",
  size = "md",
  onClick,
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = "left",
  className = "",
  type = "button",
  ...props
}) {
  const shouldReduceMotion = useReducedMotion();
  const variantClass = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.cyan;
  const sizeClass = SIZES[size] || SIZES.md;

  const tapAnimation = shouldReduceMotion || disabled || loading
    ? {}
    : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      {...tapAnimation}
      className={`inline-flex items-center justify-center font-mono uppercase tracking-wider transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 select-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {!loading && Icon && iconPosition === "left" && (
        <Icon size={size === "sm" ? 14 : size === "lg" ? 18 : 16} className="shrink-0" />
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === "right" && (
        <Icon size={size === "sm" ? 14 : size === "lg" ? 18 : 16} className="shrink-0" />
      )}
    </motion.button>
  );
}
