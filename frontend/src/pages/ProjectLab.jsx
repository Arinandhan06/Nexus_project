import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lightbulb, Code, Database, Globe, Smartphone, Cpu } from "lucide-react";
import axios from "axios";
import { useProgressStore } from "../store/useProgressStore";
import { ParticleCard } from "../components/MagicBento";

const iconMap = {
  lightbulb: Lightbulb,
  code: Code,
  database: Database,
  globe: Globe,
  smartphone: Smartphone,
  cpu: Cpu,
};

export default function ProjectLab() {
  const { generatedProjects, setProjects, addActiveProject } = useProgressStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch if empty
    if (generatedProjects.length === 0) {
      const token = sessionStorage.getItem("authToken");
      fetch("http://localhost:8000/market-match", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.projects) setProjects(data.projects);
        })
        .catch((err) => console.error("Failed to fetch projects:", err));
    }
  }, [generatedProjects.length, setProjects]);

  const handleStartProject = async (project) => {
    try {
      const token = sessionStorage.getItem("authToken");
      const response = await axios.post("http://localhost:8000/project/start", {
        title: project.title,
        tech_stack: project.tech ? project.tech.join(", ") : "React, Node.js",
        description: project.description
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newProject = response.data.project;
      addActiveProject(newProject);
      navigate(`/project/${newProject.id}`);
    } catch (err) {
      console.error("Failed to start project:", err);
      // alert("Error starting project."); // removed alert to be cleaner or handle 401
      if (err.response && err.response.status === 401) alert("Please log in to start a project.");
    }
  };

  const ProjectCard = ({ project }) => {
    const IconComponent = iconMap[project.icon] || Lightbulb;
    return (
      <ParticleCard
        className="bg-gray-800/50 border border-gray-700/50 p-5 rounded-xl hover:border-cyan-500/50 cursor-pointer transition-all min-h-[200px] flex flex-col justify-between"
        onClick={() => handleStartProject(project)}
        glowColor="6, 182, 212"
      >
        <div>
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${project.color || 'from-gray-500 to-gray-600'} flex items-center justify-center mb-4 relative z-[101]`}>
            <IconComponent size={20} className="text-white" />
          </div>
          <h3 className="font-bold text-lg text-white mb-2 line-clamp-1 relative z-[101]">{project.title}</h3>
          <p className="text-sm text-gray-400 mb-4 line-clamp-2 relative z-[101]">{project.description}</p>
        </div>
        <div className="flex flex-wrap gap-2 relative z-[101]">
          {project.tech?.slice(0, 3).map(t => (
            <span key={t} className="text-xs bg-gray-900 px-2 py-1 rounded text-gray-300 border border-gray-700">{t}</span>
          ))}
        </div>
      </ParticleCard>
    );
  };

  // Filter valid projects only
  const validProjects = generatedProjects.filter(p => p && p.title && p.id);

  // Filter projects by difficulty
  const easyProjects = validProjects.filter(p => !p.difficulty || p.difficulty.toLowerCase().includes("easy") || p.difficulty.toLowerCase().includes("beginner"));
  const mediumProjects = validProjects.filter(p => p.difficulty && (p.difficulty.toLowerCase().includes("medium") || p.difficulty.toLowerCase().includes("intermediate")));
  const hardProjects = validProjects.filter(p => p.difficulty && (p.difficulty.toLowerCase().includes("hard") || p.difficulty.toLowerCase().includes("tough") || p.difficulty.toLowerCase().includes("advanced")));

  return (
    <div className="min-h-screen bg-transparent p-6 text-gray-200">
      <Link to="/" className="flex items-center gap-2 text-neon hover:text-neon/80 mb-8 w-fit">
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neon mb-2">Project Lab</h1>
          <p className="text-gray-400">Curated projects tailored to your skill gaps.</p>
        </div>
        <Link to="/career-guidance" className="text-sm text-neon hover:underline">
          Need different projects? Visit Career Guidance &rarr;
        </Link>
      </div>

      {generatedProjects.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
          <Lightbulb size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400">No Projects Yet</h3>
          <p className="text-gray-500 mb-6">Upload your resume in Career Guidance to generate personalized projects.</p>
          <Link to="/career-guidance" className="btn-primary">Go to Career Guidance</Link>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Easy Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-8 bg-green-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-white">Easy Start</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {easyProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>

          {/* Medium Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-8 bg-yellow-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-white">Skill Builder (Medium)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mediumProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>

          {/* Hard Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-8 bg-red-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-white">Tough Challenge</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hardProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}