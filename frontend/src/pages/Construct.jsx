import React, { useState, Suspense, lazy } from "react";
import {
  Play,
  RotateCcw,
  Search,
  HelpCircle,
  Terminal,
  FolderCode,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Code2
} from "lucide-react";
import promptsData from "../data/construct_prompts.json";
import { NexusButton, StatBadge, GlitchText } from "../components/nexus";
import SecureComms from "../components/nexus/SecureComms";
import api from "../lib/api";

// Lazy-load CodeEditor as required by spec
const CodeEditor = lazy(() => import("../components/nexus/CodeEditor"));

export default function Construct() {
  const [prompts] = useState(promptsData);
  const [selectedPromptId, setSelectedPromptId] = useState(promptsData[0]?.id || "two-sum");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAriaModal, setShowAriaModal] = useState(false);
  const [activeTab, setActiveTab] = useState("description"); // "description" | "examples" | "constraints"

  // Active prompt
  const activePrompt = prompts.find((p) => p.id === selectedPromptId) || prompts[0];

  const getSavedDraft = (promptId, fallbackCode) => {
    try {
      const saved = localStorage.getItem(`construct_draft_${promptId}`);
      return saved !== null ? saved : fallbackCode;
    } catch (e) {
      console.warn("localStorage unavailable:", e);
      return fallbackCode;
    }
  };

  const [code, setCode] = useState(() =>
    getSavedDraft(activePrompt.id, activePrompt.starter_code)
  );

  const handleSelectPrompt = (id) => {
    setSelectedPromptId(id);
    const target = prompts.find((p) => p.id === id) || prompts[0];
    setCode(getSavedDraft(target.id, target.starter_code));
  };

  const handleCodeChange = (newCode) => {
    const val = newCode || "";
    setCode(val);
    try {
      localStorage.setItem(`construct_draft_${activePrompt.id}`, val);
    } catch (e) {
      console.warn("localStorage save failed:", e);
    }
  };

  const handleResetCode = () => {
    const starter = activePrompt.starter_code;
    setCode(starter);
    try {
      localStorage.setItem(`construct_draft_${activePrompt.id}`, starter);
    } catch (e) {
      console.warn("localStorage reset failed:", e);
    }
  };

  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [runStdout, setRunStdout] = useState("");
  const [runError, setRunError] = useState(null);

  const handleRunCode = async () => {
    if (isRunning) return;
    try {
      setIsRunning(true);
      setRunError(null);
      const res = await api.post("/construct/run", {
        prompt_id: activePrompt.id,
        code
      });
      setRunResults(res.data.results || []);
      setRunStdout(res.data.stdout || "");
      if (!res.data.success && res.data.error) {
        setRunError(res.data.error);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Execution failed.";
      setRunError(msg);
    } finally {
      setIsRunning(false);
    }
  };

  // Filtered prompts
  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.statement.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || p.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesDifficulty =
      selectedDifficulty === "all" || p.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const categories = [
    "all",
    "Arrays & Hashing",
    "Two Pointers",
    "Sliding Window",
    "Stack",
    "Binary Search",
    "Linked List",
    "Trees",
    "Heap / Priority Queue",
    "Graphs",
    "Dynamic Programming"
  ];

  const getDifficultyBadge = (diff) => {
    switch (diff) {
      case "Easy":
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/40">Easy</span>;
      case "Medium":
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-950/70 text-amber-400 border border-amber-500/40">Medium</span>;
      case "Hard":
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-red-950/70 text-red-400 border border-red-500/40">Hard</span>;
      default:
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-cyan-950/70 text-cyan-400 border border-cyan-500/40">{diff}</span>;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent text-gray-200 overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-14 px-4 sm:px-6 border-b border-zinc-800 bg-[#030712]/90 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <FolderCode size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <GlitchText
                text="THE CONSTRUCT"
                className="text-sm sm:text-base font-bold font-mono tracking-wider text-white"
              />
              <StatBadge label="LEETCODE MODE" value="ACTIVE" variant="cyan" size="sm" />
            </div>
            <p className="text-[10px] text-zinc-400 font-mono hidden sm:block">
              {prompts.length} Curated Algorithmic Problems // Direct LeetCode Practice Mirror
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activePrompt.leetcode_slug && (
            <a
              href={`https://leetcode.com/problems/${activePrompt.leetcode_slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
              title="Open problem on LeetCode"
            >
              <span>LeetCode #{activePrompt.leetcode_id}</span>
              <ExternalLink size={12} />
            </a>
          )}
          <NexusButton
            variant="cyan"
            size="sm"
            onClick={() => setShowAriaModal((prev) => !prev)}
            icon={HelpCircle}
            className="text-xs"
          >
            {showAriaModal ? "Hide ARIA" : "Consult ARIA"}
          </NexusButton>
        </div>
      </div>

      {/* Main 3-Pane Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left Pane: LeetCode Problems Drawer */}
        <div className="w-full lg:w-84 xl:w-96 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-[#040816]/80 flex flex-col h-72 lg:h-full overflow-hidden">
          <div className="p-3 border-b border-zinc-800 space-y-2.5 shrink-0">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search LeetCode problems..."
                className="w-full bg-[#030712] border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="text-zinc-500 uppercase">Diff:</span>
              {["all", "Easy", "Medium", "Hard"].map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    selectedDifficulty === diff
                      ? "bg-cyan-500 text-black font-bold shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            {/* Category pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* List of prompts */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60 p-1.5">
            {filteredPrompts.map((p) => {
              const isSelected = p.id === activePrompt.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPrompt(p.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-cyan-950/50 border border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                      : "hover:bg-zinc-900/60 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-400 font-semibold truncate max-w-[160px]">
                      {p.category}
                    </span>
                    {getDifficultyBadge(p.difficulty)}
                  </div>
                  <h4 className={`text-xs font-bold leading-snug ${isSelected ? "text-white" : "text-zinc-200"}`}>
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{p.statement}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Pane: LeetCode Problem Spec & Code Editor */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#030712]">
          {/* LeetCode Header Banner */}
          <div className="p-4 border-b border-zinc-800 bg-[#070e1e]/80 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {getDifficultyBadge(activePrompt.difficulty)}
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    {activePrompt.category}
                  </span>
                  {activePrompt.leetcode_slug && (
                    <a
                      href={`https://leetcode.com/problems/${activePrompt.leetcode_slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                    >
                      <span>leetcode.com/problems/{activePrompt.leetcode_slug}</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  {activePrompt.title}
                </h2>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleResetCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
                  title="Reset to starter solution skeleton"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
                {/* Active Run Button */}
                <button
                  type="button"
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-950/50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isRunning ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} className="fill-white" />
                      <span>Run</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* LeetCode Style Problem Tabs */}
            <div className="mt-3 flex items-center gap-2 border-b border-zinc-800/80 pb-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab("description")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === "description"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Description
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("examples")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === "examples"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Examples ({activePrompt.examples?.length || 0})
              </button>
              {activePrompt.constraints && (
                <button
                  type="button"
                  onClick={() => setActiveTab("constraints")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    activeTab === "constraints"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Constraints
                </button>
              )}
            </div>

            {/* Tab Body */}
            <div className="mt-2.5 text-xs text-zinc-300 leading-relaxed font-sans max-h-36 overflow-y-auto pr-2">
              {activeTab === "description" && (
                <p className="whitespace-pre-line">{activePrompt.statement}</p>
              )}

              {activeTab === "examples" && (
                <div className="space-y-2">
                  {activePrompt.examples && activePrompt.examples.length > 0 ? (
                    activePrompt.examples.map((ex, exIdx) => (
                      <div key={exIdx} className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 font-mono text-[11px] space-y-1">
                        <span className="font-bold text-cyan-400">Example {exIdx + 1}:</span>
                        <p><span className="text-zinc-500">Input:</span> {ex.input}</p>
                        <p><span className="text-zinc-500">Output:</span> {ex.output}</p>
                        {ex.explanation && <p className="text-zinc-400 italic"><span className="text-zinc-500">Explanation:</span> {ex.explanation}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500">No explicit test cases provided for this challenge.</p>
                  )}
                </div>
              )}

              {activeTab === "constraints" && (
                <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-zinc-300">
                  {activePrompt.constraints?.map((c, cIdx) => (
                    <li key={cIdx}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Code Editor Area */}
          <div className="flex-1 min-h-[300px] relative overflow-hidden">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full w-full text-cyan-400 font-mono text-xs gap-2 bg-[#030712]">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Calibrating Monaco Sandbox...</span>
                </div>
              }
            >
              <CodeEditor
                language="python"
                value={code}
                onChange={handleCodeChange}
                height="100%"
              />
            </Suspense>
          </div>

          {/* Bottom Output Panel */}
          <div className="h-44 border-t border-zinc-800 bg-[#050b18] flex flex-col shrink-0">
            <div className="h-7 px-3 bg-[#081022] border-b border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-cyan-400" />
                <span>TERMINAL / CONSTRUCT RUN FEED</span>
              </div>
              <span className="text-[10px] text-zinc-500">
                {isRunning ? "Executing test vectors..." : runResults ? "Run finished" : "Auto-saved to localStorage"}
              </span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-zinc-400 space-y-1.5">
              {isRunning && (
                <p className="text-cyan-400 animate-pulse">&gt; Compiling and executing test harness in sandbox...</p>
              )}

              {runError && (
                <div className="p-2 rounded bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                  <span className="font-bold">&gt; ERROR:</span> {runError}
                </div>
              )}

              {runResults && runResults.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-white flex items-center justify-between pb-1 border-b border-zinc-900">
                    <span>Public Examples ({runResults.filter(r => r.passed).length}/{runResults.length} Passed)</span>
                  </div>
                  {runResults.map((r, i) => (
                    <div key={i} className="text-xs flex flex-wrap items-center gap-2 p-1.5 rounded bg-black/40 border border-zinc-900">
                      <span className={r.passed ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                        {r.passed ? "✓ PASS" : "✗ FAIL"} Example {r.example_no}:
                      </span>
                      <span className="text-zinc-500">Input: {r.input} |</span>
                      <span className="text-zinc-400">Expected: {r.expected} |</span>
                      <span className={r.passed ? "text-emerald-300" : "text-red-300"}>Output: {r.actual ?? "None"}</span>
                      {r.time_ms > 0 && <span className="text-zinc-600">({r.time_ms}ms)</span>}
                    </div>
                  ))}
                </div>
              )}

              {runStdout && (
                <div className="pt-1 text-zinc-300">
                  <span className="text-zinc-500 select-none">&gt; stdout:</span>
                  <pre className="text-xs text-cyan-200 mt-0.5 whitespace-pre-wrap">{runStdout}</pre>
                </div>
              )}

              {!isRunning && !runResults && !runError && (
                <>
                  <p className="text-cyan-400/90">&gt; LeetCode environment loaded for #{activePrompt.leetcode_id || 1} {activePrompt.title}.</p>
                  <p className="text-zinc-500">&gt; Click [Run] to execute solution against public examples.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: ARIA Mentor Secure Comms */}
        {showAriaModal && (
          <div className="w-full lg:w-96 lg:shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#030712] h-96 lg:h-full flex flex-col">
            <SecureComms
              challengeId={activePrompt.id}
              currentCode={code}
              className="h-full rounded-none border-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
