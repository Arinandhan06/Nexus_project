import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import {
  TrendingUp,
  Award,
  Flame,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Terminal,
  Shield,
  Activity,
  Layers
} from "lucide-react";
import api from "../lib/api";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";

export default function Progress({ currentUser }) {
  const [historyItems, setHistoryItems] = useState([]);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(0);
  const ledgerLimit = 10;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      setError(null);

      const [histRes, ledgerRes] = await Promise.all([
        api.get("/profile/matrix/history?limit=50&offset=0"),
        api.get(`/profile/nxp-ledger?limit=${ledgerLimit}&offset=${page * ledgerLimit}`)
      ]);

      const rawHist = histRes.data.items || [];
      // Reverse history so it is chronological (oldest to newest)
      const chronological = [...rawHist].reverse();
      setHistoryItems(chronological);

      setLedgerItems(ledgerRes.data.items || []);
      setLedgerTotal(ledgerRes.data.total || 0);
      setLedgerPage(page);
    } catch (err) {
      console.error("Failed to fetch progress telemetry:", err);
      setError(err.response?.data?.detail || "Failed to load audit telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(0);
  }, [fetchData]);

  // Derived latest metrics
  const latestMatrix = historyItems.length > 0 ? historyItems[historyItems.length - 1] : null;
  const currentTotalNxp = latestMatrix?.total_nxp ?? currentUser?.total_nxp ?? 0;
  const dsaVal = latestMatrix?.dsa ?? 0;
  const sdVal = latestMatrix?.system_design ?? 0;
  const cleanVal = latestMatrix?.cleanliness ?? 0;
  const totalChambersPassed = ledgerTotal;

  // Chart data formatting
  const chartData = historyItems.map((item, idx) => ({
    name: `Pass #${idx + 1}`,
    attemptId: item.attempt_id,
    dsa: item.dsa,
    system_design: item.system_design,
    cleanliness: item.cleanliness,
    total_nxp: item.total_nxp,
    timestamp: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }));

  const totalLedgerPages = Math.ceil(ledgerTotal / ledgerLimit) || 1;

  if (loading && historyItems.length === 0 && ledgerItems.length === 0) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-transparent text-cyan-400 font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
          <p className="text-xs tracking-widest uppercase">Decryption Protocol: Reading Matrix History & Ledger...</p>
        </div>
      </div>
    );
  }

  if (error && historyItems.length === 0 && ledgerItems.length === 0) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-transparent text-zinc-300 font-mono">
        <div className="max-w-md w-full bg-red-950/40 border border-red-500/40 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Telemetry Synchronization Failure</h2>
          <p className="text-xs text-red-300">{error}</p>
          <NexusButton variant="red" size="sm" onClick={() => fetchData(0)} className="w-full">
            <RotateCcw size={14} className="mr-2" /> Retry Connection
          </NexusButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent text-gray-200 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Screen Reader Text Summary (Required by prompt) */}
        <div className="sr-only" role="region" aria-label="Progress Screen Reader Summary">
          <h2>Candidate Matrix & NXP Audit Summary</h2>
          <p>
            You have passed {totalChambersPassed} trials with a recorded total of {currentTotalNxp} NXP.
            Current Job-Readiness Matrix ratings: Data Structures and Algorithms is {dsaVal} out of 100.
            System Design is {sdVal} out of 100. Code Cleanliness average is {cleanVal} out of 100.
          </p>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-1">
              <Terminal size={14} />
              <span>NEXUS TELEMETRY // PHASE 8 AUDIT SYSTEM</span>
            </div>
            <GlitchText
              text="PROGRESSION & NXP LEDGER"
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white"
            />
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl font-mono">
              Immutable ledger of awarded NXP and live Job-Readiness Matrix axis evolution over chamber passes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/matrix">
              <NexusButton variant="cyan" size="md">
                View Live Matrix Radar
              </NexusButton>
            </Link>
          </div>
        </div>

        {/* Top Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-cyan-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Total NXP</p>
              <p className="text-2xl font-black text-cyan-300 font-mono tracking-tight">{currentTotalNxp}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-amber-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Flame size={24} />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Current Streak</p>
              <p className="text-2xl font-black text-amber-300 font-mono tracking-tight">
                {currentUser?.current_streak ?? 0}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Passes Awarded</p>
              <p className="text-2xl font-black text-emerald-300 font-mono tracking-tight">{totalChambersPassed}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-purple-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Current Tri-Axis</p>
              <p className="text-xs font-mono text-white mt-1">
                DSA: <span className="text-cyan-400 font-bold">{dsaVal}</span> | SD: <span className="text-purple-400 font-bold">{sdVal}</span> | Clean: <span className="text-emerald-400 font-bold">{cleanVal}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Visual Accessibility Text Summary Box */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold uppercase tracking-wider">
            <TrendingUp size={14} />
            <span>Audited Performance Summary</span>
          </div>
          <p className="text-zinc-400">
            {historyItems.length > 0 ? (
              <>
                The candidate has completed <strong className="text-white">{totalChambersPassed}</strong> chamber trials. 
                DSA index is evaluated at <strong className="text-cyan-400">{dsaVal}/100</strong>, System Design at <strong className="text-purple-400">{sdVal}/100</strong>, and code craftsmanship exponential cleanliness at <strong className="text-emerald-400">{cleanVal}/100</strong>.
              </>
            ) : (
              "No chamber progression records yet. Complete Chamber 1 to initialize your Job-Readiness Matrix history."
            )}
          </p>
        </div>

        {/* SECTION 1: LineChart of 3 Matrix Axes Over Time */}
        <NexusPanel variant="cyan" glow={true} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Job-Readiness Matrix Trajectory
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  Chronological progression of DSA, System Design, and Code Cleanliness across awarded attempts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> DSA
              </span>
              <span className="flex items-center gap-1.5 text-purple-400 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> System Design
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 ml-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Cleanliness
              </span>
            </div>
          </div>

          {/* Empty State vs LineChart */}
          {historyItems.length === 0 ? (
            <div className="py-16 text-center space-y-4 font-mono">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-600">
                <Activity size={28} />
              </div>
              <h3 className="text-base font-bold text-white">No Matrix Telemetry Available</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                No chamber passes have been logged to the matrix ledger. Enter Chamber 01 to record your initial vector trajectory.
              </p>
              <Link to="/chambers/1">
                <NexusButton variant="cyan" size="sm" icon={ArrowRight} iconPosition="right" className="mt-2">
                  Commence Chamber 01
                </NexusButton>
              </Link>
            </div>
          ) : (
            <div className="w-full h-80 sm:h-96 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "monospace" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#71717a"
                    tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "monospace" }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-950/95 border border-cyan-500/50 p-3 rounded-xl shadow-2xl text-xs font-mono space-y-1.5">
                            <p className="font-bold text-white border-b border-zinc-800 pb-1">
                              {label} ({data.timestamp})
                            </p>
                            <p className="text-cyan-400">
                              DSA Score: <span className="text-white font-bold">{data.dsa}</span> / 100
                            </p>
                            <p className="text-purple-400">
                              System Design: <span className="text-white font-bold">{data.system_design}</span> / 100
                            </p>
                            <p className="text-emerald-400">
                              Cleanliness Avg: <span className="text-white font-bold">{data.cleanliness}</span> / 100
                            </p>
                            <p className="text-zinc-500 text-[10px] pt-1">
                              Total NXP at pass: {data.total_nxp}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: "12px", fontFamily: "monospace", fontSize: "12px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dsa"
                    name="Data Structures & Algorithms"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#22d3ee" }}
                    activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="system_design"
                    name="System Design"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#a855f7" }}
                    activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cleanliness"
                    name="Code Cleanliness"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#10b981" }}
                    activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </NexusPanel>

        {/* SECTION 2: Cryptographic NXP Ledger Table */}
        <NexusPanel variant="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Award size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Cryptographic NXP Ledger
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  Immutable audit records from nxp_ledger with idempotency guarantees (UNIQUE chamber_no, reason)
                </p>
              </div>
            </div>

            <div className="text-xs font-mono text-zinc-400">
              Total Recorded Entries: <span className="text-white font-bold">{ledgerTotal}</span>
            </div>
          </div>

          {ledgerItems.length === 0 ? (
            <div className="py-12 text-center space-y-3 font-mono">
              <p className="text-sm text-zinc-400">The NXP ledger is currently empty.</p>
              <p className="text-xs text-zinc-500">
                Each Chamber awards NXP exactly once upon verified test completion.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse" aria-label="NXP Ledger Table">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/40">
                    <th scope="col" className="py-3 px-4">CHAMBER</th>
                    <th scope="col" className="py-3 px-4">AWARD</th>
                    <th scope="col" className="py-3 px-4">STREAK AFTER</th>
                    <th scope="col" className="py-3 px-4">REASON</th>
                    <th scope="col" className="py-3 px-4 hidden sm:table-cell">ATTEMPT ID</th>
                    <th scope="col" className="py-3 px-4">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {ledgerItems.map((entry) => (
                    <tr key={entry.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        Chamber 0{entry.chamber_no}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                          +{entry.points} NXP
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                          <Flame size={12} className="text-amber-400 fill-amber-400/40" />
                          {entry.streak_after}x
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 uppercase tracking-wider text-[11px]">
                        {entry.reason}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 hidden sm:table-cell">
                        #{entry.attempt_id ?? "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        {new Date(entry.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Footer */}
              {totalLedgerPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500">
                    Page {ledgerPage + 1} of {totalLedgerPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <NexusButton
                      variant="neutral"
                      size="sm"
                      disabled={ledgerPage === 0 || loading}
                      onClick={() => fetchData(ledgerPage - 1)}
                    >
                      Previous
                    </NexusButton>
                    <NexusButton
                      variant="neutral"
                      size="sm"
                      disabled={ledgerPage >= totalLedgerPages - 1 || loading}
                      onClick={() => fetchData(ledgerPage + 1)}
                    >
                      Next
                    </NexusButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </NexusPanel>

      </div>
    </div>
  );
}
