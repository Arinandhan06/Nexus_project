import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const GLITCH_VARIANTS = {
  cyan: {
    color: "text-cyan-400",
    shadow: "drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]",
    splitRed: "text-red-500",
    splitCyan: "text-cyan-400",
  },
  red: {
    color: "text-red-500",
    shadow: "drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]",
    splitRed: "text-red-600",
    splitCyan: "text-cyan-400",
  },
  amber: {
    color: "text-amber-400",
    shadow: "drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]",
    splitRed: "text-red-400",
    splitCyan: "text-amber-300",
  },
  green: {
    color: "text-emerald-400",
    shadow: "drop-shadow-[0_0_12px_rgba(16,185,129,0.7)]",
    splitRed: "text-cyan-400",
    splitCyan: "text-emerald-300",
  },
  white: {
    color: "text-white",
    shadow: "drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]",
    splitRed: "text-red-400",
    splitCyan: "text-cyan-400",
  },
};

export default function GlitchText({
  children,
  text,
  as = "span",
  variant = "cyan",
  className = "",
  glitchFrequency = 0.15,
}) {
  const content = text || children;
  const shouldReduceMotion = useReducedMotion();
  const [isGlitching, setIsGlitching] = useState(false);
  const theme = GLITCH_VARIANTS[variant] || GLITCH_VARIANTS.cyan;

  useEffect(() => {
    if (shouldReduceMotion) return;

    const interval = setInterval(() => {
      if (Math.random() < glitchFrequency) {
        setIsGlitching(true);
        const timer = setTimeout(() => setIsGlitching(false), 120);
        return () => clearTimeout(timer);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [shouldReduceMotion, glitchFrequency]);

  if (shouldReduceMotion || !isGlitching) {
    return React.createElement(
      as,
      { className: `${theme.color} ${theme.shadow} ${className}` },
      content
    );
  }

  return React.createElement(
    as,
    { className: `relative inline-block ${theme.color} ${theme.shadow} ${className}` },
    <span key="base">{content}</span>,
    <span
      key="red"
      aria-hidden="true"
      className={`absolute top-0 left-0 ${theme.splitRed} opacity-70 pointer-events-none -translate-x-[1.5px] translate-y-[0.5px]`}
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 45%)" }}
    >
      {content}
    </span>,
    <span
      key="cyan"
      aria-hidden="true"
      className={`absolute top-0 left-0 ${theme.splitCyan} opacity-70 pointer-events-none translate-x-[1.5px] -translate-y-[0.5px]`}
      style={{ clipPath: "polygon(0 55%, 100% 55%, 100% 100%, 0 100%)" }}
    >
      {content}
    </span>
  );
}
