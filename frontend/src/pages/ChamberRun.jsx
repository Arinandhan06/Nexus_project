import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Clock,
  Send,
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
  BookOpen
} from "lucide-react";
import { NexusPanel, NexusButton, StatBadge, GlitchText, Terminal } from "../components/nexus";
import SecureComms from "../components/nexus/SecureComms";
import api from "../lib/api";
import { ChamberWebSocketClient } from "../lib/ws";

// Lazy-load shared CodeEditor as specified in the Phase 4/5 requirements
const CodeEditor = lazy(() => import("../components/nexus/CodeEditor"));

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
  const [hintLevel, setHintLevel] = useState(0);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showAriaModal, setShowAriaModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Live Terminal Logs & WS Status
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [wsStatus, setWsStatus] = useState("connecting"); // connecting | connected | reconnecting | disconnected
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
      addLog({ text: `Initializing connection to Chamber ${chamberNum} Core...`, type: "system" });

      // First check if current chamber info already active
      let chamberData = null;
      try {
        const currentRes = await api.get(`/chambers/${chamberNum}/current`);
        chamberData = currentRes.data;
      } catch (err) {
        // If not active, enter chamber
        if (err.response?.status === 400 || err.response?.status === 404) {
          const enterRes = await api.post(`/chambers/${chamberNum}/enter`);
          chamberData = enterRes.data;
        } else {
          throw err;
        }
      }

      const activeState = chamberData.state || "ACTIVE";
      setChamberState(activeState);
      setChallenge(chamberData.challenge);
      setDeadlineAt(chamberData.deadline_at);
      setAttempts(chamberData.attempts ?? 1);

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
      if (chamberData.deadline_at) {
        const remaining = Math.max(0, Math.floor((new Date(chamberData.deadline_at).getTime() - Date.now()) / 1000));
        setSecondsRemaining(remaining);
      } else if (chamberData.seconds_remaining) {
        setSecondsRemaining(chamberData.seconds_remaining);
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
          const { passed, tests = [], complexity, cleanliness, findings = [] } = msg.payload;
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

          setLastResult(msg.payload);
          setChamberState(passed ? "PASSED" : "FAILED");
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
  }, [addLog]);

  // 3. Server-Controlled Countdown Timer
  useEffect(() => {
    if (!deadlineAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const deadline = new Date(deadlineAt).getTime();
      const diffSec = Math.max(0, Math.floor((deadline - now) / 1000));
      setSecondsRemaining(diffSec);

      if (diffSec <= 0) {
        clearInterval(timer);
        if (chamberState === "ACTIVE") {
          setChamberState("EXPIRED");
          addLog({
            text: `DEADLINE EXPIRED: Time allocation reached zero. Chamber closing.`,
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

  // 6. Submit Code Solution
  const handleSubmit = useCallback(async () => {
    if (submitting || chamberState === "EVALUATING") return;

    if (chamberState === "EXPIRED") {
      addLog({ text: `Cannot submit: Deadline has expired.`, type: "error" });
      return;
    }

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

    try {
      setSubmitting(true);
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
          text: `[STATUS 200] Evaluation pending. Code logged to chamber_attempts. Automated grading activates in Phase 6.`,
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

  // Keyboard shortcut: Ctrl+Enter (or Cmd+Enter)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit]);

  // Format seconds into MM:SS
  const formatTimer = (totalSec) => {
    if (totalSec === null || totalSec === undefined) return "--:--";
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-black text-zinc-200">
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

          {/* Real-time HUD Metrics: Timer, Attempts, Streak, ARIA Hints */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
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

            {/* Streak Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <Flame size={14} className="text-amber-400" />
              <span>STREAK:</span>
              <span className="text-amber-300 font-bold">
                {currentUser?.streak ?? 1}D
              </span>
            </div>

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

            {/* Submit Action Button */}
            <NexusButton
              variant="cyan"
              size="sm"
              icon={Send}
              onClick={handleSubmit}
              disabled={submitting || chamberState === "EVALUATING" || chamberState === "EXPIRED"}
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

          {/* Bottom: Live Terminal Screen */}
          <div className="h-[240px] shrink-0">
            <Terminal
              chamberNo={chamberNum}
              logs={terminalLogs}
              connectionStatus={wsStatus}
              result={lastResult}
              className="h-full"
              onClear={() => setTerminalLogs([])}
            />
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
