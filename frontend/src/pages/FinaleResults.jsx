import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Cpu,
  Flame,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Layers,
  ArrowRight
} from "lucide-react";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";
import BidCard from "../components/nexus/BidCard";
import TrophyPanel from "../components/nexus/TrophyPanel";
import api from "../lib/api";

export default function FinaleResults({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [bidsData, setBidsData] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeBidIndex, setActiveBidIndex] = useState(0);

  const fetchResultsAndBids = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch finale results
      const resResults = await api.get("/finale/results");
      setResultsData(resResults.data);

      // 2. Fetch company bids
      const resBids = await api.get("/finale/bids");
      setBidsData(resBids.data);
    } catch (err) {
      console.warn("Failed loading finale results or bids:", err);
      setErrorMsg(
        err.response?.data?.detail || "Unable to retrieve finale results. Complete Chamber 6 first."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResultsAndBids();
  }, [fetchResultsAndBids]);

  const bids = bidsData?.bids || [];
  const scores = resultsData?.scores || {};
  const overall = scores.overall || { overall_score: 85, passed: true };
  const coding = scores.coding || { passed: true, score: 100, complexity: "O(n)" };
  const quiz = scores.quiz || { score: 100, correct_count: 5 };
  const design = scores.design || { total: 85 };

  if (loading && !bidsData) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8 space-y-4">
        <Cpu className="w-12 h-12 text-cyan-400 animate-spin" />
        <GlitchText text="CALCULATING CORPORATE BIDS & WORK-STYLE TELEMETRY..." className="text-sm font-mono text-cyan-300" />
      </div>
    );
  }

  if (errorMsg && !bidsData) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-6 font-mono">
        <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">FINALE COMPLETION REQUIRED</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{errorMsg}</p>
        </div>
        <Link to="/chambers/6">
          <NexusButton variant="primary" size="md" icon={ArrowRight}>
            Go to Chamber 06 Finale
          </NexusButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans text-zinc-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold mb-1">
            <Award size={14} />
            <span>NEXUS TRIAL CONCLUSION // PHASE 09 COMPLETE</span>
          </div>
          <GlitchText
            text="FINALE ACCREDITATION & BIDS"
            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
          />
          <p className="text-xs font-mono text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Corporate simulated interest evaluations and GitHub profile trophy based purely on your Chamber performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/chambers">
            <NexusButton variant="outline" size="sm" icon={ChevronLeft}>
              Chambers Grid
            </NexusButton>
          </Link>
          <Link to="/matrix">
            <NexusButton variant="outline" size="sm" icon={Sparkles}>
              Job Matrix
            </NexusButton>
          </Link>
        </div>
      </div>

      {/* Mandatory Game Feature Disclaimer Banner */}
      <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 font-mono text-xs flex items-center gap-3 text-purple-300">
        <ShieldAlert size={18} className="text-purple-400 shrink-0" />
        <span className="leading-relaxed">
          <strong>DISCLAIMER:</strong> {bidsData?.disclaimer || "A game feature based only on your Chamber performance. Not a hiring assessment or a real offer."}
        </span>
      </div>

      {/* Score Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NexusPanel variant="neutral" className="p-4 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">OVERALL FINALE SCORE</span>
          <div className="text-2xl font-bold font-mono text-white">
            {overall.overall_score || 85}%
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-bold block">
            PASSED BENCHMARK
          </span>
        </NexusPanel>

        <NexusPanel variant="neutral" className="p-4 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">CODING (50%)</span>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {coding.score ?? 100} / 100
          </div>
          <span className="text-[11px] font-mono text-zinc-400 block">
            Complexity: {coding.complexity || "O(n)"}
          </span>
        </NexusPanel>

        <NexusPanel variant="neutral" className="p-4 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">QUIZ (20%)</span>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {quiz.score ?? 100} / 100
          </div>
          <span className="text-[11px] font-mono text-zinc-400 block">
            {quiz.correct_count ?? 5}/5 Correct
          </span>
        </NexusPanel>

        <NexusPanel variant="neutral" className="p-4 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">SYSTEM DESIGN (30%)</span>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {design.total ?? 85} / 100
          </div>
          <span className="text-[11px] font-mono text-zinc-400 block">
            5-Dimension Rubric
          </span>
        </NexusPanel>
      </div>

      {/* Work-Style Analysis Card */}
      <NexusPanel variant="neutral" className="p-6 space-y-4 border-cyan-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-cyan-400" />
            <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider">
              ENGINEERING ARCHETYPE // WORK-STYLE ANALYSIS
            </h3>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold self-start sm:self-auto">
            <span>ARCHETYPE:</span>
            <span className="text-white">{bidsData?.style || "Optimal and clean"}</span>
          </div>
        </div>

        <p className="text-sm font-mono text-zinc-300 leading-relaxed max-w-4xl">
          {bidsData?.work_style_analysis}
        </p>

        {/* Structured Metrics Summary Pills */}
        {bidsData?.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-zinc-800/80 font-mono text-xs">
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Cleanliness</span>
              <span className="text-emerald-400 font-bold">{bidsData.metrics.avg_cleanliness}%</span>
            </div>
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Non-Inefficient</span>
              <span className="text-cyan-400 font-bold">{intPct(bidsData.metrics.non_inefficient_share)}%</span>
            </div>
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Avg Time Used</span>
              <span className="text-amber-400 font-bold">{bidsData.metrics.avg_time_used_pct}%</span>
            </div>
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">First Try Rate</span>
              <span className="text-purple-400 font-bold">{intPct(bidsData.metrics.first_try_rate)}%</span>
            </div>
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Best Streak</span>
              <span className="text-white font-bold">{bidsData.metrics.best_streak}</span>
            </div>
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Hint Ratio</span>
              <span className="text-zinc-300 font-bold">{bidsData.metrics.hint_dependence}</span>
            </div>
          </div>
        )}
      </NexusPanel>

      {/* Company Bids Carousel (5 Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
              <Layers size={14} />
              <span>SIMULATED MARKET DEMAND</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-wide">
              Fictional Corporate Bids ({bids.length})
            </h3>
          </div>

          {/* Carousel controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveBidIndex((prev) => (prev > 0 ? prev - 1 : bids.length - 1))}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              aria-label="Previous Bid"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono text-zinc-400">
              {activeBidIndex + 1} / {bids.length}
            </span>
            <button
              onClick={() => setActiveBidIndex((prev) => (prev < bids.length - 1 ? prev + 1 : 0))}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              aria-label="Next Bid"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Carousel Viewport */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bids.map((bid, idx) => (
            <BidCard
              key={bid.company_id}
              bid={bid}
              isActive={idx === activeBidIndex}
              className={idx === activeBidIndex ? "ring-1 ring-cyan-500" : ""}
            />
          ))}
        </div>
      </div>

      {/* GitHub Trophy Reputation Panel */}
      <TrophyPanel currentUser={currentUser} />
    </div>
  );
}

function intPct(val) {
  if (typeof val !== "number") return 0;
  return Math.round(val * 100);
}
