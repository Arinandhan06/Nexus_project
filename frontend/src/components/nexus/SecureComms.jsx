import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  AlertCircle
} from "lucide-react";
import api from "../../lib/api";
import NexusButton from "./NexusButton";
import StatBadge from "./StatBadge";

export default function SecureComms({
  challengeId = "safehouse-general",
  currentCode = "",
  className = ""
}) {
  const [messages, setMessages] = useState([]);
  const [hintLevel, setHintLevel] = useState(1);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchHistory = async () => {
    if (!challengeId) return;
    try {
      setError(null);
      const res = await api.get(`/aria/history?challenge_id=${encodeURIComponent(challengeId)}`);
      if (res.data) {
        setMessages(res.data.history || []);
        setHintLevel(res.data.hint_level || 1);
      }
    } catch (err) {
      console.error("Failed to load ARIA history:", err);
      // Non-fatal, user can still chat
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [challengeId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (customText = null, isStuck = false) => {
    const textToSend = customText !== null ? customText : inputMessage.trim();
    if (!textToSend && !isStuck) return;

    setError(null);
    const userMsg = textToSend || "I am stuck on this problem. Can you provide the next hint?";
    setInputMessage("");

    // Optimistically add user message
    const optimisticMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(optimisticMessages);
    setLoading(true);

    try {
      const res = await api.post("/aria/chat", {
        message: userMsg,
        code: currentCode || "",
        challenge_id: challengeId,
        language: "python",
        is_stuck: isStuck
      });

      if (res.data) {
        setMessages([
          ...optimisticMessages,
          { role: "assistant", content: res.data.reply }
        ]);
        if (res.data.hint_level) {
          setHintLevel(res.data.hint_level);
        }
      }
    } catch (err) {
      console.error("ARIA Comms error:", err);
      setError(err?.response?.data?.detail || "Secure link disrupted. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleStuck = () => {
    sendMessage("I am stuck on this step. Please grant me the next strategic hint.", true);
  };

  const getHintLevelDescription = (lvl) => {
    switch (lvl) {
      case 1:
        return "Guiding Question";
      case 2:
        return "Algorithm & Structure";
      case 3:
        return "Pseudocode Sketch";
      default:
        return "Guiding Question";
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#030712] border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(34,211,238,0.08)] ${className}`}>
      {/* Header */}
      <div className="p-3.5 bg-[#070e1c] border-b border-cyan-500/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold font-mono tracking-wider text-cyan-300">
                ARIA // SECURE COMMS
              </h3>
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              Calm Strategic Mentor // Hint-Only Mode
            </p>
          </div>
        </div>

        {/* Hint Level Meter & Stuck Trigger */}
        <div className="flex items-center gap-2">
          <StatBadge
            label="HINT"
            value={`${hintLevel}/3`}
            variant="cyan"
            size="sm"
          />
          <NexusButton
            variant="amber"
            size="sm"
            onClick={handleStuck}
            disabled={loading}
            icon={Sparkles}
            className="text-[10px] py-1 px-2.5"
            title="Request the next strategic hint (Level 1-3)"
          >
            I'm Stuck
          </NexusButton>
        </div>
      </div>

      {/* Hint Meter Sub-banner */}
      <div className="px-4 py-1.5 bg-[#061122] border-b border-zinc-800 text-[11px] font-mono text-cyan-400/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HelpCircle size={12} className="text-cyan-400" />
          <span>Level {hintLevel} Active: {getHintLevelDescription(hintLevel)}</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`w-5 h-1.5 rounded-full transition-all ${
                step <= hintLevel ? "bg-cyan-400 shadow-[0_0_6px_#22d3ee]" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 font-sans min-h-0 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-mono space-y-2">
            <Bot size={28} className="text-cyan-500/50" />
            <p className="text-xs text-zinc-300">ARIA is standing by.</p>
            <p className="text-[11px] text-zinc-500 max-w-xs">
              Ask questions about your logic or press &ldquo;I&apos;m Stuck&rdquo; to unlock a tiered hint ladder.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-6 h-6 rounded-md bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Bot size={13} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? "bg-cyan-950/40 border border-cyan-500/40 text-cyan-100"
                      : "bg-[#081220] border border-zinc-800 text-zinc-200"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none text-zinc-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                    <User size={13} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-[11px] px-2 py-1">
            <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>ARIA is calibrating guidance...</span>
          </div>
        )}

        {/* Error Callout */}
        {error && (
          <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-[11px] font-mono flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => sendMessage()}
              className="text-red-400 hover:text-white underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-[#070e1c] border-t border-zinc-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2 items-center"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask ARIA for a hint or clarification..."
            maxLength={1000}
            disabled={loading}
            className="flex-1 bg-[#030712] border border-zinc-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none transition-colors"
          />
          <NexusButton
            type="submit"
            variant="cyan"
            size="sm"
            disabled={loading || !inputMessage.trim()}
            icon={Send}
            className="px-3"
          >
            Send
          </NexusButton>
        </form>
      </div>
    </div>
  );
}
