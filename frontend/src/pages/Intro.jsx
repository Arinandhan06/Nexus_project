import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX, FastForward, Shield, Terminal, ArrowRight } from "lucide-react";
import api from "../lib/api";
import Galaxy from "../components/Galaxy";
import { NexusButton, GlitchText } from "../components/nexus";

const TOTAL_BEATS = 5;
const BEAT_DURATION_MS = 7000; // ~35s total for 5 beats

export default function Intro({ onIntroComplete }) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [currentBeat, setCurrentBeat] = useState(1);
  const [userData, setUserData] = useState({ username: "CADET-7", weakestAxis: "Data Structures & Algorithms" });
  const [isMuted, setIsMuted] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Web Audio API Synth Hum
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const osc1Ref = useRef(null);
  const osc2Ref = useRef(null);

  // Fetch /me and /profile/matrix for personalization
  useEffect(() => {
    let isMounted = true;
    const fetchPersonalization = async () => {
      try {
        const [meRes, matrixRes] = await Promise.allSettled([
          api.get("/me"),
          api.get("/profile/matrix"),
        ]);

        if (!isMounted) return;

        let username = "CADET-7";
        if (meRes.status === "fulfilled" && meRes.value?.data) {
          username = meRes.value.data.github_username || meRes.value.data.display_name || "CADET-7";
        }

        let weakestAxis = "Data Structures & Algorithms";
        if (matrixRes.status === "fulfilled" && matrixRes.value?.data) {
          const m = matrixRes.value.data;
          const scores = [
            { name: "Data Structures & Algorithms", score: m.dsa ?? 35 },
            { name: "System Design & Architecture", score: m.system_design ?? 35 },
            { name: "Code Cleanliness & Refactoring", score: m.cleanliness ?? 35 },
          ];
          scores.sort((a, b) => a.score - b.score);
          weakestAxis = scores[0].name;
        }

        setUserData({ username, weakestAxis });
      } catch (err) {
        console.warn("Intro personalization fallback:", err);
      }
    };

    fetchPersonalization();
    return () => {
      isMounted = false;
    };
  }, []);

  // Web Audio Setup
  const initAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Low pass filter
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(220, ctx.currentTime);
      filter.connect(masterGain);

      // Sub-bass Oscillator (55Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(55, ctx.currentTime);
      osc1.connect(filter);
      osc1.start();
      osc1Ref.current = osc1;

      // Detuned Oscillator (55.4Hz) for rich analog drone beat
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(55.4, ctx.currentTime);
      osc2.connect(filter);
      osc2.start();
      osc2Ref.current = osc2;
    } catch (e) {
      console.warn("Web Audio initialization skipped:", e);
    }
  };

  const toggleAudio = () => {
    initAudio();
    if (!audioCtxRef.current || !gainNodeRef.current) return;

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    if (isMuted) {
      gainNodeRef.current.gain.linearRampToValueAtTime(0.12, audioCtxRef.current.currentTime + 0.3);
      setIsMuted(false);
    } else {
      gainNodeRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.2);
      setIsMuted(true);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Complete and transition to Safehouse
  const handleComplete = useCallback(async () => {
    if (completing) return;
    setCompleting(true);

    try {
      await api.post("/profile/intro-seen");
    } catch (err) {
      console.warn("Failed to mark intro seen:", err?.message);
    }

    if (typeof onIntroComplete === "function") {
      onIntroComplete();
    }

    navigate("/safehouse", { replace: true });
  }, [completing, onIntroComplete, navigate]);

  // Advance beat handler
  const advanceBeat = useCallback(() => {
    setCurrentBeat((prev) => {
      if (prev >= TOTAL_BEATS) {
        handleComplete();
        return prev;
      }
      return prev + 1;
    });
  }, [handleComplete]);

  // Auto-advance timer (only beats 1-4; beat 5 waits for user click)
  useEffect(() => {
    if (currentBeat >= TOTAL_BEATS) return;

    const timer = setTimeout(() => {
      setCurrentBeat((prev) => (prev < TOTAL_BEATS ? prev + 1 : prev));
    }, BEAT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [currentBeat]);

  // Keyboard navigation: Space / Enter to advance, Esc to skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleComplete();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (currentBeat < TOTAL_BEATS) {
          advanceBeat();
        } else {
          handleComplete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentBeat, advanceBeat, handleComplete]);

  // Fade configuration for motion/reduced motion
  const fadeVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { opacity: 0, y: 15, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: "easeOut" } },
        exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.3 } },
      };

  return (
    <div className="relative min-h-screen w-full bg-[#030712] text-white overflow-hidden flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Background Animated Galaxy */}
      <div className="fixed inset-0 z-0 opacity-80 pointer-events-none">
        <Galaxy
          density={shouldReduceMotion ? 0.6 : 1.2}
          speed={shouldReduceMotion ? 0.2 : 0.8}
          glowIntensity={0.4}
          starSpeed={shouldReduceMotion ? 0.1 : 0.4}
          disableAnimation={shouldReduceMotion}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-[#030712]/80 pointer-events-none" />
      </div>

      {/* Top Header Controls */}
      <header className="relative z-20 flex items-center justify-between w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <Terminal size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-cyan-400 font-bold tracking-widest uppercase">NEXUS // AWAKENING</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500">BEAT {currentBeat} OF {TOTAL_BEATS}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio Synthesizer Toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer ${
              isMuted
                ? "bg-zinc-900/80 border-zinc-700 text-zinc-400 hover:text-white"
                : "bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            }`}
            aria-label={isMuted ? "Unmute atmospheric audio" : "Mute audio"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="text-cyan-400" />}
            <span>{isMuted ? "AUDIO OFF" : "AUDIO ON"}</span>
          </button>

          {/* Always Visible Skip Button */}
          <button
            type="button"
            onClick={handleComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
            aria-label="Skip cinematic introduction (Press Escape)"
          >
            <FastForward size={14} />
            <span>SKIP (ESC)</span>
          </button>
        </div>
      </header>

      {/* Center Cinematic Beat Content */}
      <main className="relative z-20 flex-1 flex items-center justify-center max-w-3xl mx-auto w-full py-8">
        <AnimatePresence mode="wait">
          {/* BEAT 1: Boot sequence */}
          {currentBeat === 1 && (
            <motion.div
              key="beat-1"
              {...fadeVariants}
              className="w-full text-center space-y-6 font-mono"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 text-xs tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                SYSTEM BOOTSTRAP
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-tight">
                <GlitchText variant="cyan" text="NEXUS CORE ONLINE..." />
              </h1>
              <div className="space-y-2 text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
                <p>&gt; Initializing quantum synaptic pathways...</p>
                <p>&gt; Reconstructing codebase evaluation matrix...</p>
                <p className="text-cyan-300">&gt; Biometric link established.</p>
              </div>
            </motion.div>
          )}

          {/* BEAT 2: Subject detected */}
          {currentBeat === 2 && (
            <motion.div
              key="beat-2"
              {...fadeVariants}
              className="w-full text-center space-y-6 font-mono"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 text-xs tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                ADVERSARIAL CONSCIOUSNESS
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Subject detected:{" "}
                <GlitchText variant="red" text={userData.username} />
              </h2>
              <div className="space-y-2 text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
                <p>&gt; Git identity confirmed in adversary registry.</p>
                <p>&gt; Ingesting candidate dossier history...</p>
                <p className="text-red-400/90">&gt; &ldquo;Another aspirant walks into the grid.&rdquo;</p>
              </div>
            </motion.div>
          )}

          {/* BEAT 3: Weakness analysis */}
          {currentBeat === 3 && (
            <motion.div
              key="beat-3"
              {...fadeVariants}
              className="w-full text-center space-y-6 font-mono"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-400 text-xs tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                VULNERABILITY TELEMETRY
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Weakness found:{" "}
                <GlitchText variant="amber" text={userData.weakestAxis} />
              </h2>
              <div className="space-y-2 text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
                <p>&gt; Diagnostic calibration reveals critical cognitive blindspot.</p>
                <p>&gt; Adversarial chambers calibrated to exploit this deficiency.</p>
                <p className="text-amber-300/90">&gt; &ldquo;Your foundation will buckle under pressure.&rdquo;</p>
              </div>
            </motion.div>
          )}

          {/* BEAT 4: The rule */}
          {currentBeat === 4 && (
            <motion.div
              key="beat-4"
              {...fadeVariants}
              className="w-full text-center space-y-6 font-mono"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 text-xs tracking-widest uppercase">
                <Shield size={12} />
                THE PROTOCOL
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-wide uppercase leading-tight">
                <GlitchText variant="cyan" text="30 Days. 6 Chambers." />
                <br />
                <span className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                  No way out.
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto">
                Only algorithms that survive adversarial execution and AST inspection will earn passage to Chamber 6.
              </p>
            </motion.div>
          )}

          {/* BEAT 5: Safehouse entrance */}
          {currentBeat === 5 && (
            <motion.div
              key="beat-5"
              {...fadeVariants}
              className="w-full text-center space-y-8 font-mono"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-400/50 text-cyan-300 text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                ARIA TRANSMISSION SECURED
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                  &ldquo;I have opened a sanctuary channel.&rdquo;
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                  ARIA will assist with diagnostic hints. Prepare your workspace before entering Chamber 1.
                </p>
              </div>

              <div>
                <NexusButton
                  variant="cyan"
                  size="lg"
                  onClick={handleComplete}
                  icon={ArrowRight}
                  iconPosition="right"
                  className="px-8 py-4 text-sm sm:text-base"
                >
                  Enter the Safehouse
                </NexusButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Step Indicator & Keyboard Hints */}
      <footer className="relative z-20 flex flex-col sm:flex-row items-center justify-between w-full max-w-5xl mx-auto gap-4 pt-4 border-t border-zinc-800/60 font-mono text-xs text-zinc-500">
        {/* Step dots */}
        <div className="flex items-center gap-2" role="progressbar" aria-valuenow={currentBeat} aria-valuemax={TOTAL_BEATS}>
          {[1, 2, 3, 4, 5].map((beat) => (
            <button
              key={beat}
              type="button"
              onClick={() => setCurrentBeat(beat)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                beat === currentBeat
                  ? "w-8 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                  : beat < currentBeat
                  ? "w-4 bg-zinc-600"
                  : "w-2 bg-zinc-800"
              }`}
              aria-label={`Jump to beat ${beat}`}
            />
          ))}
        </div>

        {/* Keyboard instructions */}
        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span>
            [<kbd className="text-zinc-200">SPACE</kbd> / <kbd className="text-zinc-200">ENTER</kbd>] Advance
          </span>
          <span>
            [<kbd className="text-zinc-200">ESC</kbd>] Skip
          </span>
        </div>
      </footer>
    </div>
  );
}
