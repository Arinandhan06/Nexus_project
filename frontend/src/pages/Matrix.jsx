import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import {
  Activity,
  Shield,
  Code,
  Layers,
  Wrench,
  Globe,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Calendar,
  Crosshair,
  Sparkles,
  Table as TableIcon
} from "lucide-react";
import api from "../lib/api";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";

const CATEGORY_ICONS = {
  "Data Structures & Algorithms": Activity,
  "System Design": Layers,
  "Code Quality": Shield,
  "Languages": Code,
  "Tools": Wrench
};

export default function Matrix({ currentUser }) {
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState({ dsa: 0, system_design: 0, cleanliness: 0 });
  const [skillTree, setSkillTree] = useState({});
  const [weaknesses, setWeaknesses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [taunts, setTaunts] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedChambers, setExpandedChambers] = useState({ 1: true });
  const [showTableFallback, setShowTableFallback] = useState(false);

  const currentChamber = currentUser?.current_chamber || 1;

  useEffect(() => {
    let isMounted = true;
    const fetchMatrixData = async () => {
      try {
        const [resMatrix, resTree, resSched] = await Promise.allSettled([
          api.get("/profile/matrix"),
          api.get("/profile/skill-tree"),
          api.get("/profile/schedule")
        ]);

        if (isMounted) {
          if (resMatrix.status === "fulfilled" && resMatrix.value.data) {
            setMatrix(resMatrix.value.data);
          }
          if (resTree.status === "fulfilled" && resTree.value.data) {
            const data = resTree.value.data;
            setSkillTree(data.skill_tree || {});
            setWeaknesses(data.weaknesses || []);
          }
          if (resSched.status === "fulfilled" && resSched.value.data) {
            const data = resSched.value.data;
            setSchedule(data.schedule || []);
            setTaunts(data.taunts || {});
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch matrix data:", err);
        if (isMounted) setLoading(false);
      }
    };

    fetchMatrixData();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleChamber = (chamberNo) => {
    setExpandedChambers((prev) => ({
      ...prev,
      [chamberNo]: !prev[chamberNo]
    }));
  };

  const radarData = [
    { subject: "Data Structures & Algorithms", score: matrix.dsa || 0, fullMark: 100 },
    { subject: "System Design", score: matrix.system_design || 0, fullMark: 100 },
    { subject: "Code Cleanliness", score: matrix.cleanliness || 0, fullMark: 100 }
  ];

  // Group schedule days by Chamber (1-6)
  const chambersMap = {};
  for (let c = 1; c <= 6; c++) {
    chambersMap[c] = schedule.filter((d) => d.chamber_no === c);
  }

  const chamberTitles = {
    1: "Chamber 1: Algorithmic Foundations",
    2: "Chamber 2: System Architecture & Data Flow",
    3: "Chamber 3: Code Craftsmanship & Refactoring",
    4: "Chamber 4: Weakness Overdrive I",
    5: "Chamber 5: Weakness Overdrive II",
    6: "Chamber 6: Final Adversarial Interview"
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black/80 text-emerald-400 font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs tracking-widest uppercase">Querying Job-Readiness Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent text-gray-200 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-1">
              <Terminal size={14} />
              <span>NEXUS Readiness Matrix // Phase 2 Calibration</span>
            </div>
            <GlitchText
              text="JOB-READINESS MATRIX & 30-DAY TRIAL"
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white"
            />
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl font-mono">
              Calibrated from candidate dossier. Resume scores are capped at 60/100 until proven in live Chamber trials.
            </p>
          </div>

          <NexusButton
            variant="cyan"
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate("/chambers")}
            className="shrink-0"
          >
            Enter Chamber {currentChamber}
          </NexusButton>
        </div>

        {/* Top Grid: Radar Chart + Accessible Table + Weaknesses */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Radar Chart Card (7 cols) */}
          <NexusPanel
            variant="cyan"
            glow={true}
            className="lg:col-span-7"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Activity size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Tri-Axis Readiness Radar
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    Baseline: DSA, System Design, Cleanliness (Capped at 60)
                  </p>
                </div>
              </div>

              {/* Accessible Toggle */}
              <button
                type="button"
                onClick={() => setShowTableFallback((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-cyan-400 transition-colors font-mono cursor-pointer"
                aria-label="Toggle accessible score table view"
              >
                <TableIcon size={14} />
                <span>{showTableFallback ? "Show Radar" : "Accessible Table"}</span>
              </button>
            </div>

            {/* Radar View */}
            {!showTableFallback ? (
              <div className="w-full h-80 sm:h-96 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#a1a1aa", fontSize: 12, fontFamily: "monospace" }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: "#71717a", fontSize: 10 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-zinc-900/95 border border-cyan-500/50 p-3 rounded-xl shadow-xl text-xs font-mono">
                              <p className="font-semibold text-cyan-400">{data.subject}</p>
                              <p className="text-white mt-1">Calibrated Score: <span className="font-bold">{data.score}</span> / 60</p>
                              <p className="text-zinc-500 text-[10px]">Resume Cap: 60/100</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Radar
                      name="Readiness Score"
                      dataKey="score"
                      stroke="#22d3ee"
                      fill="#22d3ee"
                      fillOpacity={0.45}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              /* Accessible Semantic Table Fallback */
              <div className="overflow-x-auto py-4">
                <table className="w-full text-left text-xs font-mono" aria-label="Job Readiness Matrix Scores">
                  <caption className="sr-only">Job Readiness Matrix Competency Scores</caption>
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Competency Dimension</th>
                      <th className="py-3 px-4">Calibrated Score</th>
                      <th className="py-3 px-4">Ceiling</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Data Structures & Algorithms</td>
                      <td className="py-3 px-4 text-cyan-400 font-bold">{matrix.dsa} / 100</td>
                      <td className="py-3 px-4 text-zinc-400">60 max</td>
                      <td className="py-3 px-4 text-cyan-400">Calibrated</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">System Design</td>
                      <td className="py-3 px-4 text-cyan-400 font-bold">{matrix.system_design} / 100</td>
                      <td className="py-3 px-4 text-zinc-400">60 max</td>
                      <td className="py-3 px-4 text-cyan-400">Calibrated</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-white">Code Cleanliness</td>
                      <td className="py-3 px-4 text-cyan-400 font-bold">{matrix.cleanliness} / 100</td>
                      <td className="py-3 px-4 text-zinc-400">60 max</td>
                      <td className="py-3 px-4 text-cyan-400">Calibrated</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Quick Stats Footer */}
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-zinc-800/80 text-center font-mono">
              <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase">DSA Score</p>
                <p className="text-xl font-bold text-cyan-400 mt-0.5">{matrix.dsa}<span className="text-xs text-zinc-600">/60</span></p>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase">System Design</p>
                <p className="text-xl font-bold text-cyan-400 mt-0.5">{matrix.system_design}<span className="text-xs text-zinc-600">/60</span></p>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase">Cleanliness</p>
                <p className="text-xl font-bold text-cyan-400 mt-0.5">{matrix.cleanliness}<span className="text-xs text-zinc-600">/60</span></p>
              </div>
            </div>
          </NexusPanel>

          {/* Right Column: Targeted Weaknesses Card (5 cols) */}
          <NexusPanel
            variant="amber"
            glow={true}
            className="lg:col-span-5 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Crosshair size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Identified Weaknesses
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  Adversarial targets weighted for double practice days
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {weaknesses && weaknesses.length > 0 ? (
                weaknesses.map((weakness, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-3.5 rounded-2xl bg-zinc-900/70 border border-amber-500/30 flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-lg bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-zinc-200">
                        {weakness}
                      </p>
                      <p className="text-[10px] text-amber-400/80 font-mono mt-0.5">
                        Targeted in Chambers 2, 3, 4 & 5
                      </p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-zinc-900 text-xs text-zinc-500 font-mono text-center">
                  No critical weaknesses registered yet.
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs font-mono text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Sparkles size={14} />
                <span>NEXUS Calibration Note</span>
              </div>
              <p>
                The 2 lowest-scoring dimensions receive double the Chamber training days (10 days each vs 5 days) to maximize mastery before the Chamber 6 Final Interview.
              </p>
            </div>
          </NexusPanel>
        </div>

        {/* Skill Tree Section: Expandable Category Cards */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Code size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  AI Deconstructed Skill Tree
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  Extracted from dossier across 5 core competency sectors
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(skillTree).map(([category, skills]) => {
              const IconComponent = CATEGORY_ICONS[category] || Layers;
              const isExpanded = expandedCategories[category];

              return (
                <NexusPanel
                  key={category}
                  variant="neutral"
                  className="hover:border-cyan-500/40 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between text-left cursor-pointer group"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                        <IconComponent size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-200 group-hover:text-cyan-300 transition-colors">
                          {category}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {Array.isArray(skills) ? skills.length : 0} verified skills
                        </p>
                      </div>
                    </div>
                    <div className="text-zinc-500 group-hover:text-cyan-400 transition-colors">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-zinc-800/80 space-y-3.5 overflow-hidden"
                      >
                        {Array.isArray(skills) && skills.map((skill, sIdx) => (
                          <div key={sIdx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-zinc-300">{skill.name}</span>
                              <span className="font-mono text-cyan-400 font-bold">{skill.level}%</span>
                            </div>
                            <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, skill.level))}%` }}
                              />
                            </div>
                            {skill.evidence && (
                              <p className="text-[11px] text-zinc-500 font-mono italic">
                                &ldquo;{skill.evidence}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </NexusPanel>
              );
            })}
          </div>
        </div>

        {/* 30-Day Chamber Schedule Timeline */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                30-Day Chamber Trial Schedule
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                6 progressive chambers dynamically scheduled to eliminate player deficiencies
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((chamberNo) => {
              const isUnlocked = chamberNo <= currentChamber;
              const days = chambersMap[chamberNo] || [];
              const isExpanded = expandedChambers[chamberNo];
              const taunt = taunts[chamberNo] || taunts[String(chamberNo)];
              const title = chamberTitles[chamberNo] || `Chamber ${chamberNo}`;

              return (
                <NexusPanel
                  key={chamberNo}
                  variant={isUnlocked ? "cyan" : "neutral"}
                  glow={isUnlocked}
                  className={!isUnlocked ? "opacity-75" : ""}
                >
                  {/* Chamber Header Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isUnlocked
                            ? "bg-cyan-950/70 border-cyan-500/50 text-cyan-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-500"
                        }`}
                      >
                        {isUnlocked ? <Unlock size={22} /> : <Lock size={22} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <StatBadge
                            label="CHAMBER"
                            value={isUnlocked ? "UNLOCKED" : "LOCKED"}
                            variant={isUnlocked ? "cyan" : "neutral"}
                            size="sm"
                          />
                          <span className="text-xs font-mono text-zinc-500">
                            {days.length > 0 ? `Days ${days[0].day} - ${days[days.length - 1].day}` : ""}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white">
                          {title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      {isUnlocked && (
                        <NexusButton
                          variant="cyan"
                          size="sm"
                          onClick={() => navigate("/chambers")}
                        >
                          Enter
                        </NexusButton>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleChamber(chamberNo)}
                        className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900/60 border border-zinc-800 transition-colors cursor-pointer"
                        aria-label="Toggle chamber days breakdown"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Chamber Taunt Callout */}
                  {taunt && (
                    <div className="mt-4">
                      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-red-500/30 text-xs font-mono text-zinc-300 flex items-start gap-2.5">
                        <Terminal size={16} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="italic text-zinc-300/90">&ldquo;{taunt}&rdquo;</p>
                      </div>
                    </div>
                  )}

                  {/* Expandable Daily Itinerary */}
                  <AnimatePresence>
                    {isExpanded && days.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-zinc-800/80 pt-4 mt-4"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {days.map((dayItem) => (
                            <div
                              key={dayItem.day}
                              className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60 text-xs font-mono space-y-1 hover:border-cyan-500/30 transition-colors"
                            >
                              <div className="flex items-center justify-between text-zinc-500">
                                <span className="font-bold text-cyan-400">Day {dayItem.day}</span>
                                <span>Chamber {dayItem.chamber_no}</span>
                              </div>
                              <p className="font-semibold text-zinc-200 truncate">
                                {dayItem.theme}
                              </p>
                              {dayItem.focus_weakness && (
                                <p className="text-[10px] text-amber-400/80 truncate">
                                  Focus: {dayItem.focus_weakness}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </NexusPanel>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
