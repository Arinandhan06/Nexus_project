import { motion } from "framer-motion";
import { Flame, Rocket, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

export default function LiveFeeds() {
  const [data, setData] = useState({ hot_jobs: [], hot_projects: [] });

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    fetch("http://localhost:8000/live-feeds", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setData(data))
      .catch((err) => console.error("Failed to fetch live feeds:", err));
  }, []);

  const { hot_jobs, hot_projects } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col p-6 bg-black/20 backdrop-blur-sm border border-white/10 shadow-xl rounded-2xl"
    >
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="text-green-400" size={20} />
        <h3 className="text-transparent bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text font-semibold">Live Feeds</h3>
      </div>

      <div className="space-y-6 flex-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="text-orange-400 animate-pulse" size={16} />
            <h4 className="text-sm font-medium text-white">Hot Jobs</h4>
          </div>
          <ul className="space-y-2">
            {hot_jobs.map((job, index) => (
              <Link key={job} to="/job-hub" className="block">
                <motion.li
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="text-xs text-gray-300 bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-lg p-3 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-orange-500/20"
                >
                  {job}
                </motion.li>
              </Link>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="text-cyan-400 animate-bounce" size={16} />
            <h4 className="text-sm font-medium text-white">Hot Projects</h4>
          </div>
          <ul className="space-y-2">
            {hot_projects.map((project, index) => (
              <Link key={project} to="/project-lab" className="block">
                <motion.li
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index + 4) * 0.1 }}
                  className="text-xs text-gray-300 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-sm rounded-lg p-3 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-cyan-500/20"
                >
                  {project}
                </motion.li>
              </Link>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
