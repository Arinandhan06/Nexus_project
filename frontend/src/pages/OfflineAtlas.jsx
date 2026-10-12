// OfflineAtlas.jsx
import { motion } from "framer-motion";
import { Download, BookOpen, Code, Database, Globe, Smartphone, Cpu, FileText, Video, Headphones } from "lucide-react";
import TopBar from "../components/TopBar";
import { ParticleCard } from "../components/MagicBento";

const offlineResources = [
  {
    category: "Programming Fundamentals",
    icon: Code,
    color: "from-blue-500 to-cyan-600",
    glow: "6, 182, 212", // Cyan
    resources: [
      {
        title: "Python Complete Course",
        type: "Video",
        size: "2.3 GB",
        duration: "40 hours",
        format: "MP4",
        description: "Complete Python programming from basics to advanced"
      },
      {
        title: "Data Structures & Algorithms",
        type: "PDF Guide",
        size: "45 MB",
        duration: "300 pages",
        format: "PDF",
        description: "Comprehensive guide with examples and exercises"
      },
      {
        title: "JavaScript Fundamentals",
        type: "Interactive",
        size: "180 MB",
        duration: "25 hours",
        format: "HTML/JS",
        description: "Interactive JavaScript course with code playground"
      }
    ]
  },
  {
    category: "Web Development",
    icon: Globe,
    color: "from-green-500 to-emerald-600",
    glow: "16, 185, 129", // Emerald
    resources: [
      {
        title: "React Masterclass",
        type: "Video",
        size: "3.1 GB",
        duration: "50 hours",
        format: "MP4",
        description: "Build modern React applications with hooks and context"
      },
      {
        title: "Node.js Backend Development",
        type: "Video",
        size: "2.8 GB",
        duration: "35 hours",
        format: "MP4",
        description: "Full-stack Node.js with Express and MongoDB"
      },
      {
        title: "CSS Grid & Flexbox Mastery",
        type: "Interactive",
        size: "95 MB",
        duration: "15 hours",
        format: "HTML/CSS",
        description: "Master modern CSS layout techniques"
      }
    ]
  },
  {
    category: "Data Science & AI",
    icon: Cpu,
    color: "from-purple-500 to-pink-600",
    glow: "236, 72, 153", // Pink
    resources: [
      {
        title: "Machine Learning Fundamentals",
        type: "Video",
        size: "4.2 GB",
        duration: "60 hours",
        format: "MP4",
        description: "ML algorithms, neural networks, and practical applications"
      },
      {
        title: "Python for Data Science",
        type: "Jupyter Notebooks",
        size: "320 MB",
        duration: "200+ exercises",
        format: "IPYNB",
        description: "Hands-on data analysis with pandas, numpy, matplotlib"
      },
      {
        title: "Deep Learning Specialization",
        type: "Video",
        size: "5.5 GB",
        duration: "80 hours",
        format: "MP4",
        description: "Neural networks, CNNs, RNNs, and transformers"
      }
    ]
  },
  {
    category: "Mobile Development",
    icon: Smartphone,
    color: "from-orange-500 to-red-600",
    glow: "249, 115, 22", // Orange
    resources: [
      {
        title: "React Native Complete Guide",
        type: "Video",
        size: "3.8 GB",
        duration: "55 hours",
        format: "MP4",
        description: "Build cross-platform mobile apps with React Native"
      },
      {
        title: "Flutter Development Bootcamp",
        type: "Video",
        size: "4.1 GB",
        duration: "65 hours",
        format: "MP4",
        description: "Create beautiful native apps with Flutter and Dart"
      }
    ]
  },
  {
    category: "Databases & DevOps",
    icon: Database,
    color: "from-indigo-500 to-purple-600",
    glow: "139, 92, 246", // Violet
    resources: [
      {
        title: "MongoDB Complete Course",
        type: "Video",
        size: "2.5 GB",
        duration: "30 hours",
        format: "MP4",
        description: "NoSQL database design and administration"
      },
      {
        title: "Docker & Kubernetes",
        type: "Video",
        size: "3.2 GB",
        duration: "45 hours",
        format: "MP4",
        description: "Containerization and orchestration mastery"
      },
      {
        title: "AWS Cloud Architecture",
        type: "Documentation",
        size: "150 MB",
        duration: "500 pages",
        format: "PDF",
        description: "Complete AWS services and best practices guide"
      }
    ]
  }
];

const borderMap = [
  "hover:border-cyan-500/50",
  "hover:border-emerald-500/50",
  "hover:border-pink-500/50",
  "hover:border-orange-500/50",
  "hover:border-violet-500/50"
];

export default function OfflineAtlas() {
  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <TopBar />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-white mb-2">Offline Atlas</h1>
            <p className="text-gray-400">Download and access learning resources offline, tailored to your career path</p>
          </motion.div>

          {/* Download Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Download size={20} className="text-blue-400" />
                <span className="text-sm text-gray-400">Downloaded</span>
              </div>
              <div className="text-2xl font-bold text-white">24</div>
              <div className="text-xs text-gray-400">Resources</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={20} className="text-green-400" />
                <span className="text-sm text-gray-400">Total Size</span>
              </div>
              <div className="text-2xl font-bold text-white">45.2 GB</div>
              <div className="text-xs text-gray-400">Storage Used</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Video size={20} className="text-purple-400" />
                <span className="text-sm text-gray-400">Video Hours</span>
              </div>
              <div className="text-2xl font-bold text-white">380+</div>
              <div className="text-xs text-gray-400">Learning Content</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm rounded-lg p-4 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={20} className="text-orange-400" />
                <span className="text-sm text-gray-400">Documents</span>
              </div>
              <div className="text-2xl font-bold text-white">156</div>
              <div className="text-xs text-gray-400">PDFs & Guides</div>
            </div>
          </motion.div>

          {/* Resource Categories */}
          <div className="space-y-8">
            {offlineResources.map((category, categoryIndex) => <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${category.color} flex items-center justify-center shadow-lg shadow-${category.color.split(' ')[1]}/20`}>
                  <category.icon size={20} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{category.category}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.resources.map((resource, resourceIndex) => (
                  <ParticleCard
                    key={resource.title}
                    className={`bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/5 ${borderMap[categoryIndex]} transition-all duration-300 group cursor-pointer relative flex flex-col justify-between`}
                    glowColor={category.glow}
                    clickEffect={true}
                  >
                    <div className="relative z-[101]">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-8 h-8 rounded-md bg-gradient-to-r ${category.color} flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity`}>
                          {resource.type === 'Video' && <Video size={14} className="text-white" />}
                          {resource.type === 'PDF Guide' && <FileText size={14} className="text-white" />}
                          {resource.type === 'Interactive' && <Code size={14} className="text-white" />}
                          {resource.type === 'Jupyter Notebooks' && <BookOpen size={14} className="text-white" />}
                          {resource.type === 'Documentation' && <FileText size={14} className="text-white" />}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400">{resource.size}</div>
                          <div className="text-xs text-gray-500">{resource.format}</div>
                        </div>
                      </div>

                      <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors mb-2">
                        {resource.title}
                      </h3>

                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                        {resource.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{resource.duration}</span>
                        <button className={`bg-gradient-to-r ${category.color} text-white px-3 py-1 rounded text-xs font-medium opacity-90 hover:opacity-100 transition-all duration-300 transform hover:scale-105 shadow-lg`}>
                          Download
                        </button>
                      </div>
                    </div>
                  </ParticleCard>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}