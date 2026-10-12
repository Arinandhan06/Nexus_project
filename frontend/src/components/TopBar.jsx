import { motion } from "framer-motion";
import { Settings, Newspaper, Rocket, Zap, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function TopBar() {
  const [items, setItems] = useState([
    { icon: TrendingUp, text: "Loading realtime market data...", color: "text-gray-400" }
  ]);

  useEffect(() => {
    fetch("http://localhost:8000/market/ticker")
      .then(res => res.json())
      .then(data => {
        if (data && data.ticker) {
          const newItems = data.ticker.map(t => ({
            icon: TrendingUp,
            text: t,
            color: t.includes("▲") ? "text-green-400" : "text-red-400"
          }));
          setItems(newItems);
        }
      })
      .catch(err => console.error("Failed to fetch ticker:", err));
  }, []);

  return (
    <div className="glass-effect px-6 py-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 animate-pulse-slow"></div>
      <motion.div
        className="flex gap-8 text-sm text-gray-300 whitespace-nowrap relative z-10"
        animate={{ x: [0, -1500] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 35, // Slower for readability
            ease: "linear",
          },
        }}
      >
        {/* Duplicate list for infinite scroll effect */}
        {[...items, ...items, ...items].map((item, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-2 flex-shrink-0 hover:scale-105 transition-transform cursor-pointer"
            whileHover={{ scale: 1.05 }}
          >
            <item.icon size={16} className={`${item.color} animate-pulse`} />
            <span className="hover:text-cyan-400 transition-colors">{item.text}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
