import React, { useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Wifi, WifiOff, RefreshCw } from "lucide-react";

export default function Terminal({
  chamberNo = 1,
  logs = [],
  connectionStatus = "connected", // 'connected' | 'connecting' | 'reconnecting' | 'disconnected'
  className = "",
  onClear,
}) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new log entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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

  return (
    <div
      className={`flex flex-col bg-black/90 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md ${className}`}
    >
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/80 border-b border-zinc-800/80 select-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60 border border-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60 border border-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 border border-emerald-500/80" />
          <span className="ml-2 text-xs font-mono text-zinc-400 flex items-center gap-1.5">
            <TerminalIcon size={12} className="text-cyan-400" />
            nexus@chamber-{chamberNo}:~
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onClear && (
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

      {/* Terminal Output Area */}
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
    </div>
  );
}
