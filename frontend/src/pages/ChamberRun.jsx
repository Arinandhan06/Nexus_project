import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Clock,
  Send,
  Play,
  AlertTriangle,
  RotateCcw,
  Shield,
  Flame,
  ArrowLeft,
  Sparkles,
  Terminal as TerminalIcon,
  CheckCircle2,
  Lock,
  Layers,
  Cpu,
  RefreshCw,
  BookOpen,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  MessageSquare
} from "lucide-react";
import { NexusPanel, NexusButton, StatBadge, GlitchText, Terminal } from "../components/nexus";
import SecureComms from "../components/nexus/SecureComms";
import PressureOverlay from "../components/nexus/PressureOverlay";
import NexusTaunt from "../components/nexus/NexusTaunt";
import NxpToast from "../components/nexus/NxpToast";
import { PressureProvider, usePressure } from "../lib/pressure";
import api from "../lib/api";
import { ChamberWebSocketClient } from "../lib/ws";

// Lazy-load shared CodeEditor as specified in the Phase 4/5 requirements
const CodeEditor = lazy(() => import("../components/nexus/CodeEditor"));

function ChamberRunContent({
  chamberNum,
  chamberState,
  challenge,
  secondsRemaining,
  attempts,
  hintLevel,
  setHintLevel,
  code,
  setCode,
  submitting,
  errorMsg,
  showAriaModal,
  setShowAriaModal,
  lastResult,
  terminalLogs,
  setTerminalLogs,
  wsStatus,
  initChamber,
  handleSubmit,
  handleRetryTrial,
  handleRun,
  running,
  runResult,
  formatTimer,
  _currentUser,
  nexusTaunt,
  showInefficiencyAlarm,
  setShowInefficiencyAlarm,
  inefficiencyDetails,
  displayNxp = 0,
  currentStreak = 0,
  nxpToast,
  setNxpToast
}) {
  const {
    pressure,
    soundEnabled,
    reduceEffects,
    banterEnabled,
    setSoundEnabled,
    setReduceEffects,
    setBanterEnabled
  } = usePressure();

  return (
    <div className="min-h-screen w-full flex flex-col bg-black text-zinc-200 relative">
      {/* Pressure Engine Visual Overlay (SCRUM-21) */}
      <PressureOverlay />

      {/* NXP Award Toast (SCRUM-26) */}
      {nxpToast && (
        <NxpToast
          show={nxpToast.show}
          points={nxpToast.points}
          multiplier={nxpToast.multiplier}
          streak={nxpToast.streak}
          message={nxpToast.message}
          onClose={() => setNxpToast((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/* TOP HUD */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Chamber Identification */}
          <div className="flex items-center gap-3">
            <Link to="/chambers">
              <button className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft size={16} />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 font-bold tracking-wider uppercase">
                  CHAMBER 0{chamberNum} //
                </span>
                <StatBadge
                  label="STATE"
                  value={chamberState}
                  variant={
                    chamberState === "ACTIVE"
                      ? "cyan"
                      : chamberState === "EVALUATING"
                      ? "amber"
                      : chamberState === "PASSED"
                      ? "green"
                      : chamberState === "FAILED" || chamberState === "EXPIRED"
                      ? "red"
                      : "neutral"
                  }
                  size="sm"
                />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
                {challenge?.title || `Chamber ${chamberNum}`}
              </h1>
            </div>
          </div>

          {/* Real-time HUD Metrics: Timer, Attempts, Streak, Pressure Toggles, ARIA Hints */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Server Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm ${
                secondsRemaining !== null && secondsRemaining < 60
                  ? "bg-red-950/50 border-red-500/50 text-red-400 animate-pulse"
                  : "bg-zinc-900 border-zinc-800 text-cyan-400"
              }`}
            >
              <Clock size={16} />
              <span className="font-bold tracking-wider">
                {secondsRemaining !== null && secondsRemaining <= 0
                  ? "EXPIRED"
                  : formatTimer(secondsRemaining)}
              </span>
            </div>

            {/* Attempts Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <RotateCcw size={14} className="text-zinc-500" />
              <span>ATTEMPT:</span>
              <span className="text-white font-bold">{attempts}</span>
            </div>

            {/* Total NXP Badge with Count-Up */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <Sparkles size={14} className="text-cyan-400" />
              <span>NXP:</span>
              <span className="text-cyan-300 font-bold tracking-wider">
                {displayNxp}
              </span>
            </div>

            {/* Streak Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <Flame size={14} className={currentStreak > 0 ? "text-amber-400 fill-amber-400/30" : "text-zinc-600"} />
              <span>STREAK:</span>
              <span className={`font-bold ${currentStreak > 0 ? "text-amber-300" : "text-zinc-500"}`}>
                {currentStreak}
              </span>
            </div>

            {/* TOGGLE 1: Enable sound / Fan Audio Feedback (SCRUM-21) */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                soundEnabled
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
              title={soundEnabled ? "Mute audio fan drone" : "Enable sound (fan drone on high pressure)"}
            >
              {soundEnabled ? (
                <Volume2 size={14} className="text-emerald-400 shrink-0" />
              ) : (
                <VolumeX size={14} className="text-zinc-500 shrink-0" />
              )}
              <span className="hidden md:inline">SOUND:</span>
              <span className="font-bold">{soundEnabled ? "ON" : "OFF"}</span>
            </button>

            {/* TOGGLE 2: Reduce effects (SCRUM-21) */}
            <button
              onClick={() => setReduceEffects(!reduceEffects)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                reduceEffects
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
              title="Reduce effects (disables shake & scanlines, preserves static tint)"
            >
              {reduceEffects ? (
                <EyeOff size={14} className="text-amber-400 shrink-0" />
              ) : (
                <Eye size={14} className="text-cyan-400 shrink-0" />
              )}
              <span className="hidden md:inline">FX:</span>
              <span className="font-bold">{reduceEffects ? "REDUCED" : "FULL"}</span>
            </button>

            {/* TOGGLE 3: NEXUS banter (SCRUM-23) */}
            <button
              onClick={() => setBanterEnabled(!banterEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                banterEnabled
                  ? "bg-red-950/30 border-red-500/40 text-red-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white"
              }`}
              title="Toggle NEXUS AI mocking banter"
            >
              <MessageSquare size={14} className={banterEnabled ? "text-red-400 shrink-0" : "text-zinc-500 shrink-0"} />
              <span className="hidden md:inline">BANTER:</span>
              <span className="font-bold">{banterEnabled ? "ON" : "OFF"}</span>
            </button>

            {/* ARIA Hints Used */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <Sparkles size={14} className="text-cyan-400" />
              <span>ARIA:</span>
              <span className="text-cyan-300 font-bold">{hintLevel}/3</span>
            </div>

            {/* ARIA Mentor Drawer Toggle */}
            <NexusButton
              variant="outline"
              size="sm"
              icon={Sparkles}
              onClick={() => setShowAriaModal(!showAriaModal)}
            >
              ARIA Mentor
            </NexusButton>

            {/* Reset Timer Button when Expired or Failed */}
            {(chamberState === "EXPIRED" || chamberState === "FAILED") && (
              <NexusButton
                variant="amber"
                size="sm"
                icon={RotateCcw}
                onClick={handleRetryTrial}
                className="font-bold border-amber-500 text-amber-300 animate-pulse"
              >
                Reset Timer
              </NexusButton>
            )}

            {/* Run Public Tests Action Button */}
            <NexusButton
              variant="outline"
              size="sm"
              icon={Play}
              onClick={handleRun}
              disabled={running || submitting || chamberState === "EVALUATING"}
              className="font-bold border-emerald-500/60 text-emerald-300 hover:bg-emerald-950/40"
              title="Test code against public examples (Ctrl+')"
            >
              {running ? "Testing..." : "Run (Ctrl+')"}
            </NexusButton>

            {/* Submit Action Button */}
            <NexusButton
              variant="cyan"
              size="sm"
              icon={Send}
              onClick={handleSubmit}
              disabled={submitting || chamberState === "EVALUATING"}
              className="font-bold"
            >
              {submitting
                ? "Submitting..."
                : chamberState === "EVALUATING"
                ? "Evaluating..."
                : "Submit (Ctrl+Enter)"}
            </NexusButton>
          </div>
        </div>
      </header>

      {/* EXPIRED BANNER */}
      {chamberState === "EXPIRED" && (
        <div className="bg-amber-950/80 border-b border-amber-500/50 px-4 py-3 text-xs font-mono text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>TRIAL TIMER EXPIRED:</strong> The 20-minute chamber window has ended. Click <strong>"Reset Timer &amp; Resume"</strong> to restart the mission clock and submit your solution.
            </span>
          </div>
          <NexusButton
            variant="amber"
            size="sm"
            icon={RotateCcw}
            onClick={handleRetryTrial}
            className="font-bold border-amber-400 text-amber-200 hover:bg-amber-500/20"
          >
            Reset Timer &amp; Resume
          </NexusButton>
        </div>
      )}

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="bg-red-950/60 border-b border-red-500/40 px-4 py-2.5 text-xs font-mono text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={initChamber}
            className="text-red-400 hover:text-white uppercase font-bold text-[11px] underline ml-4"
          >
            Retry Session
          </button>
        </div>
      )}

      {/* MAIN SPLIT WORKSPACE */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT COLUMN: Challenge Directive & Specifications (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-1">
          {/* Story Narrative Box */}
          <NexusPanel variant="neutral" className="p-5 space-y-3 border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
              <BookOpen size={14} />
              <span>INCIDENT DIRECTIVE</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans italic border-l-2 border-cyan-500/60 pl-3 py-1">
              {challenge?.story || "Incident report compiling..."}
            </p>
          </NexusPanel>

          {/* Problem Statement */}
          <NexusPanel variant="neutral" className="p-5 space-y-4 border-zinc-800 bg-zinc-950/70">
            <h2 className="text-base font-bold text-white tracking-wide">
              Mission Statement
            </h2>
            <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-2 whitespace-pre-wrap font-sans">
              {challenge?.statement || "Loading problem parameters..."}
            </div>

            {/* Constraints */}
            {challenge?.constraints && challenge.constraints.length > 0 && (
              <div className="pt-3 border-t border-zinc-900 space-y-2">
                <div className="text-xs font-mono text-zinc-400 uppercase font-semibold">
                  Constraints:
                </div>
                <ul className="list-disc list-inside text-xs font-mono text-zinc-400 space-y-1">
                  {challenge.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </NexusPanel>

          {/* Public Examples */}
          {challenge?.public_examples && challenge.public_examples.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                Public Test Examples:
              </div>
              {challenge.public_examples.map((ex, idx) => (
                <NexusPanel
                  key={idx}
                  variant="neutral"
                  className="p-4 space-y-2 text-xs font-mono bg-zinc-950/90 border-zinc-800/80"
                >
                  <div className="text-cyan-400 font-semibold">Example 0{idx + 1}:</div>
                  <div className="bg-black/60 p-2.5 rounded border border-zinc-900 space-y-1">
                    <div>
                      <span className="text-zinc-500 select-none">Input: </span>
                      <span className="text-zinc-200">{ex.input}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 select-none">Output: </span>
                      <span className="text-emerald-300">{ex.output}</span>
                    </div>
                    {ex.explanation && (
                      <div className="text-[11px] text-zinc-400 pt-1 font-sans">
                        <span className="text-zinc-500 font-mono">Explanation: </span>
                        {ex.explanation}
                      </div>
                    )}
                  </div>
                </NexusPanel>
              ))}
            </div>
          )}

          {/* Security Assurance Notice */}
          <div className="text-[11px] font-mono text-zinc-500 px-2 py-1 flex items-center gap-1.5">
            <Shield size={12} className="text-cyan-500/70" />
            <span>Hidden test vectors are isolated inside NEXUS secure runtime.</span>
          </div>
        </div>

        {/* RIGHT COLUMN: CodeEditor & Live Terminal (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4 h-[calc(100vh-140px)]">
          {/* Top: Code Editor */}
          <div className="flex-1 min-h-[350px] rounded-xl overflow-hidden border border-zinc-800 bg-[#090d16] flex flex-col shadow-2xl">
            <div className="px-3 py-2 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-semibold">solution.py</span>
                <span className="text-[10px] text-zinc-500">// Python 3.11</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Autosaved to local checkpoint
              </div>
            </div>

            <div className="flex-1 w-full h-full">
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center text-xs font-mono text-zinc-500">
                    Initializing Monaco Editor...
                  </div>
                }
              >
                <CodeEditor
                  language="python"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  readOnly={chamberState === "EVALUATING" || chamberState === "EXPIRED"}
                  height="100%"
                />
              </Suspense>
            </div>
          </div>

          {/* Bottom: Live Terminal Screen with Inefficiency Alarm & NEXUS Taunts */}
          <div
            className={`h-[240px] shrink-0 relative flex flex-col ${
              pressure >= 1 && !reduceEffects ? "nexus-pressure-active" : ""
            }`}
          >
            {/* O(n^2) Red Scanline Sweep & Inefficiency Alarm (SCRUM-22) */}
            {showInefficiencyAlarm && (
              <div className="relative overflow-hidden z-20 shrink-0">
                {!reduceEffects && <div className="nexus-scanline-sweep" />}
                <div className="bg-red-950/95 border border-red-500/80 p-2.5 px-3 rounded-t-xl text-red-200 text-xs font-mono shadow-xl flex items-center justify-between backdrop-blur-md">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-red-300 tracking-wide uppercase">
                        WARNING: INEFFICIENT ALGORITHM DETECTED. Estimated {inefficiencyDetails.estimated}, expected {inefficiencyDetails.expected}.
                      </div>
                      {inefficiencyDetails.suggestion && (
                        <div className="text-[11px] text-zinc-300 font-sans italic">
                          Suggestion: {inefficiencyDetails.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInefficiencyAlarm(false)}
                    className="text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 bg-black/50 rounded border border-red-500/40 shrink-0 ml-3"
                  >
                    DISMISS
                  </button>
                </div>
              </div>
            )}

            {/* NEXUS AI Antagonist Taunt Component (SCRUM-23) */}
            {nexusTaunt && (
              <div className="px-2 pt-1 shrink-0">
                <NexusTaunt text={nexusTaunt} />
              </div>
            )}

            {/* Terminal Screen */}
            <div className="flex-1 min-h-0">
              <Terminal
                chamberNo={chamberNum}
                logs={terminalLogs}
                connectionStatus={wsStatus}
                result={lastResult}
                runResult={runResult}
                className="h-full"
                onClear={() => setTerminalLogs([])}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ARIA MENTOR MODAL / SLIDEOVER */}
      {showAriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl h-[600px] flex flex-col">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowAriaModal(false)}
                className="text-xs font-mono text-zinc-400 hover:text-white px-3 py-1 bg-zinc-900 rounded border border-zinc-800"
              >
                Close ARIA Comms [Esc]
              </button>
            </div>
            <div className="flex-1">
              <SecureComms
                challengeId={challenge?.id || `chamber-${chamberNum}`}
                currentCode={code}
                onHintReceived={(newLevel) => setHintLevel(newLevel)}
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChamberRun({ currentUser }) {
  const { chamberNo } = useParams();
  const navigate = useNavigate();
  const chamberNum = parseInt(chamberNo, 10) || 1;

  // Chamber and Challenge State
  const [chamberState, setChamberState] = useState("LOADING"); // LOADING | ACTIVE | EVALUATING | PASSED | FAILED | EXPIRED | ERROR
  const [challenge, setChallenge] = useState(null);
  const [deadlineAt, setDeadlineAt] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [attempts, setAttempts] = useState(1);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showAriaModal, setShowAriaModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // NEXUS Taunt and Inefficiency Alarm States (SCRUM-22, SCRUM-23)
  const [nexusTaunt, setNexusTaunt] = useState(null);
  const [showInefficiencyAlarm, setShowInefficiencyAlarm] = useState(false);
  const [inefficiencyDetails, setInefficiencyDetails] = useState({
    estimated: "O(n^2)",
    expected: "O(n)",
    suggestion: "Look for a way to avoid the inner loop, such as a lookup table."
  });

  // NXP, Streak & Award Telemetry (SCRUM-26, SCRUM-27)
  const [currentStreak, setCurrentStreak] = useState(() => currentUser?.current_streak ?? 0);
  const [totalNxp, setTotalNxp] = useState(() => currentUser?.total_nxp ?? 0);
  const [displayNxp, setDisplayNxp] = useState(() => currentUser?.total_nxp ?? 0);
  const [nxpToast, setNxpToast] = useState({
    show: false,
    points: 0,
    multiplier: 1.0,
    streak: 0,
    message: ""
  });
  const prevNxpRef = useRef(currentUser?.total_nxp ?? 0);

  // HUD count-up animation for Total NXP
  useEffect(() => {
    const startVal = prevNxpRef.current;
    const endVal = totalNxp;
    if (startVal === endVal) return;

    let startTime = null;
    let frameId;
    const duration = 1200;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(startVal + (endVal - startVal) * ease);
      setDisplayNxp(val);
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        prevNxpRef.current = endVal;
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [totalNxp]);

  // Live Terminal Logs & WS Status
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [wsStatus, setWsStatus] = useState("connecting");
  const wsClientRef = useRef(null);

  // Helper to append logs to live terminal
  const addLog = useCallback((log) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    if (typeof log === "string") {
      setTerminalLogs((prev) => [...prev, { text: log, timestamp: timeStr, type: "info" }]);
    } else {
      setTerminalLogs((prev) => [...prev, { ...log, timestamp: timeStr }]);
    }
  }, []);

  // 1. Initial Chamber Entry & Data Fetching
  const initChamber = useCallback(async () => {
    try {
      setChamberState("LOADING");
      setErrorMsg(null);
      setLastResult(null);
      setNexusTaunt(null);
      setShowInefficiencyAlarm(false);
      addLog({ text: `Initializing connection to Chamber ${chamberNum} Core...`, type: "system" });

      // First check if current chamber info already active
      let chamberData = null;
      try {
        const currentRes = await api.get(`/chambers/${chamberNum}/current`);
        chamberData = currentRes.data;
      } catch (err) {
        console.warn("Chamber current status check:", err);
      }

      // If chamber is not yet ACTIVE, EVALUATING, or PASSED (e.g. UNLOCKED or PREPARING), activate trial!
      if (!chamberData || chamberData.state === "UNLOCKED" || chamberData.state === "PREPARING") {
        try {
          const enterRes = await api.post(`/chambers/${chamberNum}/enter`);
          chamberData = enterRes.data;
          addLog({ text: `Chamber ${chamberNum} trial activated. Countdown timer started.`, type: "system" });
        } catch (enterErr) {
          console.warn("Enter chamber error:", enterErr);
          if (!chamberData) {
            throw enterErr;
          }
        }
      }

      const activeState = chamberData.state || "ACTIVE";
      setChamberState(activeState);
      setChallenge(chamberData.challenge);
      setDeadlineAt(chamberData.deadline_at);
      const currAttempts = chamberData.attempts ?? 1;
      setAttempts(currAttempts);
      setFailedAttempts(Math.max(0, currAttempts - 1));

      // Check saved draft or fallback to starter code
      let initialCode = chamberData.challenge?.starter_code || "# Write solution here\n";
      try {
        const savedDraft = localStorage.getItem(`chamber_draft_${currentUser?.id || "user"}_${chamberNum}`);
        if (savedDraft && savedDraft.trim().length > 0) {
          initialCode = savedDraft;
          addLog({ text: `Restored local checkpoint draft for Chamber ${chamberNum}.`, type: "info" });
        }
      } catch (e) {
        console.warn("Local draft access failed:", e);
      }
      setCode(initialCode);

      // Calculate remaining seconds
      if (chamberData.seconds_remaining !== undefined && chamberData.seconds_remaining !== null) {
        setSecondsRemaining(chamberData.seconds_remaining);
      } else if (chamberData.deadline_at) {
        const dlStr = String(chamberData.deadline_at);
        const norm = dlStr.endsWith("Z") || dlStr.includes("+") ? dlStr : `${dlStr}Z`;
        const dlMs = new Date(norm).getTime();
        if (!isNaN(dlMs)) {
          const remaining = Math.max(0, Math.floor((dlMs - Date.now()) / 1000));
          setSecondsRemaining(remaining);
        }
      }

      addLog({
        text: `Chamber ${chamberNum} link active: "${chamberData.challenge?.title}". State: ${activeState}.`,
        type: "success"
      });

      // Fetch ARIA hint level for this challenge
      if (chamberData.challenge?.id) {
        try {
          const ariaRes = await api.get(`/aria/history?challenge_id=${chamberData.challenge.id}`);
          setHintLevel(ariaRes.data.hint_level || 0);
        } catch {
          // Non-blocking
        }
      }

      // Sync latest profile telemetry (NXP and current streak)
      try {
        const meRes = await api.get("/me");
        if (meRes.data) {
          if (meRes.data.total_nxp !== undefined) setTotalNxp(meRes.data.total_nxp);
          if (meRes.data.current_streak !== undefined) setCurrentStreak(meRes.data.current_streak);
        }
      } catch {
        // Non-blocking
      }
    } catch (err) {
      console.error("Chamber init failure:", err);
      const detail = err.response?.data?.detail || "Failed to initialize Chamber session.";
      setErrorMsg(detail);
      setChamberState("ERROR");
      addLog({ text: `ERROR: ${detail}`, type: "error" });
    }
  }, [chamberNum, currentUser?.id, addLog]);

  useEffect(() => {
    initChamber();
  }, [initChamber]);

  // 2. WebSocket Connection Lifecycle
  useEffect(() => {
    const client = new ChamberWebSocketClient({
      onStatusChange: (status) => {
        setWsStatus(status);
        if (status === "connected") {
          addLog({ text: `Encrypted WebSocket channel bound to chamber core.`, type: "system" });
        } else if (status === "reconnecting") {
          addLog({ text: `WS channel lost. Acquiring new ticket & reconnecting...`, type: "warn" });
        }
      },
      onMessage: (msg) => {
        if (msg.type === "judging" && msg.payload) {
          addLog({
            text: msg.payload.message || "Judging in progress...",
            type: "system"
          });
        } else if (msg.type === "state" && msg.payload) {
          addLog({
            text: `Remote state synchronization: ${msg.payload.state}`,
            type: "info"
          });
          if (msg.payload.state) {
            setChamberState(msg.payload.state);
          }
        } else if (msg.type === "result" && msg.payload) {
          const { passed, tests = [], complexity, cleanliness, findings = [], expected, inefficient } = msg.payload;
          const passedCount = tests.filter((t) => t.status === "passed").length;

          addLog({
            text: `Grading completed: ${passedCount}/${tests.length} tests passed`,
            type: passed ? "success" : "error"
          });
          if (complexity) {
            addLog({
              text: `complexity: ${complexity}`,
              type: "info"
            });
          }
          if (cleanliness !== undefined) {
            addLog({
              text: `cleanliness: ${cleanliness}/100 (${findings.length} findings)`,
              type: "info"
            });
          }

          if (!passed) {
            setFailedAttempts((prev) => prev + 1);
            // Shake burst handled via triggerBurstShake on root
            const root = document.getElementById("root");
            if (root) {
              root.classList.add("nexus-pressure-shake");
              setTimeout(() => root.classList.remove("nexus-pressure-shake"), 320);
            }
          }

          // Inefficiency alarm trigger (SCRUM-22)
          if (inefficient) {
            const estClean = complexity?.replace(/\s*\(estimated\)/, "") || "O(n^2)";
            const expClean = expected || "O(n)";
            const findingSuggestion = findings.find((f) => f.suggestion)?.suggestion ||
              "Look for a way to avoid the inner loop, such as a lookup table.";

            setShowInefficiencyAlarm(true);
            setInefficiencyDetails({
              estimated: estClean,
              expected: expClean,
              suggestion: findingSuggestion
            });

            addLog({
              text: `WARNING: INEFFICIENT ALGORITHM DETECTED. Estimated ${estClean}, expected ${expClean}.`,
              type: "error",
              prefix: "ALARM >"
            });
            addLog({
              text: `Suggestion: ${findingSuggestion}`,
              type: "warn",
              prefix: "ADVISORY >"
            });
          } else {
            setShowInefficiencyAlarm(false);
          }

          if (!passed) {
            setCurrentStreak(0);
          }
          setLastResult(msg.payload);
          setChamberState(passed ? "PASSED" : "FAILED");
        } else if (msg.type === "progress" && msg.payload) {
          const { nxp_awarded = 0, total_nxp = 0, streak = 0, multiplier = 1.0 } = msg.payload;
          setCurrentStreak(streak);
          setTotalNxp(total_nxp);

          if (nxp_awarded > 0) {
            setNxpToast({
              show: true,
              points: nxp_awarded,
              multiplier,
              streak,
              message: `Chamber 0${chamberNum} pass verified! Matrix recalibrated.`
            });
            addLog({
              text: `[AWARD]: +${nxp_awarded} NXP granted (streak x${Number(multiplier).toFixed(1)}). Total: ${total_nxp} NXP.`,
              type: "success",
              prefix: "REWARD >"
            });
          } else {
            addLog({
              text: `[CHAMBER PASS]: Streak: ${streak}. (Repeat submission - award already claimed).`,
              type: "info",
              prefix: "NEXUS >"
            });
          }
        } else if (msg.type === "nexus" && msg.payload) {
          // SCRUM-23: Handle incoming NEXUS antagonist taunt
          const tauntText = msg.payload.text || "";
          setNexusTaunt(tauntText);
          addLog({
            text: `[NEXUS]: ${tauntText}`,
            type: "error",
            prefix: "[NEXUS] >"
          });
        }
      },
      onError: () => {
        // Handled via onStatusChange
      }
    });

    wsClientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
  }, [addLog, chamberNum]);

  // 3. Server-Controlled Countdown Timer
  useEffect(() => {
    if (!deadlineAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const dlStr = String(deadlineAt);
      const norm = dlStr.endsWith("Z") || dlStr.includes("+") ? dlStr : `${dlStr}Z`;
      const deadline = new Date(norm).getTime();
      const diffSec = Math.max(0, Math.floor((deadline - now) / 1000));
      setSecondsRemaining(diffSec);

      if (diffSec <= 0) {
        clearInterval(timer);
        if (chamberState === "ACTIVE") {
          setChamberState("EXPIRED");
          addLog({
            text: `DEADLINE EXPIRED: Time allocation reached zero. Chamber trial stopped.`,
            type: "error"
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadlineAt, chamberState, addLog]);

  // 4. Autosave draft every 5 seconds inside try/catch
  useEffect(() => {
    const autosaveTimer = setInterval(() => {
      if (!code || chamberState !== "ACTIVE") return;
      try {
        localStorage.setItem(`chamber_draft_${currentUser?.id || "user"}_${chamberNum}`, code);
      } catch (e) {
        console.warn("Autosave draft failed:", e);
      }
    }, 5000);

    return () => clearInterval(autosaveTimer);
  }, [code, chamberNum, currentUser?.id, chamberState]);

  // 5. Warn before leaving during an ACTIVE Chamber
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (chamberState === "ACTIVE") {
        e.preventDefault();
        e.returnValue = "Chamber trial is active! Leaving will not pause the server countdown timer.";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [chamberState]);

  // Retry / Reset Chamber Trial sequence
  const handleRetryTrial = useCallback(async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      addLog({ text: `Resetting Chamber ${chamberNum} trial timer...`, type: "system" });
      const enterRes = await api.post(`/chambers/${chamberNum}/enter`);
      if (enterRes.data) {
        setChamberState("ACTIVE");
        if (enterRes.data.deadline_at) setDeadlineAt(enterRes.data.deadline_at);
        const secs = enterRes.data.seconds_remaining ?? 1200;
        setSecondsRemaining(secs);
        if (enterRes.data.challenge) setChallenge(enterRes.data.challenge);
        setAttempts(enterRes.data.attempts ?? (attempts + 1));
        addLog({
          text: `Chamber ${chamberNum} trial restarted. 20:00 countdown active.`,
          type: "success"
        });
      }
    } catch (err) {
      console.error("Retry chamber error:", err);
      const detail = err.response?.data?.detail || "Could not reset Chamber trial.";
      setErrorMsg(detail);
      addLog({ text: `RESET ERROR: ${detail}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [chamberNum, attempts, addLog]);

  // 6. Submit Code Solution
  const handleSubmit = useCallback(async () => {
    if (submitting || chamberState === "EVALUATING") return;

    if (!code || code.trim().length === 0) {
      addLog({ text: `Cannot submit empty solution.`, type: "warn" });
      return;
    }

    // Limit code to 20 KB
    const codeBytes = new Blob([code]).size;
    if (codeBytes > 20 * 1024) {
      addLog({ text: `Submission rejected: Code size (${(codeBytes / 1024).toFixed(1)} KB) exceeds 20 KB limit.`, type: "error" });
      return;
    }

    // Auto-enter or reset chamber if state is EXPIRED, UNLOCKED, PREPARING, or FAILED
    if (chamberState === "EXPIRED" || chamberState === "UNLOCKED" || chamberState === "PREPARING" || chamberState === "FAILED") {
      try {
        addLog({ text: `Activating fresh Chamber ${chamberNum} trial sequence...`, type: "system" });
        const enterRes = await api.post(`/chambers/${chamberNum}/enter`);
        if (enterRes.data) {
          setChamberState("ACTIVE");
          if (enterRes.data.deadline_at) setDeadlineAt(enterRes.data.deadline_at);
          const secs = enterRes.data.seconds_remaining ?? 1200;
          setSecondsRemaining(secs);
          if (enterRes.data.challenge) setChallenge(enterRes.data.challenge);
          setAttempts(enterRes.data.attempts ?? (attempts + 1));
        }
      } catch (enterErr) {
        const detail = enterErr.response?.data?.detail || "Could not activate Chamber trial.";
        addLog({ text: `ACTIVATION ERROR: ${detail}`, type: "error" });
        return;
      }
    }

    try {
      setSubmitting(true);
      setNexusTaunt(null);
      setShowInefficiencyAlarm(false);
      addLog({
        text: `Submitting payload (${codeBytes} bytes) to Chamber ${chamberNum} Core...`,
        type: "system",
        prefix: `nexus@chamber-${chamberNum} $`
      });

      const res = await api.post(`/chambers/${chamberNum}/submit`, {
        code,
        language: "python"
      });

      if (res.data.status === "evaluation_pending") {
        setChamberState("EVALUATING");
        addLog({
          text: `[STATUS 200] Evaluation pending. Code logged to chamber_attempts. Automated grading in progress.`,
          type: "success"
        });
      }
    } catch (err) {
      const errDetail = err.response?.data?.detail || "Submission encountered an error.";
      addLog({ text: `SUBMISSION ERROR: ${errDetail}`, type: "error" });
      if (err.response?.status === 400 && errDetail.includes("deadline")) {
        setChamberState("EXPIRED");
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, chamberState, code, chamberNum, addLog]);

  // 6b. Run Code against Public Examples only
  const handleRun = useCallback(async () => {
    if (running || submitting) return;

    if (!code || !code.trim()) {
      addLog({ text: "Cannot test empty solution.", type: "warn" });
      return;
    }

    try {
      setRunning(true);
      addLog({
        text: `Executing solution against public test examples...`,
        type: "system",
        prefix: `nexus@test-sandbox $`
      });

      const res = await api.post(`/chambers/${chamberNum}/run`, {
        code,
        language: "python"
      });

      setRunResult(res.data);
      if (res.data.success) {
        const passedCount = res.data.results?.filter((r) => r.passed).length ?? 0;
        const total = res.data.results?.length ?? 0;
        addLog({
          text: `Public test run complete: ${passedCount}/${total} examples passed.`,
          type: res.data.all_passed ? "success" : "warn"
        });
        if (!res.data.all_passed) {
          const failed = res.data.results?.find((r) => !r.passed);
          if (failed?.error) {
            addLog({ text: `Runtime error: ${failed.error}`, type: "error" });
          }
        }
      } else {
        addLog({ text: `Test run error: ${res.data.error || "Execution failed."}`, type: "error" });
      }
    } catch (err) {
      console.error("Run tests failed:", err);
      const detail = err.response?.data?.detail || "Failed to execute public tests.";
      addLog({ text: `TEST ERROR: ${detail}`, type: "error" });
    } finally {
      setRunning(false);
    }
  }, [chamberNum, code, running, submitting, addLog]);

  // Keyboard shortcut: Ctrl+Enter to Submit, Ctrl+' to Run
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit, handleRun]);

  // Format seconds into MM:SS
  const formatTimer = (totalSec) => {
    if (totalSec === null || totalSec === undefined) return "--:--";
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const totalSeconds = challenge?.time_limit_seconds || 1200;

  return (
    <PressureProvider
      secondsRemaining={secondsRemaining}
      totalSeconds={totalSeconds}
      failedAttempts={failedAttempts}
      inefficient={Boolean(lastResult?.inefficient)}
    >
      <ChamberRunContent
        chamberNum={chamberNum}
        chamberState={chamberState}
        setChamberState={setChamberState}
        challenge={challenge}
        deadlineAt={deadlineAt}
        secondsRemaining={secondsRemaining}
        setSecondsRemaining={setSecondsRemaining}
        attempts={attempts}
        setAttempts={setAttempts}
        hintLevel={hintLevel}
        setHintLevel={setHintLevel}
        code={code}
        setCode={setCode}
        submitting={submitting}
        setSubmitting={setSubmitting}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        showAriaModal={showAriaModal}
        setShowAriaModal={setShowAriaModal}
        lastResult={lastResult}
        setLastResult={setLastResult}
        terminalLogs={terminalLogs}
        setTerminalLogs={setTerminalLogs}
        wsStatus={wsStatus}
        addLog={addLog}
        initChamber={initChamber}
        handleSubmit={handleSubmit}
        handleRetryTrial={handleRetryTrial}
        handleRun={handleRun}
        running={running}
        runResult={runResult}
        formatTimer={formatTimer}
        currentUser={currentUser}
        nexusTaunt={nexusTaunt}
        showInefficiencyAlarm={showInefficiencyAlarm}
        setShowInefficiencyAlarm={setShowInefficiencyAlarm}
        inefficiencyDetails={inefficiencyDetails}
        displayNxp={displayNxp}
        currentStreak={currentStreak}
        nxpToast={nxpToast}
        setNxpToast={setNxpToast}
      />
    </PressureProvider>
  );
}
