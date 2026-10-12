import React, { useState, useEffect, Suspense, lazy } from "react";
import {
  Code2,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle,
  HelpCircle,
  Terminal,
  FolderCode
} from "lucide-react";
import promptsData from "../data/construct_prompts.json";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";
import SecureComms from "../components/nexus/SecureComms";

// Lazy-load CodeEditor as required by spec
const CodeEditor = lazy(() => import("../components/nexus/CodeEditor"));

export default function Construct() {
  const [prompts] = useState(promptsData);
  const [selectedPromptId, setSelectedPromptId] = useState(promptsData[0]?.id || "arr-two-sum");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAriaModal, setShowAriaModal] = useState(false);

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

  // Filtered prompts
  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.statement.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || p.category.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", "arrays", "strings", "hash maps", "recursion", "sorting"];

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
              <StatBadge label="SANDBOX" value="SAFE" variant="cyan" size="sm" />
            </div>
            <p className="text-[10px] text-zinc-400 font-mono hidden sm:block">
              Free-practice simulator // 12 foundational Python challenges
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
        {/* Left Pane: Prompt Selector */}
        <div className="w-full lg:w-80 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-[#040816]/70 flex flex-col h-64 lg:h-full overflow-hidden">
          <div className="p-3 border-b border-zinc-800 space-y-2 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search challenges..."
                className="w-full bg-[#030712] border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:border-cyan-400 focus:outline-none"
              />
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
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60 p-1">
            {filteredPrompts.map((p) => {
              const isSelected = p.id === activePrompt.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPrompt(p.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? "bg-cyan-950/40 border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                      : "hover:bg-zinc-900/60 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400/80 uppercase">
                      {p.category}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600">Python</span>
                  </div>
                  <h4 className={`text-xs font-bold ${isSelected ? "text-white" : "text-zinc-300"}`}>
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{p.statement}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Pane: Editor & Output */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#030712]">
          {/* Challenge Statement Header Banner */}
          <div className="p-4 border-b border-zinc-800 bg-[#070e1e]/60 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-bold">
                    {activePrompt.category}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">ID: {activePrompt.id}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {activePrompt.title}
                </h2>
                <p className="text-xs text-zinc-300 mt-1 max-w-3xl leading-relaxed">
                  {activePrompt.statement}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
                  title="Reset to starter code"
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
                {/* Disabled Run Button with tooltip as required */}
                <div className="relative group">
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-500 text-xs font-mono font-bold uppercase tracking-wider cursor-not-allowed opacity-60"
                  >
                    <Play size={12} />
                    <span>Run</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                    <span className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-zinc-900 border border-cyan-500/40 text-cyan-300 rounded shadow-xl whitespace-nowrap">
                      Execution arrives in phase 6
                    </span>
                  </div>
                </div>
              </div>
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
          <div className="h-36 border-t border-zinc-800 bg-[#050b18] flex flex-col shrink-0">
            <div className="h-7 px-3 bg-[#081022] border-b border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-cyan-400" />
                <span>TERMINAL / CONSTRUCT FEED</span>
              </div>
              <span className="text-[10px] text-zinc-500">Draft auto-saved to localStorage</span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-zinc-400 space-y-1">
              <p className="text-cyan-400/90">&gt; Construct environment initialized for {activePrompt.id}.</p>
              <p className="text-zinc-500">&gt; Editor syntax checks and Shift+Alt+F formatting active.</p>
              <p className="text-zinc-600">&gt; Sandbox runner will unlock in Phase 6. Consult ARIA for hints.</p>
            </div>
          </div>
        </div>

        {/* Right Pane (or Modal on smaller screens): ARIA Mentor Secure Comms */}
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
