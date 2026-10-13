import React from "react";
import { Building2, Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import NexusPanel from "./NexusPanel";
import GlitchText from "./GlitchText";

export default function BidCard({ bid, isActive = false, className = "" }) {
  if (!bid) return null;

  const interest = bid.interest_level ?? 50;

  // Determine badge and bar styling by interest level
  const getInterestColor = (lvl) => {
    if (lvl >= 85) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
    if (lvl >= 70) return "text-cyan-400 border-cyan-500/40 bg-cyan-500/10";
    if (lvl >= 50) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
    return "text-zinc-400 border-zinc-700 bg-zinc-800/40";
  };

  const getBarGradient = (lvl) => {
    if (lvl >= 85) return "from-emerald-500 to-teal-400";
    if (lvl >= 70) return "from-cyan-500 to-blue-400";
    if (lvl >= 50) return "from-amber-500 to-yellow-400";
    return "from-zinc-500 to-zinc-400";
  };

  return (
    <NexusPanel
      variant={isActive ? "cyan" : "neutral"}
      glow={isActive}
      className={`p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
        isActive ? "border-cyan-500/60 shadow-[0_0_25px_rgba(6,182,212,0.15)]" : "border-zinc-800"
      } ${className}`}
    >
      {/* Background cyber accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/[0.03] rounded-full blur-2xl pointer-events-none" />

      <div className="space-y-4">
        {/* Top Header: Company & Sector */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/90 uppercase tracking-widest font-semibold">
              <Building2 size={12} />
              <span>{bid.sector || "Autonomous System"}</span>
            </div>
            <GlitchText
              text={bid.company_name}
              className="text-lg font-bold text-white tracking-wide"
            />
          </div>

          {/* Interest Level Badge */}
          <div
            className={`px-3 py-1 rounded-full border font-mono text-xs font-bold flex items-center gap-1 shrink-0 ${getInterestColor(
              interest
            )}`}
          >
            <TrendingUp size={12} />
            <span>{interest}% INTEREST</span>
          </div>
        </div>

        {/* Invented Role Title */}
        <div className="p-3 rounded-lg bg-[#030712] border border-zinc-800/90 font-mono text-xs">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">
            // INVENTED ROLE TITLE
          </span>
          <span className="text-sm font-bold text-cyan-300 mt-0.5 block">
            {bid.role_title}
          </span>
        </div>

        {/* Visual Interest Bar */}
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between text-zinc-400">
            <span>Interest Calibration</span>
            <span className="font-bold text-zinc-200">{interest} / 100</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${getBarGradient(
                interest
              )} transition-all duration-700`}
              style={{ width: `${interest}%` }}
            />
          </div>
        </div>

        {/* In-Character Pitch */}
        <div className="relative pl-3 border-l-2 border-cyan-500/50 text-xs font-mono text-zinc-300 leading-relaxed italic">
          "{bid.pitch}"
        </div>
      </div>

      {/* Values Footer */}
      <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span className="truncate max-w-[280px]">{bid.values}</span>
        <ShieldCheck size={14} className="text-zinc-600 shrink-0" />
      </div>
    </NexusPanel>
  );
}
