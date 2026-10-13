import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Unlock,
  Play,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  RefreshCw,
  Cpu
} from "lucide-react";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";
import api from "../lib/api";

const CHAMBER_DETAILS = {
  1: {
    icon: Flame,
    description: "The city's reservoir floodgate bypass has malfunctioned. Reroute water pressure using array pointers and frequency hashes before lower sectors submerge.",
  },
  2: {
    icon: Cpu,
    description: "Cascading power grid failure across the sub-core. Balance fluctuating power relays using monotonic stacks and double-ended queues.",
  },
  3: {
    icon: RefreshCw,
    description: "Autonomous transit routers have deadlocked all transit corridors. Pathfind optimal bypasses using BFS and cycle detection.",
  },
  4: {
    icon: AlertTriangle,
    description: "Sub-surface frequency communications corrupted by rogue interference. Reconstruct the lost carrier signal via optimal dynamic programming.",
  },
  5: {
    icon: Shield,
    description: "Central cryptographic ledger lockouts detected. Traverse hierarchical access trees and binary heaps to recover authentication credentials.",
  },
  6: {
    icon: Lock,
    description: "The primary NEXUS mainframe chamber. Face the final adversarial cognitive interview.",
  },
};

export default function Chambers() {
  const navigate = useNavigate();
  const [chambers, setChambers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChambers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/chambers");
      setChambers(res.data);
    } catch (err) {
      console.warn("Failed to load chambers:", err);
      setError("Unable to connect to Chamber Core. Retrying in fallback mode.");
      // Fallback default structure
      setChambers([
        { chamber_no: 1, title: "The Flood", theme: "arrays, two pointers, hashing", state: "UNLOCKED", attempts: 0 },
        { chamber_no: 2, title: "The Blackout", theme: "stacks and queues", state: "LOCKED", attempts: 0 },
        { chamber_no: 3, title: "The Gridlock", theme: "graphs, BFS/DFS", state: "LOCKED", attempts: 0 },
        { chamber_no: 4, title: "The Signal", theme: "dynamic programming", state: "LOCKED", attempts: 0 },
        { chamber_no: 5, title: "The Vault", theme: "trees, binary search, heaps", state: "LOCKED", attempts: 0 },
        { chamber_no: 6, title: "The Nexus Core", theme: "final adversarial interview", state: "LOCKED", attempts: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChambers();
  }, []);

  const handleCardClick = async (c) => {
    if (c.state === "LOCKED") return;

    // ACTIVE, EVALUATING, PASSED, FAILED: player can resume or enter run directly
    if (c.state === "ACTIVE" || c.state === "EVALUATING") {
      navigate(`/chambers/${c.chamber_no}`);
      return;
    }

    // Specification: "Clicking an UNLOCKED or PREPARING card goes to the Safehouse first, then the run page."
    if (c.state === "UNLOCKED" || c.state === "PREPARING") {
      try {
        if (c.state === "UNLOCKED") {
          await api.post(`/chambers/${c.chamber_no}/prepare`).catch(() => {});
        }
      } catch (e) {
        console.warn("Prepare call failed:", e);
      }
      navigate(`/safehouse?chamber=${c.chamber_no}`);
    } else {
      // FAILED or PASSED retry/review
      navigate(`/chambers/${c.chamber_no}`);
    }
  };

  const getBadgeVariant = (state) => {
    switch (state) {
      case "ACTIVE":
        return "cyan";
      case "PASSED":
      case "COMPLETED":
        return "green";
      case "EVALUATING":
        return "amber";
      case "FAILED":
        return "red";
      case "PREPARING":
        return "amber";
      case "UNLOCKED":
        return "cyan";
      case "LOCKED":
      default:
        return "neutral";
    }
  };

  return (
    <div className="min-h-full w-full p-4 sm:p-6 lg:p-8 flex flex-col space-y-8 bg-transparent text-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-1">
            <Cpu size={14} />
            <span>NEXUS TRIAL PROTOCOL // 6 CHAMBERS</span>
          </div>
          <GlitchText
            text="THE CODING CHAMBERS"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white"
          />
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl font-mono">
            Sequential gauntlet of real infrastructure crises. Overcome each trial to advance through the city grid.
          </p>
        </div>

        <NexusButton
          variant="outline"
          size="sm"
          onClick={fetchChambers}
          icon={RefreshCw}
          className="self-start md:self-auto"
        >
          Refresh Grid
        </NexusButton>
      </div>

      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center font-mono text-xs text-zinc-500 animate-pulse">
          // SYNCHRONIZING CHAMBER TELEMETRY...
        </div>
      ) : (
        /* Grid of 6 Chambers */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chambers.map((c) => {
          const isLocked = c.state === "LOCKED";
          const details = CHAMBER_DETAILS[c.chamber_no] || {};
          const Icon = details.icon || Cpu;

          return (
            <div
              key={c.chamber_no}
              onClick={() => handleCardClick(c)}
              className={`group transition-all duration-300 ${
                isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer transform hover:-translate-y-1"
              }`}
            >
              <NexusPanel
                variant={isLocked ? "neutral" : c.state === "ACTIVE" ? "cyan" : "neutral"}
                glow={c.state === "ACTIVE"}
                className={`h-full flex flex-col justify-between p-6 relative overflow-hidden transition-all duration-300 ${
                  !isLocked ? "hover:border-cyan-500/60" : "hover:border-zinc-800"
                }`}
              >
                {/* Background Accent Pill */}
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-white/[0.02] rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />

                <div className="space-y-4">
                  {/* Top Bar: Chamber Number, Lock/Unlock Icon & State Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border font-mono font-bold text-sm ${
                          isLocked
                            ? "bg-zinc-900 border-zinc-800 text-zinc-500"
                            : c.state === "ACTIVE"
                            ? "bg-cyan-950/80 border-cyan-500/40 text-cyan-400"
                            : "bg-zinc-900 border-zinc-700 text-zinc-300"
                        }`}
                      >
                        {isLocked ? <Lock size={16} /> : `0${c.chamber_no}`}
                      </div>
                      <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                        CHAMBER {c.chamber_no}
                      </span>
                    </div>

                    <StatBadge
                      label="STATUS"
                      value={c.state}
                      variant={getBadgeVariant(c.state)}
                      size="sm"
                    />
                  </div>

                  {/* Story Title & Theme */}
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors tracking-wide">
                      {c.title}
                    </h3>
                    <div className="text-xs font-mono text-cyan-400/80 mt-1">
                      // {c.theme}
                    </div>
                  </div>

                  {/* Thriller Story Synopsis */}
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    {details.description}
                  </p>
                </div>

                {/* Footer: Attempts & CTA */}
                <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                  <div className="text-zinc-500">
                    Attempts: <span className="text-zinc-300 font-semibold">{c.attempts ?? 0}</span>
                  </div>

                  <div>
                    {isLocked ? (
                      <span className="flex items-center gap-1 text-zinc-600">
                        <Lock size={12} />
                        LOCKED
                      </span>
                    ) : c.state === "ACTIVE" ? (
                      <span className="flex items-center gap-1 text-cyan-400 font-bold group-hover:translate-x-1 transition-transform">
                        RESUME TRIAL
                        <ArrowRight size={14} />
                      </span>
                    ) : c.state === "PASSED" || c.state === "COMPLETED" ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <CheckCircle2 size={14} />
                        PASSED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyan-400 font-bold group-hover:translate-x-1 transition-transform">
                        PREPARE IN SAFEHOUSE
                        <ArrowRight size={14} />
                      </span>
                    )}
                  </div>
                </div>
              </NexusPanel>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
