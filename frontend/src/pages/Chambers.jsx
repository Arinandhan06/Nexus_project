import { Terminal, Lock } from "lucide-react";

export default function Chambers() {
  return (
    <div className="min-h-full w-full p-4 md:p-8 flex items-center justify-center">
      <div
        className="w-full max-w-lg bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl text-center space-y-4"
        tabIndex={0}
        aria-label="Coding Chambers View"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Terminal size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Coding Chambers</h2>
        <p className="text-gray-400 text-sm">
          A sequential gauntlet of 6 adversarial interview chambers overseen by NEXUS.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Lock size={14} />
          Coming in phase 2
        </div>
      </div>
    </div>
  );
}
