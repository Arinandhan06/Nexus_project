// ServicesList.jsx
import { useNavigate } from "react-router-dom";
import {
  Upload,
  MessageCircle,
  BookOpen,
  Users,
  TrendingUp,
  Briefcase,
  Map,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { ParticleCard } from "./MagicBento";

const services = [
  {
    title: "Resume Upload & Analysis",
    description: "Upload your resume for analysis",
    icon: Upload,
    path: "/upload-resume",
    headerLabel: "ANALYSIS"
  },
  {
    title: "Learning Resources",
    description: "Access guides and tutorials",
    icon: BookOpen,
    path: "/resources",
    headerLabel: "EDUCATION"
  },
  {
    title: "Project Lab",
    description: "Explore hands-on projects",
    icon: TrendingUp,
    path: "/project-lab",
    headerLabel: "PROJECTS"
  },
  {
    title: "My Lab",
    description: "Manage your active projects",
    icon: TrendingUp, // Should import Monitor or similar if available, or keep generic for now
    path: "/my-lab",
    headerLabel: "WORKSPACE"
  },
  {
    title: "Job Hub",
    description: "Find job opportunities",
    icon: Briefcase,
    path: "/job-hub",
    headerLabel: "JOBS"
  },
  {
    title: "Offline Atlas",
    description: "Navigate your career path offline",
    icon: Map,
    path: "/offline-atlas",
    headerLabel: "OFFLINE"
  },
  {
    title: "Community Network",
    description: "Join the community chat",
    icon: MessageCircle, // Changed to MessageCircle or similar
    path: "/community",
    headerLabel: "COMMUNITY"
  },
  {
    title: "Collaborate",
    description: "Work with others in real-time",
    icon: Users,
    path: "/collaborate",
    headerLabel: "COLLABORATION"
  }
];

export default function ServicesList() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      {services.map((service, index) => (
        <motion.div
          key={service.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="h-full"
        >
          <ParticleCard
            onClick={() => navigate(service.path)}
            className="group relative bg-[#030712] border border-white/5 hover:border-purple-500/50 rounded-3xl p-8 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)] overflow-hidden cursor-pointer flex flex-col items-start min-h-[280px] h-full"
            glowColor="168, 85, 247"
          >
            {/* Icon */}
            <div className="p-3 bg-white/5 rounded-2xl mb-6 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300 relative z-10">
              <service.icon size={24} className="text-gray-300 group-hover:text-purple-400" />
            </div>

            {/* Header Label */}
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 relative z-10">
              {service.headerLabel}
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-100 transition-colors relative z-10">
              {service.title}
            </h3>

            {/* Description */}
            <p className="text-gray-400 text-sm mb-8 leading-relaxed line-clamp-2 relative z-10">
              {service.description}
            </p>

            {/* Link */}
            <div className="mt-auto flex items-center text-purple-400 text-sm font-bold tracking-wide relative z-10">
              Explore <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </ParticleCard>
        </motion.div>
      ))}
    </div>
  );
}