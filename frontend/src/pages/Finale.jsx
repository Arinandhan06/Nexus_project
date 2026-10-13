import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Send,
  AlertTriangle,
  RotateCcw,
  Shield,
  Flame,
  ArrowRight,
  Sparkles,
  Terminal as TerminalIcon,
  CheckCircle2,
  Lock,
  Cpu,
  RefreshCw,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Award,
  Check,
  XCircle,
  HelpCircle
} from "lucide-react";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";
import PressureOverlay from "../components/nexus/PressureOverlay";
import NexusTaunt from "../components/nexus/NexusTaunt";
import { PressureProvider, usePressure } from "../lib/pressure";
import api from "../lib/api";
import { ChamberWebSocketClient } from "../lib/ws";

const CodeEditor = lazy(() => import("../components/nexus/CodeEditor"));

function FinaleContent({ currentUser }) {
  const { soundEnabled, setSoundEnabled, reduceEffects, setReduceEffects } = usePressure();

  // State machine
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [prereqLocked, setPrereqLocked] = useState(false);
  const [finaleData, setFinaleData] = useState(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState(1200);
  const [isExpired, setIsExpired] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");

  // Interviewer dialogue
  const [interviewerText, setInterviewerText] = useState(
    "Welcome to the Core, Cadet. Show me what your code is made of."
  );

  // Round 1 (Coding) State
  const [codingChallenge, setCodingChallenge] = useState(null);
  const [code, setCode] = useState(
    'def trap_coolant(height: list[int]) -> int:\n    """\n    Calculate trapped coolant units.\n    Time Complexity required: O(n)\n    Space Complexity: O(1)\n    """\n    pass\n'
  );
  const [codingSubmitting, setCodingSubmitting] = useState(false);
  const [codingResult, setCodingResult] = useState(null);

  // Round 2 (Quiz) State
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // Round 3 (System Design) State
  const [designPrompt, setDesignPrompt] = useState(
    "Design a High-Throughput Distributed Rate Limiter capable of handling 500,000 requests per second across multi-region edge gateways."
  );
  const [designAnswer, setDesignAnswer] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [designSubmitting, setDesignSubmitting] = useState(false);

  // Results State
  const [resultsData, setResultsData] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Load Finale State from backend
  const fetchFinaleState = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setPrereqLocked(false);
      const res = await api.get("/finale/state");
      const data = res.data;

      if (data.state === "NOT_STARTED") {
        setFinaleData({ state: "NOT_STARTED" });
        setLoading(false);
        return;
      }

      setFinaleData(data);
      setCurrentRound(data.round || 1);
      setSecondsRemaining(data.seconds_remaining || 0);
      setIsExpired((data.seconds_remaining || 0) <= 0 && data.state === "ACTIVE");

      if (data.content?.challenge) {
        setCodingChallenge(data.content.challenge);
      }
      if (data.content?.questions) {
        setQuizQuestions(data.content.questions);
      }
      if (data.content?.prompt) {
        setDesignPrompt(data.content.prompt);
      }
      if (data.scores?.coding) {
        setCodingResult(data.scores.coding);
      }
      if (data.scores?.quiz) {
        setQuizResult(data.scores.quiz);
      }

      if (data.state === "COMPLETED" || data.state === "FAILED" || data.round >= 4) {
        setIsCompleted(true);
        setResultsData(data.scores || {});
        if (data.state === "COMPLETED") {
          setInterviewerText(
            "Evaluation complete. You have met the benchmark. Core credentials unlocked."
          );
        } else {
          setInterviewerText(
            "Evaluation complete. Insufficient competency demonstrated. Core remains sealed."
          );
        }
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setPrereqLocked(true);
        setErrorMsg(
          err.response?.data?.detail ||
            "Chambers 1-5 must all be PASSED before entering the Finale."
        );
      } else {
        setErrorMsg(err.response?.data?.detail || "Failed to load Finale status.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    fetchFinaleState();
  }, [fetchFinaleState]);

  // Start Finale session
  const handleStartFinale = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.post("/finale/start");
      setFinaleData(res.data);
      setCurrentRound(1);
      setInterviewerText("Welcome to the Core, Cadet. Show me what your code is made of.");
      await fetchFinaleState();
    } catch (err) {
      if (err.response?.status === 409) {
        setPrereqLocked(true);
        setErrorMsg(err.response?.data?.detail || "Chambers 1-5 must all be PASSED.");
      } else {
        setErrorMsg(err.response?.data?.detail || "Failed to initialize Finale interview.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!finaleData || finaleData.state !== "ACTIVE" || isCompleted) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [finaleData, isCompleted]);

  // WebSocket for live interviewer dialogue and state updates
  useEffect(() => {
    const client = new ChamberWebSocketClient({
      onStatusChange: (status) => setWsStatus(status),
      onMessage: (msg) => {
        if (msg.type === "nexus" && msg.payload?.text) {
          setInterviewerText(msg.payload.text);
        }
      },
      onError: (err) => console.warn("Finale WS warning:", err),
    });

    client.connect();
    return () => client.close();
  }, [currentUser?.id]);

  // Round 1: Coding Submission
  const handleCodingSubmit = async () => {
    if (codingSubmitting || isExpired) return;
    try {
      setCodingSubmitting(true);
      setErrorMsg(null);
      const res = await api.post("/finale/coding/submit", {
        code,
        language: "python",
      });

      setCodingResult(res.data.evaluation || res.data);

      if (res.data.passed) {
        setInterviewerText(
          "Acceptable algorithm. But speed without understanding is useless. Answer the quiz."
        );
        setCurrentRound(2);
        await fetchFinaleState();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Coding submission failed.");
    } finally {
      setCodingSubmitting(false);
    }
  };

  // Round 2: Quiz Selection and Keyboard Handler
  const handleSelectOption = useCallback((optionKey) => {
    const q = quizQuestions[quizIndex];
    if (!q) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [q.id]: optionKey,
    }));
  }, [quizIndex, quizQuestions]);

  useEffect(() => {
    if (currentRound !== 2 || quizQuestions.length === 0 || isCompleted) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();

      if (key === "1" || key === "a") {
        const q = quizQuestions[quizIndex];
        if (q?.options?.[0]) handleSelectOption(q.options[0].key);
      } else if (key === "2" || key === "b") {
        const q = quizQuestions[quizIndex];
        if (q?.options?.[1]) handleSelectOption(q.options[1].key);
      } else if (key === "3" || key === "c") {
        const q = quizQuestions[quizIndex];
        if (q?.options?.[2]) handleSelectOption(q.options[2].key);
      } else if (key === "4" || key === "d") {
        const q = quizQuestions[quizIndex];
        if (q?.options?.[3]) handleSelectOption(q.options[3].key);
      } else if (key === "arrowleft" || key === "p") {
        setQuizIndex((prev) => Math.max(0, prev - 1));
      } else if (key === "arrowright" || key === "n") {
        setQuizIndex((prev) => Math.min(quizQuestions.length - 1, prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentRound, quizIndex, quizQuestions, isCompleted, handleSelectOption]);

  const handleQuizSubmit = async () => {
    if (quizSubmitting || isExpired) return;
    try {
      setQuizSubmitting(true);
      setErrorMsg(null);
      const res = await api.post("/finale/quiz/submit", {
        answers: selectedAnswers,
      });

      setQuizResult(res.data.quiz);
      setInterviewerText("Quiz concluded. Now design something that won't collapse under load.");
      setCurrentRound(3);
      await fetchFinaleState();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Quiz submission failed.");
    } finally {
      setQuizSubmitting(false);
    }
  };

  // Round 3: System Design Submission
  const handleDesignSubmit = async () => {
    if (designSubmitting || isExpired) return;
    try {
      setDesignSubmitting(true);
      setShowConfirmModal(false);
      setErrorMsg(null);
      const res = await api.post("/finale/design/submit", {
        answer: designAnswer,
      });

      const overall = res.data.overall;
      if (overall?.passed) {
        setInterviewerText(
          "Evaluation complete. You have met the benchmark. Core credentials unlocked."
        );
      } else {
        setInterviewerText(
          "Evaluation complete. Insufficient competency demonstrated. Core remains sealed."
        );
      }

      setIsCompleted(true);
      setResultsData({
        coding: codingResult || { passed: true, score: 100 },
        quiz: quizResult || { score: 100 },
        design: res.data.design,
        overall: res.data.overall,
        award: res.data.award,
      });
      await fetchFinaleState();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "System design submission failed.");
    } finally {
      setDesignSubmitting(false);
    }
  };

  // Format timer
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 1. Loading State
  if (loading && !finaleData) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <Cpu className="w-12 h-12 text-cyan-400 animate-spin" />
        <GlitchText text="SYNCHRONIZING FINALE CORE PROTOCOL..." className="text-sm font-mono text-cyan-300" />
        <p className="text-xs font-mono text-zinc-500">Checking Chambers 1-5 security clearances...</p>
      </div>
    );
  }

  // 2. Prerequisite Locked State (409)
  if (prereqLocked) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center max-w-xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <Lock size={32} />
        </div>

        <div>
          <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-1">
            ACCESS DENIED // CLEARANCE DEFICIENT
          </div>
          <GlitchText
            text="CHAMBER 06: THE FINALE IS LOCKED"
            className="text-2xl sm:text-3xl font-extrabold text-white"
          />
          <p className="text-sm text-zinc-400 font-mono mt-3 leading-relaxed">
            {errorMsg || "Chambers 1-5 must all be PASSED before entering the Finale."}
          </p>
        </div>

        <NexusPanel variant="neutral" className="w-full p-4 text-left font-mono text-xs space-y-2">
          <div className="text-zinc-500 uppercase tracking-wider">// MANDATORY PRE-REQUISITES:</div>
          <div className="grid grid-cols-5 gap-2 text-center pt-2">
            {[1, 2, 3, 4, 5].map((c) => (
              <div
                key={c}
                className="p-2 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-400 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-zinc-500">CH 0{c}</span>
                <Shield size={14} className="text-amber-400/80" />
              </div>
            ))}
          </div>
        </NexusPanel>

        <Link to="/chambers">
          <NexusButton variant="primary" size="md" icon={ArrowRight}>
            Return to Chambers Gauntlet
          </NexusButton>
        </Link>
      </div>
    );
  }

  // 3. Not Started Briefing Screen
  if (finaleData?.state === "NOT_STARTED") {
    return (
      <div className="min-h-full p-6 sm:p-12 flex flex-col items-center justify-center max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-mono uppercase tracking-widest">
            <Flame size={14} />
            <span>NEXUS ADVERSARIAL TRIAL // CHAMBER 06</span>
          </div>
          <GlitchText
            text="THE FINALE INTERVIEW"
            className="text-3xl sm:text-5xl font-black text-white tracking-tight"
          />
          <p className="text-sm text-zinc-400 font-mono max-w-xl mx-auto leading-relaxed">
            A three-round, timed cognitive simulation conducted by the central NEXUS adversarial intelligence.
          </p>
        </div>

        {/* 3 Rounds Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <NexusPanel variant="neutral" className="p-4 space-y-2 border-red-500/20">
            <div className="text-red-400 font-mono text-xs font-bold uppercase">ROUND 01 // 50%</div>
            <h4 className="text-white font-bold text-sm">Hard Algorithmic Trial</h4>
            <p className="text-xs text-zinc-400 font-mono">
              Coolant trapping simulation. Strict O(n) time and O(1) space constraints.
            </p>
          </NexusPanel>

          <NexusPanel variant="neutral" className="p-4 space-y-2 border-red-500/20">
            <div className="text-amber-400 font-mono text-xs font-bold uppercase">ROUND 02 // 20%</div>
            <h4 className="text-white font-bold text-sm">Complexity Quiz</h4>
            <p className="text-xs text-zinc-400 font-mono">
              5 code snippets. Identify precise asymptotic bounds under time pressure.
            </p>
          </NexusPanel>

          <NexusPanel variant="neutral" className="p-4 space-y-2 border-red-500/20">
            <div className="text-cyan-400 font-mono text-xs font-bold uppercase">ROUND 03 // 30%</div>
            <h4 className="text-white font-bold text-sm">System Design</h4>
            <p className="text-xs text-zinc-400 font-mono">
              High-throughput rate limiter. Scored across a 5-dimension rubric.
            </p>
          </NexusPanel>
        </div>

        <NexusPanel variant="neutral" className="w-full p-4 bg-red-950/20 border-red-500/30 text-xs font-mono text-zinc-300 space-y-2">
          <div className="text-red-400 font-bold uppercase flex items-center gap-1.5">
            <AlertTriangle size={14} />
            <span>FINALE PASSING CRITERIA:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-zinc-400">
            <li>Coding round hidden tests must be 100% PASSED.</li>
            <li>Overall composite score must reach at least 60%.</li>
            <li>On completion: +1000 NXP bonus and +15 System Design matrix gain.</li>
          </ul>
        </NexusPanel>

        <NexusButton
          variant="primary"
          size="lg"
          onClick={handleStartFinale}
          icon={Flame}
          className="shadow-[0_0_25px_rgba(239,68,68,0.4)]"
        >
          COMMENCE FINALE TRIAL
        </NexusButton>
      </div>
    );
  }

  // 4. Completed / Results Screen
  if (isCompleted || finaleData?.state === "COMPLETED" || finaleData?.state === "FAILED") {
    const scores = resultsData || finaleData?.scores || {};
    const overall = scores.overall || { overall_score: 0, passed: false };
    const passed = overall.passed;
    const coding = scores.coding || {};
    const quiz = scores.quiz || {};
    const design = scores.design || {};

    return (
      <div className="min-h-full p-6 sm:p-10 max-w-4xl mx-auto space-y-8">
        {/* Banner */}
        <div
          className={`p-6 rounded-xl border text-center space-y-2 shadow-2xl ${
            passed
              ? "bg-emerald-950/40 border-emerald-500/60 shadow-emerald-500/10"
              : "bg-red-950/40 border-red-500/60 shadow-red-500/10"
          }`}
        >
          <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest font-bold">
            {passed ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={16} /> CLEARANCE GRANTED // TRIAL CONCLUDED
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <XCircle size={16} /> CLEARANCE DENIED // THRESHOLD UNMET
              </span>
            )}
          </div>

          <GlitchText
            text={passed ? "FINALE PROTOCOL PASSED" : "FINALE EVALUATION FAILED"}
            className="text-3xl sm:text-4xl font-black text-white"
          />

          <p className="text-sm font-mono text-zinc-300">
            Overall Score: <span className="font-bold text-white text-lg">{overall.overall_score || 0}%</span>{" "}
            <span className="text-zinc-500">(Passing threshold: 60% + Coding passed)</span>
          </p>

          {passed && (
            <div className="inline-flex items-center gap-3 mt-3 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
              <Award size={16} />
              <span>+1000 NXP FINALE BONUS AWARDED</span>
              <span>•</span>
              <span>+15 SYSTEM DESIGN MATRIX GAIN</span>
            </div>
          )}
        </div>

        {/* NEXUS Interviewer Quote */}
        <NexusTaunt text={interviewerText} />

        {/* Round Scores Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coding Round Card */}
          <NexusPanel variant="neutral" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-mono text-zinc-400 uppercase">ROUND 01 // 50%</span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  coding.passed
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border border-red-500/40"
                }`}
              >
                {coding.passed ? "PASSED" : "FAILED"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-mono">{coding.score ?? 0} / 100</div>
              <div className="text-xs font-mono text-zinc-400 mt-1">
                Complexity: <span className="text-cyan-400">{coding.complexity || "O(n)"}</span>
              </div>
              <div className="text-xs font-mono text-zinc-400">
                Cleanliness: <span className="text-emerald-400">{coding.cleanliness ?? 100}%</span>
              </div>
            </div>
          </NexusPanel>

          {/* Quiz Round Card */}
          <NexusPanel variant="neutral" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-mono text-zinc-400 uppercase">ROUND 02 // 20%</span>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {quiz.correct_count ?? Math.floor((quiz.score || 0) / 20)} / 5 Correct
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-mono">{quiz.score ?? 0} / 100</div>
              <div className="text-xs font-mono text-zinc-400 mt-1">
                Deterministic algorithmic analysis
              </div>
            </div>
          </NexusPanel>

          {/* System Design Round Card */}
          <NexusPanel variant="neutral" className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-mono text-zinc-400 uppercase">ROUND 03 // 30%</span>
              <span
                className={`text-xs font-mono font-bold ${
                  design.status === "unscored" ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {design.status === "unscored" ? "FALLBACK 50" : "EVALUATED"}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-mono">{design.total ?? 50} / 100</div>
              <div className="text-xs font-mono text-zinc-400 mt-1">
                Architectural rubric score
              </div>
            </div>
          </NexusPanel>
        </div>

        {/* System Design Rubric Details */}
        {design.criteria && (
          <NexusPanel variant="neutral" className="p-6 space-y-4">
            <h4 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <TerminalIcon size={16} className="text-cyan-400" />
              SYSTEM DESIGN RUBRIC BREAKDOWN
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {design.criteria.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 capitalize font-bold">
                      {c.name?.replace("_", " ")}
                    </span>
                    <span className="text-zinc-300 font-semibold">{c.score} / 20</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">{c.comment}</p>
                </div>
              ))}
            </div>
          </NexusPanel>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-800">
          <Link to="/chambers">
            <NexusButton variant="outline" size="md" icon={ChevronLeft}>
              Back to Chambers Grid
            </NexusButton>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/matrix">
              <NexusButton variant="outline" size="md" icon={Sparkles}>
                View Updated Matrix
              </NexusButton>
            </Link>

            {passed ? (
              <Link to="/finale/results">
                <NexusButton variant="primary" size="md" icon={Award}>
                  View Company Bids & Trophy
                </NexusButton>
              </Link>
            ) : (
              <NexusButton variant="primary" size="md" onClick={handleStartFinale} icon={RotateCcw}>
                Retry Finale Gauntlet
              </NexusButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. Active Finale Gauntlet (Rounds 1, 2, 3)
  return (
    <div className="min-h-full flex flex-col p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <Flame size={20} />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-bold flex items-center gap-2">
              <span>CHAMBER 06 // ADVERSARIAL FINALE</span>
              <span>•</span>
              <span className="text-zinc-500">WS: {wsStatus}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {currentRound === 1 && "ROUND 1/3: HARD ALGORITHMIC TRIAL"}
              {currentRound === 2 && "ROUND 2/3: COMPLEXITY QUIZ"}
              {currentRound === 3 && "ROUND 3/3: SYSTEM DESIGN ARCHITECTURE"}
            </h1>
          </div>
        </div>

        {/* Timer, Round Stepper, and Accessibility Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Round Indicator Badges */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-1 font-mono text-xs">
            <span
              className={`px-2.5 py-1 rounded ${
                currentRound === 1
                  ? "bg-red-500/30 text-red-300 font-bold border border-red-500/50"
                  : currentRound > 1
                  ? "text-emerald-400"
                  : "text-zinc-500"
              }`}
            >
              1/3 CODE
            </span>
            <span className="text-zinc-600 px-1">›</span>
            <span
              className={`px-2.5 py-1 rounded ${
                currentRound === 2
                  ? "bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50"
                  : currentRound > 2
                  ? "text-emerald-400"
                  : "text-zinc-500"
              }`}
            >
              2/3 QUIZ
            </span>
            <span className="text-zinc-600 px-1">›</span>
            <span
              className={`px-2.5 py-1 rounded ${
                currentRound === 3
                  ? "bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/50"
                  : "text-zinc-500"
              }`}
            >
              3/3 DESIGN
            </span>
          </div>

          {/* Countdown Clock */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold ${
              isExpired
                ? "bg-red-950/80 border-red-500 text-red-400 animate-pulse"
                : secondsRemaining < 120
                ? "bg-red-950/40 border-red-500/60 text-red-400"
                : "bg-zinc-900 border-zinc-700 text-zinc-200"
            }`}
          >
            <Clock size={16} />
            <span>{isExpired ? "EXPIRED" : formatTimer(secondsRemaining)}</span>
          </div>

          {/* Sound Drone Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs font-mono transition-colors ${
              soundEnabled
                ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Toggle Cooling Fan Drone Audio"
            aria-label="Toggle Cooling Fan Audio"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Reduced Effects Toggle */}
          <button
            onClick={() => setReduceEffects(!reduceEffects)}
            className={`p-2 rounded-lg border text-xs font-mono transition-colors ${
              reduceEffects
                ? "bg-amber-950/40 border-amber-500/50 text-amber-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Toggle Reduced Motion / Effects"
            aria-label="Toggle Reduced Effects"
          >
            {reduceEffects ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* NEXUS Interviewer Dialogue Strip */}
      <NexusTaunt text={interviewerText} />

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-red-400 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-white">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* ROUND 1: CODING WORKSPACE */}
      {currentRound === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Challenge Description & Examples */}
          <NexusPanel variant="neutral" className="lg:col-span-4 p-4 flex flex-col space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                // HARD CHALLENGE
              </span>
              <h3 className="text-lg font-bold text-white">
                {codingChallenge?.title || "Coolant Overflow Redirection"}
              </h3>
            </div>

            <div className="text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-line overflow-y-auto max-h-[350px] pr-2">
              {codingChallenge?.description ||
                "Given n non-negative integers representing an elevation map of coolant reservoir containment barriers where the width of each bar is 1, compute how much excess liquid coolant is trapped between barriers after flooding."}
            </div>

            {codingChallenge?.public_examples && (
              <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs font-mono">
                <span className="text-zinc-400 uppercase text-[11px] font-bold">Public Vectors:</span>
                {codingChallenge.public_examples.map((ex, i) => (
                  <div key={i} className="p-2 rounded bg-zinc-900 border border-zinc-800 text-[11px]">
                    <div className="text-zinc-400">In: {JSON.stringify(ex.input)}</div>
                    <div className="text-cyan-400">Exp: {JSON.stringify(ex.output)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Test Results if submitted */}
            {codingResult && (
              <div className="mt-auto pt-3 border-t border-zinc-800 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between">
                  <span>TEST RESULTS:</span>
                  <span
                    className={
                      codingResult.all_passed || codingResult.passed
                        ? "text-emerald-400 font-bold"
                        : "text-red-400 font-bold"
                    }
                  >
                    {codingResult.all_passed || codingResult.passed ? "ALL PASSED" : "FAILED"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {(codingResult.tests || []).map((t, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        t.status === "passed"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-red-500/20 text-red-400 border border-red-500/40"
                      }`}
                    >
                      T{t.id}: {t.status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </NexusPanel>

          {/* Monaco Editor & Actions */}
          <div className="lg:col-span-8 flex flex-col space-y-3">
            <div className="flex-1 min-h-[480px] rounded-xl overflow-hidden border border-zinc-800 bg-[#030712]">
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center font-mono text-xs text-zinc-500">
                    // INITIALIZING CODE RUNTIME...
                  </div>
                }
              >
                <CodeEditor
                  language="python"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  height="100%"
                />
              </Suspense>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-500">
                Shift+Alt+F to format • Evaluated via Phase 6 Judge0 Sandbox
              </span>
              <NexusButton
                variant="primary"
                size="md"
                onClick={handleCodingSubmit}
                disabled={codingSubmitting || isExpired}
                icon={codingSubmitting ? RefreshCw : Send}
              >
                {codingSubmitting ? "Evaluating..." : "SUBMIT CODE (1/3)"}
              </NexusButton>
            </div>
          </div>
        </div>
      )}

      {/* ROUND 2: COMPLEXITY QUIZ */}
      {currentRound === 2 && (
        <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center space-y-6">
          <NexusPanel variant="neutral" className="p-6 space-y-6">
            {/* Header / Stepper */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                  // QUESTION {quizIndex + 1} OF {quizQuestions.length || 5}
                </span>
                <h3 className="text-lg font-bold text-white font-mono mt-0.5">
                  {quizQuestions[quizIndex]?.question || "Analyze Time Complexity"}
                </h3>
              </div>

              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {quizQuestions.map((q, idx) => {
                  const isAnswered = Boolean(selectedAnswers[q.id]);
                  const isCurrent = idx === quizIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setQuizIndex(idx)}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono transition-all ${
                        isCurrent
                          ? "bg-amber-500 text-black font-bold ring-2 ring-amber-400/50"
                          : isAnswered
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Code Snippet Card */}
            {quizQuestions[quizIndex]?.code_snippet && (
              <div className="p-4 rounded-lg bg-[#030712] border border-zinc-800 font-mono text-xs text-zinc-200 overflow-x-auto shadow-inner">
                <pre>{quizQuestions[quizIndex].code_snippet}</pre>
              </div>
            )}

            {/* Multiple Choice Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(quizQuestions[quizIndex]?.options || []).map((opt) => {
                const isSelected = selectedAnswers[quizQuestions[quizIndex]?.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    className={`p-3.5 rounded-lg border text-left font-mono text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? "bg-amber-950/40 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                        {opt.key}
                      </span>
                      <span>{opt.text}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Keyboard Hint */}
            <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between pt-2">
              <span>Keyboard: [1-4] or [A-D] select • [← / →] navigate questions</span>
              <span>
                {Object.keys(selectedAnswers).length} of {quizQuestions.length} answered
              </span>
            </div>

            {/* Navigation & Submit footer */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <NexusButton
                variant="outline"
                size="sm"
                onClick={() => setQuizIndex((prev) => Math.max(0, prev - 1))}
                disabled={quizIndex === 0}
                icon={ChevronLeft}
              >
                Previous
              </NexusButton>

              {quizIndex < quizQuestions.length - 1 ? (
                <NexusButton
                  variant="outline"
                  size="sm"
                  onClick={() => setQuizIndex((prev) => Math.min(quizQuestions.length - 1, prev + 1))}
                  icon={ChevronRight}
                >
                  Next
                </NexusButton>
              ) : (
                <NexusButton
                  variant="primary"
                  size="sm"
                  onClick={handleQuizSubmit}
                  disabled={quizSubmitting || isExpired}
                  icon={quizSubmitting ? RefreshCw : Send}
                >
                  {quizSubmitting ? "Scoring..." : "SUBMIT QUIZ (2/3)"}
                </NexusButton>
              )}
            </div>
          </NexusPanel>
        </div>
      )}

      {/* ROUND 3: SYSTEM DESIGN WORKSPACE */}
      {currentRound === 3 && (
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-4">
          <NexusPanel variant="neutral" className="p-6 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                // SYSTEM DESIGN CHALLENGE (MAX 2,000 CHARACTERS)
              </span>
              <h3 className="text-lg font-bold text-white font-mono">
                Architectural Scenario: High-Throughput Distributed Rate Limiter
              </h3>
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                {designPrompt}
              </p>
            </div>

            {/* Rubric Guide Tips */}
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
              <span className="text-cyan-400 font-bold uppercase text-[10px] block">
                Rubric Dimensions (20 pts each):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-zinc-400">
                <div>1. Requirements</div>
                <div>2. Data Model</div>
                <div>3. Scaling Strategy</div>
                <div>4. Trade-Offs</div>
                <div>5. Failure Handling</div>
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <textarea
                value={designAnswer}
                onChange={(e) => setDesignAnswer(e.target.value)}
                placeholder="Detail your system architecture here... Address API endpoints, in-memory counters (e.g. Redis sliding window log), consistency vs latency trade-offs, and fallback strategies when clusters fail."
                rows={12}
                maxLength={2000}
                className="w-full p-4 rounded-lg bg-[#030712] border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-cyan-500/80 transition-colors resize-none leading-relaxed"
              />

              {/* Character Counter */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">
                  {designAnswer.length > 1800 ? "Approaching character limit" : "Evaluated with strict JSON rubric"}
                </span>
                <span
                  className={
                    designAnswer.length >= 2000
                      ? "text-red-400 font-bold"
                      : designAnswer.length >= 1800
                      ? "text-amber-400 font-bold"
                      : "text-zinc-400"
                  }
                >
                  {designAnswer.length} / 2,000 chars
                </span>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end pt-2">
              <NexusButton
                variant="primary"
                size="md"
                onClick={() => setShowConfirmModal(true)}
                disabled={designSubmitting || designAnswer.trim().length === 0 || isExpired}
                icon={designSubmitting ? RefreshCw : Send}
              >
                {designSubmitting ? "Evaluating Architecture..." : "SUBMIT ARCHITECTURE (3/3)"}
              </NexusButton>
            </div>
          </NexusPanel>

          {/* Submission Confirmation Modal */}
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <NexusPanel variant="neutral" className="max-w-md w-full p-6 space-y-4 border-cyan-500/50 shadow-2xl">
                <div className="flex items-center gap-3 text-cyan-400 font-mono text-sm font-bold">
                  <HelpCircle size={20} />
                  <span>CONFIRM FINAL SUBMISSION</span>
                </div>
                <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                  This will conclude your Chamber 06 Finale Gauntlet. Your architectural proposal will be evaluated
                  against all 5 rubric criteria by the NEXUS intelligence.
                </p>
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <NexusButton variant="outline" size="sm" onClick={() => setShowConfirmModal(false)}>
                    Cancel
                  </NexusButton>
                  <NexusButton variant="primary" size="sm" onClick={handleDesignSubmit} icon={Check}>
                    Confirm & Submit
                  </NexusButton>
                </div>
              </NexusPanel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Finale({ currentUser }) {
  return (
    <PressureProvider failedAttempts={2} totalSeconds={1200} secondsRemaining={300}>
      <PressureOverlay />
      <FinaleContent currentUser={currentUser} />
    </PressureProvider>
  );
}
