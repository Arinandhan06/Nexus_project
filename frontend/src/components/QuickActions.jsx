import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MessageCircle, Upload, Zap, ArrowRight } from "lucide-react";

export default function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 min-h-[400px]"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Quick Actions</h3>
          <p className="text-sm text-gray-400">Get started with AI assistance</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Career Chatbot Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4 hover:border-purple-500/40 transition-all duration-300 group cursor-pointer"
        >
          <Link to="/career-chatbot" className="block">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                  Career Chatbot
                </h4>
                <p className="text-sm text-gray-400 mb-2">
                  Get personalized career advice from our AI assistant
                </p>
                <div className="flex items-center text-purple-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                  Start Chat
                  <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Resume Upload Card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-4 hover:border-cyan-500/40 transition-all duration-300 group cursor-pointer"
        >
          <Link to="/upload-resume" className="block">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  Resume Analysis
                </h4>
                <p className="text-sm text-gray-400 mb-2">
                  Upload your resume for AI-powered analysis and optimization
                </p>
                <div className="flex items-center text-cyan-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                  Upload Resume
                  <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Quick Stats */}
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">15%</div>
              <div className="text-xs text-gray-400">Career Readiness</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">3</div>
              <div className="text-xs text-gray-400">Active Projects</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}