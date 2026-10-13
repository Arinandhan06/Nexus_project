/**
 * PressureOverlay.jsx (SCRUM-21)
 *
 * Renders visual pressure feedback based on level (0-3):
 * - L0: Calm.
 * - L1: Faint red vignette.
 * - L2: Red tint overlay.
 * - L3: Stronger tint with edge accent lines.
 *
 * SAFETY GUARANTEES:
 * - Strictly operates via opacity to prevent layout reflows and guarantee 60fps.
 * - Never flashes > 3 times per second.
 * - When `reduceEffects` is true or `prefers-reduced-motion` is active:
 *   shake, scanlines, and bursts are completely stripped, retaining only a static, low-opacity red tint.
 * - Automatically hidden when tab is hidden (visibilitychange).
 */

import React from "react";
import { usePressure } from "../../lib/pressure";

export default function PressureOverlay({ className = "" }) {
  const { pressure = 0, reduceEffects = false, isTabVisible = true } = usePressure();

  // If tab is hidden or pressure is 0, render nothing
  if (!isTabVisible || pressure === 0) {
    return null;
  }

  // Reduced Effects mode: strictly static, low-opacity red tint only
  if (reduceEffects) {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-30 bg-red-900/10 transition-opacity duration-500"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-30 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* L1: Faint Red Vignette (radial gradient using opacity only) */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(239, 68, 68, 0) 55%, rgba(220, 38, 38, 0.28) 100%)",
          opacity: pressure >= 1 ? 1 : 0,
        }}
      />

      {/* L2 & L3: Red Tint Overlay (opacity only) */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out bg-red-950"
        style={{
          opacity: pressure === 2 ? 0.12 : pressure === 3 ? 0.22 : 0,
        }}
      />

      {/* L3 Edge Accent Lines */}
      {pressure === 3 && (
        <div className="absolute inset-0 border-2 border-red-500/25 pointer-events-none" />
      )}
    </div>
  );
}
