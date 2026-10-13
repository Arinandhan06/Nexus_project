/**
 * NexusTaunt.jsx (SCRUM-23)
 *
 * Antagonist code & performance taunt display:
 * - Red glitch text in terminal with typewriter effect.
 * - Accessibility: aria-live="polite".
 * - Controlled by "NEXUS banter" setting toggle.
 * - When Reduce effects / reduced motion is on, reveals text instantly without animation.
 */

import React, { useState, useEffect } from "react";
import GlitchText from "./GlitchText";
import { usePressure } from "../../lib/pressure";

export default function NexusTaunt({ text = "", className = "", onComplete }) {
  const { banterEnabled = true, reduceEffects = false } = usePressure();
  const [prevText, setPrevText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Adjust state directly during rendering when props change (standard React pattern)
  if (text !== prevText) {
    setPrevText(text);
    if (reduceEffects || !text || !banterEnabled) {
      setDisplayedText(text);
      setIsTyping(false);
    } else {
      setDisplayedText("");
      setIsTyping(true);
    }
  }

  useEffect(() => {
    if (!text || !banterEnabled || reduceEffects) {
      if (onComplete && text && banterEnabled) {
        onComplete();
      }
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayedText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
        if (onComplete) {
          onComplete();
        }
      }
    }, 25);

    return () => clearInterval(interval);
  }, [text, banterEnabled, reduceEffects, onComplete]);

  if (!banterEnabled || !text) {
    return null;
  }

  return (
    <div
      className={`my-2 p-3 rounded-lg border border-red-500/50 bg-red-950/40 backdrop-blur-sm text-red-400 font-mono text-xs flex items-start gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.15)] ${className}`}
      aria-live="polite"
      role="status"
    >
      <div className="shrink-0 flex items-center gap-1.5 text-red-500 font-bold select-none">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
        <span>[NEXUS]:</span>
      </div>

      <div className="flex-1 min-w-0 break-words leading-relaxed">
        <GlitchText variant="red" className="font-mono text-red-300">
          {displayedText}
        </GlitchText>
        {isTyping && (
          <span
            className="inline-block w-1.5 h-3.5 bg-red-500 ml-1 translate-y-0.5 animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
