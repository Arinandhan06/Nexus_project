import React, { useEffect, useRef, useState } from "react";
import {
  Terminal as TerminalIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronRight
} from "lucide-react";

export default function Terminal({
  chamberNo = 1,
  logs = [],
  connectionStatus = "connected", // 'connected' | 'connecting' | 'reconnecting' | 'disconnected'
  result = null, // Phase 6: { passed, tests: [{id, status, time_ms, error}], complexity, expected, inefficient, cleanliness, findings, error }
  runResult = null, // Public test run results: { all_passed, results: [{example_no, input, expected, actual, passed, status, time_ms, error}] }
  className = "",
  onClear,
}) {
  const bottomRef = useRef(null);
  const [userTab, setUserTab] = useState(null);
  const [showFindings, setShowFindings] = useState(true);

  // Auto-switch tab on new runResult or result props change
  const [prevRunResult, setPrevRunResult] = useState(runResult);
  const [prevResult, setPrevResult] = useState(result);

  if (runResult !== prevRunResult) {
    setPrevRunResult(runResult);
    if (runResult) {
      setUserTab("run");
    }
  }

  if (result !== prevResult) {
    setPrevResult(result);
    if (result) {
      setUserTab("results");
    }
  }

  const activeTab = userTab || (runResult ? "run" : result ? "results" : "console");

  // Auto-scroll to bottom on new log entries if console tab active
  useEffect(() => {
    if (activeTab === "console") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE // WS
          </span>
        );
      case "reconnecting":
      case "connecting":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <RefreshCw size={10} className="animate-spin text-amber-400" />
            RECONNECTING
          </span>
        );
      case "disconnected":
      default:
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <WifiOff size={10} />
            OFFLINE
          </span>
        );
    }
  };

  const renderLogLine = (log, index) => {
    if (typeof log === "string") {
      return (
        <div key={index} className="text-zinc-300 leading-relaxed font-mono">
          <span className="text-zinc-500 select-none mr-2">&gt;</span>
          {log}
        </div>
      );
    }

    const { text, type = "info", timestamp, prefix } = log;
    let textColor = "text-zinc-300";
    let prefixColor = "text-cyan-400";

    if (type === "success") {
      textColor = "text-emerald-300";
      prefixColor = "text-emerald-400";
    } else if (type === "error") {
      textColor = "text-red-400";
      prefixColor = "text-red-500";
    } else if (type === "warn" || type === "warning") {
      textColor = "text-amber-300";
      prefixColor = "text-amber-400";
    } else if (type === "system") {
      textColor = "text-cyan-200 font-semibold";
      prefixColor = "text-cyan-400";
    }

    return (
      <div key={index} className={`font-mono leading-relaxed flex items-start gap-2 ${textColor}`}>
        {timestamp && (
          <span className="text-[10px] text-zinc-500 shrink-0 font-mono mt-0.5">
            [{timestamp}]
          </span>
        )}
        <span className={`select-none shrink-0 ${prefixColor}`}>
          {prefix || ">"}
        </span>
        <span className="break-all whitespace-pre-wrap">{text}</span>
      </div>
    );
  };

  const getTestStatusBadge = (status) => {
    switch (status) {
      case "passed":
        return <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> PASS</span>;
      case "wrong_answer":
        return <span className="text-red-400 font-bold flex items-center gap-1"><XCircle size={12} /> WA</span>;
      case "time_limit":
        return <span className="text-amber-400 font-bold flex items-center gap-1"><Clock size={12} /> TLE</span>;
      case "compile_error":
        return <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle size={12} /> CE</span>;
      case "runtime_error":
        return <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle size={12} /> RE</span>;
      case "internal_error":
      default:
        return <span className="text-zinc-400 font-bold flex items-center gap-1">ERR</span>;
    }
  };

  return (
    <div
      className={`flex flex-col bg-black/90 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md ${className}`}
    >
      {/* Terminal Titlebar with Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/80 border-b border-zinc-800/80 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60 border border-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60 border border-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 border border-emerald-500/80" />
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setUserTab("console")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === "console" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-white"
              }`}
            >
              <TerminalIcon size={11} />
              Console
            </button>
            <button
              onClick={() => setUserTab("results")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === "results" ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/30" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Zap size={11} />
              Grading Result
              {result && (
                <span className={`w-1.5 h-1.5 rounded-full ${result.passed ? "bg-emerald-400" : "bg-red-400"}`} />
              )}
            </button>
            <button
              onClick={() => setUserTab("run")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                activeTab === "run" ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30" : "text-zinc-400 hover:text-white"
              }`}
            >
              <CheckCircle2 size={11} />
              Test Run
              {runResult && (
                <span className={`w-1.5 h-1.5 rounded-full ${runResult.all_passed ? "bg-emerald-400" : "bg-red-400"}`} />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "console" && onClear && (
            <button
              onClick={onClear}
              className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase px-1.5 py-0.5 rounded hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
          {getStatusBadge()}
        </div>
      </div>

      {/* Main Terminal View (Console Tab) */}
      {activeTab === "console" && (
        <>
          <div className="flex-1 p-3 overflow-y-auto space-y-1 text-xs select-text font-mono min-h-[140px] max-h-[300px]">
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic font-mono">
                [Telemetry stream initialized. Ready for chamber directives.]
              </div>
            ) : (
              logs.map(renderLogLine)
            )}
            <div ref={bottomRef} />
          </div>

          {/* Live Prompt Line */}
          <div className="px-3 py-2 bg-zinc-950/90 border-t border-zinc-900 flex items-center gap-2 text-xs font-mono">
            <span className="text-cyan-400 font-semibold select-none">
              nexus@chamber-{chamberNo} $
            </span>
            <span className="w-2 h-4 bg-cyan-400 inline-block animate-pulse select-none" />
          </div>
        </>
      )}

      {/* Phase 6 Result Panel (Results Tab) */}
      {activeTab === "results" && (
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs font-mono min-h-[180px] max-h-[300px] select-text">
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
              <Zap size={24} className="text-zinc-600 animate-pulse" />
              <div>No execution recorded yet. Submit solution with [Ctrl+Enter] to initiate automated grading.</div>
            </div>
          ) : (
            <>
              {/* Verdict Banner */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  result.passed
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : "bg-red-950/30 border-red-500/40 text-red-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {result.passed ? (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold tracking-wide uppercase">
                      {result.passed ? "CHAMBER TRIAL PASSED" : "TRIAL VERDICT: FAILED"}
                    </div>
                    {result.error && (
                      <div className="text-[11px] text-red-400 mt-0.5">{result.error}</div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    VECTORS RESOLVED
                  </span>
                  <span className="text-sm font-extrabold font-mono">
                    {result.tests?.filter((t) => t.status === "passed").length ?? 0} /{" "}
                    {result.tests?.length ?? 0}
                  </span>
                </div>
              </div>

              {/* Metrics Grid: Test Vectors, Efficiency, Cleanliness */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* 1. Test Statuses */}
                <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Test Vectors</span>
                    <span className="text-zinc-500">Judge0 Batch</span>
                  </div>
                  {result.tests && result.tests.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {result.tests.map((t) => (
                        <div
                          key={t.id}
                          className="p-1.5 bg-black/60 rounded border border-zinc-900 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-semibold">Vector #{t.id}</span>
                            <div className="flex items-center gap-1.5">
                              {t.time_ms > 0 && <span className="text-[10px] text-zinc-500">{t.time_ms}ms</span>}
                              {getTestStatusBadge(t.status)}
                            </div>
                          </div>
                          {t.error && (
                            <div className="text-[10px] text-red-400 font-mono bg-red-950/40 p-1 rounded border border-red-500/30 break-all">
                              {t.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-600 text-[11px] italic">No vector outputs recorded.</div>
                  )}
                </div>

                {/* 2. Efficiency Metric */}
                <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Efficiency</span>
                    <Sparkles size={11} className="text-cyan-400" />
                  </div>
                  <div className="pt-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Complexity:</span>
                      <span className="text-white font-bold">{result.complexity || "O(n) (estimated)"}</span>
                    </div>
                    {result.expected && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">Expected:</span>
                        <span className="text-zinc-300 font-mono">{result.expected}</span>
                      </div>
                    )}
                    <div className="pt-1">
                      {result.inefficient ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                          <AlertTriangle size={10} /> Inefficient Tier
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 size={10} /> Target Complexity Met
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Cleanliness Score */}
                <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1.5">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>AST Cleanliness</span>
                    <ShieldCheck size={11} className="text-emerald-400" />
                  </div>
                  <div className="pt-1 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-zinc-400">Grade Score:</span>
                      <span
                        className={`text-base font-extrabold font-mono ${
                          (result.cleanliness ?? 100) >= 80
                            ? "text-emerald-400"
                            : (result.cleanliness ?? 100) >= 50
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {result.cleanliness ?? 100}/100
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${
                          (result.cleanliness ?? 100) >= 80
                            ? "bg-emerald-400"
                            : (result.cleanliness ?? 100) >= 50
                            ? "bg-amber-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${Math.max(5, result.cleanliness ?? 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500 pt-0.5">
                      {result.findings?.length ?? 0} style findings detected
                    </div>
                  </div>
                </div>
              </div>

              {/* Cleanliness Findings List */}
              {result.findings && result.findings.length > 0 && (
                <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-zinc-950/60">
                  <button
                    onClick={() => setShowFindings(!showFindings)}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-400 hover:text-white bg-zinc-900/50 transition-colors"
                  >
                    <span className="font-semibold uppercase tracking-wider">
                      AST Findings & Style Diagnoses ({result.findings.length})
                    </span>
                    {showFindings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {showFindings && (
                    <div className="p-2 space-y-1 divide-y divide-zinc-900">
                      {result.findings.map((f, i) => (
                        <div key={i} className="pt-1 first:pt-0 flex items-start gap-2 text-[11px] font-mono">
                          <span className="text-amber-400 shrink-0 font-bold">Line {f.line}:</span>
                          <span className="text-zinc-300">{f.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Test Run Panel (Run Tab) */}
      {activeTab === "run" && (
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs font-mono min-h-[180px] max-h-[300px] select-text">
          {!runResult ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
              <CheckCircle2 size={24} className="text-zinc-600 animate-pulse" />
              <div>Click [Run Code] in the top toolbar to test your solution against public examples.</div>
            </div>
          ) : (
            <>
              {/* Verdict Banner */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  runResult.all_passed
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : "bg-red-950/30 border-red-500/40 text-red-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {runResult.all_passed ? (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold tracking-wide uppercase">
                      {runResult.all_passed ? "ALL PUBLIC EXAMPLES PASSED" : "PUBLIC TEST RUN FAILED"}
                    </div>
                    {runResult.error && (
                      <div className="text-[11px] text-red-400 mt-0.5">{runResult.error}</div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    EXAMPLES PASSED
                  </span>
                  <span className="text-sm font-extrabold font-mono">
                    {runResult.results?.filter((r) => r.passed).length ?? 0} /{" "}
                    {runResult.results?.length ?? 0}
                  </span>
                </div>
              </div>

              {/* Public Examples Test Cards */}
              <div className="space-y-2">
                {runResult.results?.map((ex) => (
                  <div
                    key={ex.example_no}
                    className={`p-2.5 rounded-lg border text-xs font-mono space-y-1.5 ${
                      ex.passed
                        ? "bg-emerald-950/10 border-emerald-500/20"
                        : "bg-red-950/20 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-300 font-bold">Example 0{ex.example_no}</span>
                      <div className="flex items-center gap-2">
                        {ex.time_ms > 0 && <span className="text-[10px] text-zinc-500">{ex.time_ms}ms</span>}
                        {getTestStatusBadge(ex.status)}
                      </div>
                    </div>
                    <div className="bg-black/60 p-2 rounded border border-zinc-900 space-y-1 text-[11px]">
                      <div>
                        <span className="text-zinc-500 select-none">Input: </span>
                        <span className="text-zinc-200">{ex.input}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 select-none">Expected: </span>
                        <span className="text-emerald-300">{ex.expected}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 select-none">Your Output: </span>
                        <span className={ex.passed ? "text-emerald-300 font-bold" : "text-red-300 font-bold"}>
                          {ex.actual ?? "None"}
                        </span>
                      </div>
                      {ex.error && (
                        <div className="text-red-400 bg-red-950/50 p-1.5 rounded border border-red-500/30 mt-1 break-all">
                          <strong>Error:</strong> {ex.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stdout if user used print() */}
              {runResult.stdout && (
                <div className="p-2.5 bg-black/60 rounded border border-zinc-900 text-xs font-mono space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Standard Output:</span>
                  <pre className="text-zinc-300 whitespace-pre-wrap">{runResult.stdout}</pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
