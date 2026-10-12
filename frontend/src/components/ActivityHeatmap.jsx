import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ActivityHeatmap({ data }) {
  // Generate 365 days of data
  const days = 365;
  const today = new Date();

  // Helper to generate mock data or use real data
  const getDisplayData = () => {
    // If real data provided, map it to the 365 day grid
    // For now, let's just stick to the mock generator if data is empty, 
    // OR better: merge the real data into the grid.

    // Create base grid
    const grid = Array.from({ length: days }).map((_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];

      // Find match in real data
      const match = data ? data.find(d => d.date === dateStr) : null;

      if (match) {
        return { date, dateStr, level: match.level, hours: match.hours };
      }

      // Default / Fallback to 0 if no data (remove random noise for real app?)
      // User asked for "Real Backend", so we should show REAL data (0 if empty).
      return { date, dateStr, level: 0, hours: 0 };
    });

    return grid;
  };

  const activityData = getDisplayData();
  const [hoveredDay, setHoveredDay] = useState(null);

  const getColor = (level) => {
    switch (level) {
      case 1: return "bg-emerald-900/50 border-emerald-900"; // Low
      case 2: return "bg-emerald-700/60 border-emerald-700"; // Medium
      case 3: return "bg-emerald-500/80 border-emerald-500"; // High
      case 4: return "bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.6)]"; // Very High
      default: return "bg-white/5 border-transparent hover:border-white/10"; // None
    }
  };

  // Month labels
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="w-full flex flex-col items-start relative">
      {/* Tooltip */}
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="absolute z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg border border-white/10 shadow-xl whitespace-nowrap pointer-events-none"
            style={{
              top: hoveredDay.y - 45,
              left: hoveredDay.x - 70 // Adjust centering
            }}
          >
            <div className="font-semibold">{hoveredDay.hours} hours spent learning</div>
            <div className="text-gray-400">{hoveredDay.date.toDateString()}</div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Month Labels */}
      <div className="flex w-full justify-between text-xs text-gray-500 mb-2 px-1">
        {months.map(m => <span key={m}>{m}</span>)}
      </div>

      <div className="flex gap-2">
        {/* Day Labels (Optional, typically Mon/Wed/Fri) */}
        <div className="flex flex-col justify-between text-[10px] text-gray-600 font-mono py-1 h-[100px] gap-1">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>

        {/* Grid */}
        <div
          className="grid grid-rows-7 grid-flow-col gap-1"
          style={{
            gridTemplateColumns: `repeat(52, minmax(0, 1fr))`
          }}
        >
          {activityData.map((day, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-[1px] border ${getColor(day.level)} cursor-pointer transition-all duration-200 hover:scale-125 hover:z-10`}
              onMouseEnter={(e) => {
                const rect = e.target.getBoundingClientRect();
                // Calculate relative position to the container if needed, but for fixed/absolute tooltip inside relative parent:
                // We need the key/index to position? No, let's use the event target's offsetTop/Left relative to parent would be best if parent is relative.
                // But simpler is to use event client coordinates if tooltip is fixed, OR text the parent offset.
                // Let's rely on e.target.offsetLeft/Top
                setHoveredDay({
                  ...day,
                  x: e.target.offsetLeft + (e.target.offsetWidth / 2),
                  y: e.target.offsetTop
                });
              }}
              onMouseLeave={() => setHoveredDay(null)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="w-full flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-[1px] bg-white/5 border border-transparent"></div>
          <div className="w-3 h-3 rounded-[1px] bg-emerald-900/50 border border-emerald-900"></div>
          <div className="w-3 h-3 rounded-[1px] bg-emerald-700/60 border border-emerald-700"></div>
          <div className="w-3 h-3 rounded-[1px] bg-emerald-500/80 border border-emerald-500"></div>
          <div className="w-3 h-3 rounded-[1px] bg-emerald-400 border border-emerald-300"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
