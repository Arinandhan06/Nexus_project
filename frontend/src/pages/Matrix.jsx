import { Activity, BarChart3 } from "lucide-react";

export default function Matrix() {
  return (
    <div className="min-h-full w-full p-4 md:p-8 flex items-center justify-center">
      <div
        className="w-full max-w-lg bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl text-center space-y-4"
        tabIndex={0}
        aria-label="Job Readiness Matrix View"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <Activity size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Job-Readiness Matrix</h2>
        <p className="text-gray-400 text-sm">
          Live radar visualization scoring DSA, System Design, and Code Cleanliness (0-100).
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono">
          <BarChart3 size={14} />
          Coming in phase 3
        </div>
      </div>
    </div>
  );
}
