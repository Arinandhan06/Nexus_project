import React from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  FolderCode,
  Terminal,
  Activity,
  ArrowRight,
  Sparkles,
  Lock,
  Cpu
} from "lucide-react";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";
import SecureComms from "../components/nexus/SecureComms";

export default function Safehouse() {
  return (
    <div className="min-h-full w-full p-4 sm:p-6 lg:p-8 flex flex-col space-y-8 bg-transparent text-gray-200">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-1">
            <Shield size={14} />
            <span>NEXUS SAFE HOUSE // SANCTUARY NODE</span>
          </div>
          <GlitchText
            text="THE SAFEHOUSE & SECURE COMMS"
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white"
          />
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl font-mono">
            Neutral safe zone under ARIA protocol surveillance. Practice algorithms in the Construct or receive strategic hints via Secure Comms.
          </p>
        </div>

        <Link to="/safehouse/construct">
          <NexusButton
            variant="cyan"
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
            className="shrink-0"
          >
            Enter The Construct
          </NexusButton>
        </Link>
      </div>

      {/* Main Grid: Hub Navigation + ARIA Secure Comms Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 6 cols: Safehouse Modules & Quick Links */}
        <div className="lg:col-span-6 space-y-6">
          {/* Construct Hub Card */}
          <NexusPanel
            variant="cyan"
            glow={true}
            className="space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <FolderCode size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    The Construct Sandbox
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Free-practice code editor // 12 Foundational Prompts
                  </p>
                </div>
              </div>
              <StatBadge label="ENV" value="READY" variant="cyan" size="sm" />
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              Test your algorithmic syntax and muscle memory without adversarial scrutiny. Monaco editor powered with the <span className="font-mono text-cyan-300 font-semibold">nexus-dark</span> theme, font controls, and auto-saved drafts.
            </p>

            <div className="pt-2">
              <Link to="/safehouse/construct">
                <NexusButton variant="cyan" size="sm" icon={ArrowRight} iconPosition="right">
                  Open Construct Sandbox
                </NexusButton>
              </Link>
            </div>
          </NexusPanel>

          {/* Chambers Progression Card */}
          <NexusPanel variant="neutral" className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Live Chamber Trials
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    30-Day trial progression calibrated from your dossier
                  </p>
                </div>
              </div>
              <StatBadge label="TRIALS" value="CHAMBER 1" variant="neutral" size="sm" />
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Face adversarial challenges tailored to your weakest competency areas. Live scoring unlocks in Phase 5.
            </p>

            <div className="pt-2 flex gap-3">
              <Link to="/chambers">
                <NexusButton variant="outline" size="sm" icon={ArrowRight} iconPosition="right">
                  View Chambers
                </NexusButton>
              </Link>
              <Link to="/matrix">
                <NexusButton variant="outline" size="sm">
                  View Matrix
                </NexusButton>
              </Link>
            </div>
          </NexusPanel>
        </div>

        {/* Right 6 cols: ARIA Secure Comms Panel */}
        <div className="lg:col-span-6 h-[560px]">
          <SecureComms
            challengeId="safehouse-general"
            currentCode=""
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
