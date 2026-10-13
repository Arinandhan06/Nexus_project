import { useState } from "react";
import { motion } from "framer-motion";
import { Terminal, AlertTriangle, ArrowRight, ShieldCheck, Github } from "lucide-react";
import Galaxy from "../components/Galaxy";
import api from "../lib/api";

export default function LoginSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGitHubAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/auth/github/login");
      if (response.data && response.data.url) {
        window.location.assign(response.data.url);
      } else {
        throw new Error("No authorization URL received from NEXUS server.");
      }
    } catch (err) {
      console.error("GitHub auth error:", err);
      const isNetErr = err.message === "Network Error" || err.code === "ERR_NETWORK";
      setError(
        err.response?.data?.detail ||
        (isNetErr
          ? "NEXUS Core backend is waking up or still deploying on Render. Please wait 30-60 seconds and click Retry."
          : err.message) ||
        "Failed to initialize GitHub OAuth bridge. Ensure backend is running."
      );
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black text-white px-4 py-8">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <Galaxy />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black/95 pointer-events-none" />

      {/* Main Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-zinc-950/90 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-xl"
      >
        {/* Header / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Terminal size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            NEXUS: CODE AWAKENING
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-mono">
            [ACCESS PROTOCOL // 30-DAY TECHNICAL TRIAL]
          </p>
        </div>

        {/* Narrative / Context */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 mb-6 text-xs text-zinc-300 font-mono space-y-1">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck size={14} />
            <span className="font-semibold uppercase tracking-wider">Adversarial Evaluation Node</span>
          </div>
          <p className="text-zinc-400">
            Authentication delegates through GitHub. Your public repositories and coding metadata will calibrate Chamber difficulty.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs sm:text-sm flex items-start gap-3"
            role="alert"
          >
            <AlertTriangle size={18} className="shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-200">Connection Terminated</p>
              <p className="mt-1 text-red-300/90">{error}</p>
              <button
                type="button"
                onClick={handleGitHubAuth}
                className="mt-2 text-xs font-semibold underline hover:text-red-100 transition-colors cursor-pointer"
              >
                Retry handshake
              </button>
            </div>
          </motion.div>
        )}

        {/* Primary Action: Authenticate with GitHub */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGitHubAuth}
            disabled={loading}
            aria-label="Authenticate with GitHub"
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-semibold text-sm tracking-wide bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Negotiating Quantum Token...</span>
              </>
            ) : (
              <>
                <Github size={20} className="fill-current" />
                <span>Authenticate with GitHub</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.assign("/auth/callback#token=nexus_demo_token_8888");
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-mono text-xs tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 hover:border-emerald-500/60 transition-all cursor-pointer"
          >
            <ShieldCheck size={16} />
            <span>ENTER AS DEMO CADET (CADET NOVA)</span>
          </button>
        </div>

        {/* Footer Notice */}
        <div className="mt-8 text-center text-[11px] text-zinc-500 font-mono">
          NEXUS is watching. Session encryption: Fernet AES-128-CBC.
        </div>
      </motion.div>
    </div>
  );
}