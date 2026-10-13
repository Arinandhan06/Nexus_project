/**
 * NEXUS Pressure Engine (SCRUM-21)
 *
 * Computes psychological pressure level (0-3) based on time remaining,
 * failed attempts, and algorithmic inefficiency.
 * Synthesizes filtered brown noise fan audio using Web Audio API (capped master gain at 0.3).
 * Manages screen shake via CSS transform keyframes on the app root.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

/**
 * Pure function: calculates pressure level (0-3).
 *
 * Rules:
 * - Time under 25% left adds 1, under 10% adds 2
 * - Each failed attempt adds 1
 * - Inefficient result adds 1
 * - Capped at 3
 */
export function pressureLevel({
  secondsRemaining,
  totalSeconds,
  failedAttempts = 0,
  inefficient = false,
} = {}) {
  let score = 0;

  if (
    typeof totalSeconds === "number" &&
    totalSeconds > 0 &&
    typeof secondsRemaining === "number" &&
    secondsRemaining >= 0
  ) {
    const ratio = secondsRemaining / totalSeconds;
    if (ratio < 0.10) {
      score += 2;
    } else if (ratio < 0.25) {
      score += 1;
    }
  }

  score += Math.max(0, failedAttempts || 0);

  if (inefficient) {
    score += 1;
  }

  return Math.min(3, Math.max(0, score));
}

/**
 * Web Audio API Filtered Brown Noise Synthesizer.
 * Synthesizes a computer rack / server fan drone without audio files.
 * Master gain is strictly capped at 0.3.
 */
class BrownNoiseSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.source = null;
    this.filter = null;
    this.gainNode = null;
    this.masterGainLimit = 0.3;
  }

  init() {
    if (this.audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();

      // Generate 2-second looping brown noise buffer
      const sampleRate = this.audioCtx.sampleRate;
      const bufferSize = sampleRate * 2;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise integration
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }

      this.source = this.audioCtx.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;

      // Lowpass biquad filter around 320 Hz simulating heavy server cooling fans
      this.filter = this.audioCtx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.setValueAtTime(320, this.audioCtx.currentTime);

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);

      this.source.connect(this.filter);
      this.filter.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.source.start(0);
    } catch (_e) {
      void _e;
    }
  }

  setGain(targetGain) {
    if (!this.audioCtx || !this.gainNode) return;
    try {
      const clamped = Math.max(0, Math.min(this.masterGainLimit, targetGain));
      const now = this.audioCtx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(clamped, now + 0.3);
    } catch (_e) {
      void _e;
    }
  }

  update(level, soundEnabled) {
    if (!soundEnabled || level < 2) {
      if (this.gainNode) this.setGain(0);
      return;
    }
    this.init();
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    // Level 2: low fan sound (~0.12). Level 3: louder fan sound (~0.28, <= 0.3)
    const target = level === 2 ? 0.12 : 0.28;
    this.setGain(target);
  }

  suspend() {
    if (this.audioCtx && this.audioCtx.state === "running") {
      this.audioCtx.suspend().catch(() => {});
    }
  }

  resume(level, soundEnabled) {
    if (!soundEnabled || level < 2) return;
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().then(() => {
        this.update(level, soundEnabled);
      }).catch(() => {});
    }
  }

  cleanup() {
    try {
      if (this.source) this.source.stop();
      if (this.audioCtx) this.audioCtx.close();
    } catch (_e) {
      void _e;
    }
    this.audioCtx = null;
    this.source = null;
    this.filter = null;
    this.gainNode = null;
  }
}

const synthesizer = new BrownNoiseSynthesizer();

const PressureContext = createContext({
  pressure: 0,
  soundEnabled: false,
  reduceEffects: false,
  banterEnabled: true,
  isTabVisible: true,
  burstShake: false,
  setSoundEnabled: () => {},
  setReduceEffects: () => {},
  setBanterEnabled: () => {},
  triggerBurstShake: () => {},
});

