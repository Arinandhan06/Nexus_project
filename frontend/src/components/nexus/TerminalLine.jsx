import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const LINE_VARIANTS = {
  cyan: {
    prefix: "text-cyan-400 font-bold",
    text: "text-zinc-200",
    border: "border-cyan-500/30",
  },
  red: {
    prefix: "text-red-400 font-bold",
    text: "text-red-200",
    border: "border-red-500/30",
  },
  amber: {
    prefix: "text-amber-400 font-bold",
    text: "text-amber-200",
    border: "border-amber-500/30",
  },
  green: {
    prefix: "text-emerald-400 font-bold",
    text: "text-emerald-200",
    border: "border-emerald-500/30",
  },
  muted: {
    prefix: "text-zinc-500",
    text: "text-zinc-400",
    border: "border-zinc-800",
  },
};

export default function TerminalLine({
  prefix = ">",
  text = "",
  children,
  variant = "cyan",
  timestamp,
  typing = false,
  speed = 25,
  cursor = true,
  onComplete,
  className = "",
}) {
  const fullContent = typeof text === "string" && text.length > 0 ? text : typeof children === "string" ? children : "";
  const shouldReduceMotion = useReducedMotion();
  const [displayedText, setDisplayedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const style = LINE_VARIANTS[variant] || LINE_VARIANTS.cyan;

  useEffect(() => {
    if (shouldReduceMotion || !typing) {
      if (onComplete) onComplete();
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayedText(fullContent.slice(0, index));
      if (index >= fullContent.length) {
        clearInterval(interval);
        setIsTypingDone(true);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [fullContent, typing, speed, shouldReduceMotion, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={`font-mono text-xs sm:text-sm flex items-start gap-2.5 py-1 ${className}`}
    >
      {timestamp && (
        <span className="text-[10px] text-zinc-600 select-none shrink-0 mt-0.5">
          [{timestamp}]
        </span>
      )}
      {prefix && (
        <span className={`select-none shrink-0 ${style.prefix}`}>
          {prefix}
        </span>
      )}
      <div className={`flex-1 break-words ${style.text}`}>
        {typing && !shouldReduceMotion ? displayedText : children || fullContent}
        {typing && !shouldReduceMotion && cursor && !isTypingDone && (
          <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse align-middle" />
        )}
      </div>
    </motion.div>
  );
}
