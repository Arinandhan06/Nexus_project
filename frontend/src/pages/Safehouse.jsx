import { Shield, Sparkles } from "lucide-react";

export default function Safehouse() {
  return (
    <div className="min-h-full w-full p-4 md:p-8 flex items-center justify-center">
      <div
        className="w-full max-w-lg bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl text-center space-y-4"
        tabIndex={0}
        aria-label="Safehouse Chamber View"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Shield size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Safehouse</h2>
        <p className="text-gray-400 text-sm">
          Sanctuary under surveillance. Resume upload and baseline profile calibration will unlock here.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
          <Sparkles size={14} />
          Coming in phase 1
        </div>
      </div>
    </div>
  );
}
