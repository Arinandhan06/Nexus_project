import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Lock, Play, Code, Database, Globe, Rocket, Terminal } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

export default function ProjectPhases() {
    const { projectId } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Determine if we are viewing a specific active project
        // If projectId starts with "proj_", fetch from /project/:id
        // otherwise fallback or error
        if (projectId) {
            axios.get(`http://localhost:8000/project/${projectId}`)
                .then(res => {
                    setProject(res.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load project", err);
                    setLoading(false);
                });
        }
    }, [projectId]);

    const handleUnlockPhase = async (phaseId) => {
        try {
            await axios.post("http://localhost:8000/project/unlock-phase", {
                project_id: projectId,
                phase_id: phaseId
            });
            // Refresh project state
            const res = await axios.get(`http://localhost:8000/project/${projectId}`);
            setProject(res.data);
        } catch (err) {
            console.error("Failed to unlock phase", err);
        }
    };

    if (loading) return <div className="text-center text-gray-400 mt-20">Loading Mission Control...</div>;
    if (!project) return <div className="text-center text-red-400 mt-20">Mission not found.</div>;

    const phases = project.phases || [];

    return (
        <div className="min-h-screen bg-transparent p-6 font-primary">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/project-lab" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                        <ArrowLeft size={20} />
                        Back to Project Lab
                    </Link>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <div className="flex items-start gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg shadow-blue-500/20">
                            🚀
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{project.title}</h1>
                            <p className="text-gray-400 max-w-2xl">{project.description}</p>
                            <div className="mt-4 flex gap-2">
                                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400">
                                    {project.tech_stack}
                                </span>
                                <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
                                    Status: Active
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Phases Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {phases.map((phase) => {
                        const isCompleted = phase.id < project.current_phase;
                        const isCurrent = phase.id === project.current_phase;
                        const isLocked = phase.id > project.current_phase;

                        return (
                            <motion.div
                                key={phase.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: phase.id * 0.1 }}
                                className={`
                            relative p-6 rounded-2xl border transition-all duration-300
                            ${isLocked
                                        ? "bg-slate-900/50 border-slate-800 opacity-60 grayscale"
                                        : isCurrent
                                            ? "bg-gradient-to-br from-blue-900/20 to-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                                            : "bg-slate-800/30 border-green-500/30"}
                        `}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`
                                w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
                                ${isCompleted ? "bg-green-500/20 text-green-400" : isCurrent ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-500"}
                            `}>
                                        {isCompleted ? <CheckCircle size={20} /> : isLocked ? <Lock size={20} /> : phase.id}
                                    </div>
                                    <div className="px-2 py-1 rounded text-xs font-mono uppercase tracking-wider text-slate-500">
                                        Phase {phase.id}
                                    </div>
                                </div>

                                <h3 className={`text-xl font-bold mb-2 ${isLocked ? "text-gray-500" : "text-white"}`}>
                                    {phase.title}
                                </h3>
                                <p className="text-sm text-gray-400 mb-6 h-10 line-clamp-2">
                                    {phase.description}
                                </p>

                                <div className="space-y-3 mb-6">
                                    {phase.tasks.slice(0, 3).map((task, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isLocked ? "bg-slate-700" : "bg-blue-500/50"}`} />
                                            <span className={isLocked ? "line-through opacity-50" : ""}>{task}</span>
                                        </div>
                                    ))}
                                </div>

                                {isCurrent && (
                                    <Link
                                        to={`/project/${projectId}/foundry`}
                                        className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20 text-sm font-bold"
                                    >
                                        <Code size={16} />
                                        Enter The Foundry
                                    </Link>
                                )}
                                {isCompleted && (
                                    <div className="w-full py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg flex items-center justify-center gap-2 text-sm">
                                        <CheckCircle size={16} />
                                        Completed
                                    </div>
                                )}
                                {isLocked && (
                                    <button disabled className="w-full py-2 bg-slate-800 text-slate-500 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed text-sm">
                                        <Lock size={16} />
                                        Locked
                                    </button>
                                )}

                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
