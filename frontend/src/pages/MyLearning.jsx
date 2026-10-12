import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, Lock, BookOpen } from "lucide-react";
import TopBar from "../components/TopBar";

const projectPhases = {
  "personal-portfolio": {
    title: "Personal Portfolio Website",
    phases: [
      {
        id: 1,
        title: "Project Setup",
        description:
          "Set up your development environment and create the basic project structure",
        tasks: [
          "Initialize a new React project",
          "Install necessary dependencies (React Router, Tailwind CSS)",
          "Create basic folder structure",
          "Set up development server",
        ],
      },
      {
        id: 2,
        title: "Basic Layout",
        description:
          "Create the main layout with header, navigation, and footer",
        tasks: [
          "Create Header component with navigation",
          "Build Hero section",
          "Add About section",
          "Create Contact section",
        ],
      },
      {
        id: 3,
        title: "Styling & Animation",
        description:
          "Add beautiful styling and smooth animations to your portfolio",
        tasks: [
          "Style all components with Tailwind CSS",
          "Add Framer Motion animations",
          "Implement responsive design",
          "Add hover effects and transitions",
        ],
      },
    ],
  },
  "task-manager": {
    title: "Task Management App",
    phases: [
      {
        id: 1,
        title: "Backend Setup",
        description: "Set up Node.js backend with Express and MongoDB",
        tasks: [
          "Initialize Node.js project",
          "Set up Express server",
          "Connect to MongoDB",
          "Create API endpoints",
        ],
      },
      {
        id: 2,
        title: "Frontend Development",
        description: "Build React frontend with task management features",
        tasks: [
          "Create React components",
          "Implement task CRUD operations",
          "Add user authentication",
          "Style with Tailwind CSS",
        ],
      },
    ],
  },
  "data-dashboard": {
    title: "Data Visualization Dashboard",
    phases: [
      {
        id: 1,
        title: "Data Processing",
        description: "Set up data processing pipeline with Python",
        tasks: [
          "Set up Python environment",
          "Process and clean data",
          "Create data models",
          "Set up API endpoints",
        ],
      },
      {
        id: 2,
        title: "Frontend Visualization",
        description: "Build interactive dashboard with React and D3.js",
        tasks: [
          "Create chart components",
          "Implement data fetching",
          "Add interactive features",
          "Style dashboard layout",
        ],
      },
    ],
  },
  "weather-app": {
    title: "Mobile Weather App",
    phases: [
      {
        id: 1,
        title: "API Integration",
        description: "Integrate weather API and set up basic app structure",
        tasks: [
          "Set up React Native project",
          "Integrate weather API",
          "Create location services",
          "Handle API responses",
        ],
      },
      {
        id: 2,
        title: "UI/UX Development",
        description: "Build beautiful weather app interface",
        tasks: [
          "Design weather screens",
          "Add animations",
          "Implement search functionality",
          "Add offline capabilities",
        ],
      },
    ],
  },
  "chatbot-ai": {
    title: "AI-Powered Chatbot",
    phases: [
      {
        id: 1,
        title: "NLP Setup",
        description: "Set up natural language processing with TensorFlow",
        tasks: [
          "Set up Python environment",
          "Install TensorFlow and NLP libraries",
          "Train basic model",
          "Create chatbot logic",
        ],
      },
      {
        id: 2,
        title: "Integration",
        description: "Integrate chatbot with web interface",
        tasks: [
          "Create web interface",
          "Connect to backend API",
          "Add real-time messaging",
          "Deploy application",
        ],
      },
    ],
  },
};

export default function MyLearning() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [completedPhases, setCompletedPhases] = useState([1]);

  const project = projectPhases[projectId];

  const handlePhaseClick = (phaseId) => {
    if (phaseId <= Math.max(...completedPhases) + 1) {
      navigate(`/workspace/${projectId}?phase=${phaseId}`);
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col min-h-screen bg-[#050B12]">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white">Project not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <TopBar />

      <div className="flex-1 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate("/project-lab")}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Project Lab
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
                <BookOpen size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {project.title}
                </h1>
                <p className="text-gray-400 text-lg">
                  Complete all phases to master this project
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {project.phases.map((phase, index) => (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative p-6 rounded-xl border transition-all cursor-pointer group ${completedPhases.includes(phase.id)
                      ? "bg-green-500/10 border-green-500/50 hover:bg-green-500/20"
                      : phase.id <= Math.max(...completedPhases) + 1
                        ? "bg-slate-700/30 border-slate-600/50 hover:border-cyan-500/50 hover:bg-cyan-500/5"
                        : "bg-slate-800/30 border-slate-700/50 opacity-60 cursor-not-allowed"
                    }`}
                  onClick={() => handlePhaseClick(phase.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${completedPhases.includes(phase.id)
                          ? "bg-green-500/20"
                          : phase.id <= Math.max(...completedPhases) + 1
                            ? "bg-cyan-500/20"
                            : "bg-gray-500/20"
                        }`}
                    >
                      {completedPhases.includes(phase.id) ? (
                        <CheckCircle size={24} className="text-green-400" />
                      ) : phase.id > Math.max(...completedPhases) + 1 ? (
                        <Lock size={24} className="text-gray-500" />
                      ) : (
                        <Play size={24} className="text-cyan-400" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${completedPhases.includes(phase.id)
                          ? "bg-green-500/20 text-green-400"
                          : phase.id <= Math.max(...completedPhases) + 1
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                    >
                      Phase {phase.id}
                    </span>
                  </div>

                  <h3
                    className={`text-xl font-semibold mb-3 ${completedPhases.includes(phase.id)
                        ? "text-green-400"
                        : phase.id <= Math.max(...completedPhases) + 1
                          ? "text-white group-hover:text-cyan-400"
                          : "text-gray-500"
                      }`}
                  >
                    {phase.title}
                  </h3>

                  <p
                    className={`text-sm mb-4 ${completedPhases.includes(phase.id)
                        ? "text-green-300"
                        : phase.id <= Math.max(...completedPhases) + 1
                          ? "text-gray-400"
                          : "text-gray-600"
                      }`}
                  >
                    {phase.description}
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">
                      Tasks:
                    </h4>
                    {phase.tasks.map((task, taskIndex) => (
                      <div key={taskIndex} className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${completedPhases.includes(phase.id)
                              ? "bg-green-400"
                              : "bg-gray-600"
                            }`}
                        />
                        <span
                          className={`text-sm ${completedPhases.includes(phase.id)
                              ? "text-green-300"
                              : phase.id <= Math.max(...completedPhases) + 1
                                ? "text-gray-400"
                                : "text-gray-600"
                            }`}
                        >
                          {task}
                        </span>
                      </div>
                    ))}
                  </div>

                  {phase.id <= Math.max(...completedPhases) + 1 && (
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-cyan-500/30 transition-all pointer-events-none" />
                  )}
                </motion.div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-2">
                Learning Progress
              </h3>
              <p className="text-gray-400 mb-4">
                Complete phases sequentially to unlock the next learning module.
                Each phase builds upon the previous one.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedPhases.length / project.phases.length) * 100
                        }%`,
                    }}
                  />
                </div>
                <span className="text-sm text-gray-400">
                  {completedPhases.length} of {project.phases.length} phases
                  completed
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
