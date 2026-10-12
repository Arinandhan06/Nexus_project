import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useProgressStore } from "../store/useProgressStore";
import {
  Home,
  Shield,
  Terminal,
  Activity,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Sparkles,
} from "lucide-react";
import { GlitchText } from "./nexus";

const navItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Safehouse", icon: Shield, path: "/safehouse" },
  { label: "Chambers", icon: Terminal, path: "/chambers" },
  { label: "Matrix", icon: Activity, path: "/matrix" },
  { label: "Profile", icon: User, path: "/profile" },
];

export default function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useProgressStore();
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      {/* Collapsed Sidebar Toggle */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
            className="fixed left-0 top-20 z-50"
          >
            <button
              onClick={toggleSidebar}
              className="bg-zinc-950/95 backdrop-blur-xl border-r border-y border-cyan-500/30 p-3 rounded-r-xl shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 group cursor-pointer"
              aria-label="Open sidebar"
            >
              <ChevronRight
                size={20}
                className="text-cyan-400 group-hover:translate-x-0.5 transition-transform"
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={shouldReduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { width: 256, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0.15 } : { duration: 0.3, ease: "easeInOut" }}
            className="h-full flex flex-col p-5 border-r border-zinc-800/80 shadow-2xl relative bg-[#030712]/90 backdrop-blur-2xl overflow-hidden font-mono select-none"
          >
            <div className="relative z-10 flex flex-col h-full">
              {/* Header / Brand */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800/80">
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2.5 cursor-pointer group"
                  onClick={() => navigate("/")}
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 shadow-lg shadow-cyan-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h1 className="text-white text-xs font-black tracking-widest uppercase group-hover:text-cyan-400 transition-colors">
                      <GlitchText variant="cyan" text="NEXUS" />
                    </h1>
                    <p className="text-[10px] text-zinc-500 tracking-wider">AWAKENING</p>
                  </div>
                </motion.div>
                <button
                  onClick={toggleSidebar}
                  className="text-zinc-400 hover:text-white transition-colors bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 cursor-pointer"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Navigation Items */}
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex-1 space-y-1.5 text-xs"
              >
                {navItems.map((item, index) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <motion.div
                      key={item.label}
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: shouldReduceMotion ? 0 : 0.05 * index }}
                      className={`cursor-pointer flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group ${
                        isActive
                          ? "bg-cyan-950/40 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent"
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1 bottom-1 w-1 bg-cyan-400 rounded-r shadow-[0_0_8px_#22d3ee]"></div>
                      )}
                      <item.icon
                        size={16}
                        className={`transition-colors shrink-0 ${
                          isActive ? "text-cyan-400 drop-shadow-[0_0_5px_#22d3ee]" : "text-zinc-500 group-hover:text-zinc-300"
                        }`}
                      />
                      <span className="font-semibold tracking-wider uppercase text-[11px]">{item.label}</span>
                    </motion.div>
                  );
                })}
              </motion.nav>

              {/* User Profile & Logout */}
              <div className="pt-4 mt-auto border-t border-zinc-800/80 space-y-2">
                <div
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-cyan-500/40 cursor-pointer hover:bg-zinc-900/80 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-cyan-500/40 transition-colors shrink-0">
                    <User size={16} className="text-zinc-400 group-hover:text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-xs truncate group-hover:text-cyan-300 transition-colors">
                      {sessionStorage.getItem("userName") || "CADET"}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase">Profile Settings</p>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-all border border-transparent hover:border-red-500/30 cursor-pointer uppercase font-semibold tracking-wider"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
