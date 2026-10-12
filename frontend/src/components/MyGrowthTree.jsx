import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProgressStore } from "../store/useProgressStore";
import { TreePine } from "lucide-react";
import { useEffect, useState } from "react";

const STAGES = [
  { label: "Sprout", min: 0, src: "https://lottie.host/e575bff6-572b-49b4-b771-3dfebd54e607/f9UyzMM2K6.lottie" },
  { label: "Grove Guardian", min: 5, src: "https://lottie.host/494ff0f6-11f7-4433-9b83-17cf632ce737/dzKvJLbCPi.lottie" },
  { label: "Forest Ranger", min: 15, src: "https://lottie.host/cd392266-60d8-40a8-84fe-7487b8f3576a/MElMGauWcw.lottie" },
  { label: "Terraformer", min: 30, src: "https://lottie.host/8a05200a-d425-47f7-b004-a80608c2ea00/y6hF8fmtX7.lottie" },
  { label: "Gaia's Legacy", min: 50, src: "https://lottie.host/05dd8795-3a73-4e44-a2bc-cb68cfdd91f1/AY23ogELC1.lottie" },
];

export default function MyGrowthTree() {
  const { progress, setProgress } = useProgressStore();
  const [stats, setStats] = useState({ stage: "Sprout", trees: 0, next_goal: 5 });

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    fetch("http://localhost:8000/growth-status", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.progress !== undefined) setProgress(data.progress);
        setStats({
          stage: data.stage || "Sprout",
          trees: data.trees || 0,
          next_goal: data.next_goal || 5
        });
      })
      .catch((err) => console.error("Failed to fetch growth status:", err));
  }, [setProgress]);

  // Find current visual stage based on Rank Name from backend
  const stage = STAGES.find((s) => s.label === stats.stage) || STAGES[0];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6"
    >
      <div className="relative">
        <div className="w-[280px] h-[280px] relative rounded-full overflow-hidden shadow-glow bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border border-cyan-500/30">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
            >
              <DotLottieReact src={stage.src} autoplay loop />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full p-2 shadow-lg shadow-purple-500/30 animate-float">
          <TreePine size={20} className="text-white" />
        </div>
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 animate-pulse"></div>
      </div>

      <div className="text-center">
        <motion.h2
          key={stage.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-1"
        >
          {stats.stage}
        </motion.h2>

        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm text-gray-400">Forest Density:</span>
          <span className="text-lg font-bold text-white">{stats.trees}</span>
          <span className="text-xs text-gray-500">/ {stats.next_goal} Trees</span>
        </div>

        <div className="w-64 bg-gray-800/50 backdrop-blur-sm rounded-full h-3 overflow-hidden border border-white/10 relative">
          <motion.div
            className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 h-full rounded-full shadow-lg shadow-cyan-500/30"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {stats.trees >= 50 ? "Maximum Rank Achieved" : `${Math.max(0, stats.next_goal - stats.trees)} more trees to upgrade`}
        </p>
      </div>
    </motion.div>
  );
}