export function PressureProvider({
  children,
  secondsRemaining,
  totalSeconds,
  failedAttempts = 0,
  inefficient = false,
}) {
  // Sound muted by default, remembered in localStorage
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    try {
      return localStorage.getItem("nexus_pressure_sound") === "true";
    } catch (_e) {
      void _e;
      return false;
    }
  });

  // Reduce effects toggle (checks prefers-reduced-motion or localStorage)
  const [reduceEffects, setReduceEffectsState] = useState(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return true;
      }
      return localStorage.getItem("nexus_reduce_effects") === "true";
    } catch (_e) {
      void _e;
      return false;
    }
  });

  // NEXUS banter toggle (on by default)
  const [banterEnabled, setBanterEnabledState] = useState(() => {
    try {
      const val = localStorage.getItem("nexus_banter_enabled");
      return val === null ? true : val === "true";
    } catch (_e) {
      void _e;
      return true;
    }
  });

  const [isTabVisible, setIsTabVisible] = useState(true);
  const [burstShake, setBurstShake] = useState(false);

  // Compute live pressure level (0-3)
  const currentPressure = pressureLevel({
    secondsRemaining,
    totalSeconds,
    failedAttempts,
    inefficient,
  });

  const setSoundEnabled = useCallback((enabled) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem("nexus_pressure_sound", enabled ? "true" : "false");
    } catch (_e) {
      void _e;
    }
  }, []);

  const setReduceEffects = useCallback((reduced) => {
    setReduceEffectsState(reduced);
    try {
      localStorage.setItem("nexus_reduce_effects", reduced ? "true" : "false");
    } catch (_e) {
      void _e;
    }
  }, []);

  const setBanterEnabled = useCallback((enabled) => {
    setBanterEnabledState(enabled);
    try {
      localStorage.setItem("nexus_banter_enabled", enabled ? "true" : "false");
    } catch (_e) {
      void _e;
    }
  }, []);

  const triggerBurstShake = useCallback(() => {
    if (reduceEffects) return;
    setBurstShake(true);
    setTimeout(() => {
      setBurstShake(false);
    }, 320);
  }, [reduceEffects]);

  // Apply CSS transform keyframe classes to the app root (#root)
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    if (reduceEffects || !isTabVisible) {
      root.classList.remove("nexus-pressure-shake", "nexus-shake-l3");
      return;
    }

    if (burstShake) {
      root.classList.add("nexus-pressure-shake");
    } else {
      root.classList.remove("nexus-pressure-shake");
    }

    if (currentPressure === 3) {
      root.classList.add("nexus-shake-l3");
    } else {
      root.classList.remove("nexus-shake-l3");
    }

    return () => {
      root.classList.remove("nexus-pressure-shake", "nexus-shake-l3");
    };
  }, [currentPressure, burstShake, reduceEffects, isTabVisible]);

  // Handle visibilitychange to pause audio and effects when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsTabVisible(visible);
      if (!visible) {
        synthesizer.suspend();
        setBurstShake(false);
      } else {
        synthesizer.resume(currentPressure, soundEnabled);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentPressure, soundEnabled]);

  // Update audio synthesis when pressure level or sound setting changes
  useEffect(() => {
    if (!isTabVisible) {
      synthesizer.suspend();
      return;
    }
    synthesizer.update(currentPressure, soundEnabled);
  }, [currentPressure, soundEnabled, isTabVisible]);

  // Cleanup synthesizer on unmount
  useEffect(() => {
    return () => {
      synthesizer.cleanup();
    };
  }, []);

  return React.createElement(
    PressureContext.Provider,
    {
      value: {
        pressure: currentPressure,
        soundEnabled,
        reduceEffects,
        banterEnabled,
        isTabVisible,
        burstShake,
        setSoundEnabled,
        setReduceEffects,
        setBanterEnabled,
        triggerBurstShake,
      },
    },
    children
  );
}

export function usePressure() {
  return useContext(PressureContext);
}
