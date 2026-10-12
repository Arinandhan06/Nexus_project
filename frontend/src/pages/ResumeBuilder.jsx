import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, FileText, Briefcase, Download, CheckCircle, PenTool } from "lucide-react";
import axios from "axios";

export default function ResumeBuilder() {
    const [jobDescription, setJobDescription] = useState("");
    const [generating, setGenerating] = useState(false);
    const [resumeData, setResumeData] = useState(null);

    const handleGenerate = async () => {
        if (!jobDescription.trim()) return;
        setGenerating(true);
        try {
            const res = await axios.post("http://localhost:8000/resume/build", {
                job_description: jobDescription
            });
            setResumeData(res.data);
        } catch (err) {
            console.error(err);
            alert("Failed to generate resume. Ensure backend is running.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/career-guidance" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                            <ArrowLeft className="text-gray-400" size={20} />
                        </Link>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="text-purple-400" />
                            Resume Architect AI
                        </h1>
                    </div>
                    {resumeData && (
                        <button className="btn-primary flex items-center gap-2 text-sm">
                            <Download size={16} /> Export PDF
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT: Input & Context */}
                <div className="space-y-6">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Briefcase className="text-purple-400" />
                            <h2 className="text-xl font-bold text-white">Target Job</h2>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                            Paste the job description or company name here. The AI will analyze your completed Sentinel projects and build a tailored resume.
                        </p>
                        <textarea
                            className="w-full bg-gray-950/50 border border-gray-700 rounded-xl p-4 text-gray-200 focus:border-purple-500 outline-none transition-all h-64 resize-none font-mono text-sm"
                            placeholder="Example: Software Engineer at Google. Needs React, Python, and Cloud experience..."
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={generating || !jobDescription}
                            className={`w-full mt-4 btn-primary py-4 flex items-center justify-center gap-2 ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
                            style={{ backgroundImage: "linear-gradient(to right, #8b5cf6, #d946ef)" }}
                        >
                            {generating ? (
                                <span className="animate-pulse">Architecting Resume...</span>
                            ) : (
                                <>
                                    <Sparkles size={18} /> Build My Resume
                                </>
                            )}
                        </button>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-800/30 rounded-2xl p-6">
                        <h3 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
                            <CheckCircle size={16} /> Sentinel Advantage
                        </h3>
                        <p className="text-sm text-blue-400/80">
                            This AI automatically cites your **Project Lab** and **My Lab** work, converting your code contributions into professional "STAR" bullet points.
                        </p>
                    </div>
                </div>

                {/* RIGHT: Preview */}
                <div className="bg-white text-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-[800px]">
                    {!resumeData ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                <FileText size={40} className="text-gray-300" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-500 mb-2">Resume Preview</h3>
                            <p className="max-w-md">Enter a job description to see your AI-generated resume here.</p>
                        </div>
                    ) : (
                        <div className="flex-1 p-8 overflow-y-auto font-sans">
                            {/* Resume Header (Dynamic) */}
                            <div className="border-b-2 border-gray-800 pb-4 mb-6">
                                <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wider">
                                    {resumeData.personal_details?.name || "User Name"}
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    {resumeData.personal_details?.email} • {resumeData.personal_details?.phone}
                                </p>
                            </div>

                            {/* Summary */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Professional Summary</h4>
                                <p className="text-sm leading-relaxed text-gray-800">{resumeData.summary}</p>
                            </div>

                            {/* Projects (STAR) */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Key Projects</h4>
                                <div className="space-y-4">
                                    {resumeData.projects_section?.map((proj, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h5 className="font-bold text-gray-900">{proj.title}</h5>
                                                <span className="text-xs text-gray-500">Sentinel Lab</span>
                                            </div>
                                            <ul className="list-disc list-outside ml-4 space-y-1">
                                                {proj.bullets?.map((bullet, j) => (
                                                    <li key={j} className="text-sm text-gray-700">{bullet}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Experience */}
                            {resumeData.experience_section && resumeData.experience_section.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Experience</h4>
                                    <div className="space-y-4">
                                        {resumeData.experience_section.map((exp, i) => (
                                            <div key={i}>
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <h5 className="font-bold text-gray-900">{exp.role}</h5>
                                                    <span className="text-xs text-gray-500">{exp.duration}</span>
                                                </div>
                                                <div className="text-sm text-gray-700 italic mb-1">{exp.company}</div>
                                                <p className="text-sm text-gray-700">{exp.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Education */}
                            {resumeData.education_section && resumeData.education_section.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Education</h4>
                                    <div className="space-y-2">
                                        {resumeData.education_section.map((edu, i) => (
                                            <div key={i} className="flex justify-between text-sm">
                                                <div>
                                                    <span className="font-bold text-gray-900">{edu.degree}</span>
                                                    <span className="text-gray-600 block">{edu.university}</span>
                                                </div>
                                                <span className="text-gray-500">{edu.year}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Skills */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Technical Skills</h4>
                                <p className="text-sm text-gray-800">
                                    {resumeData.skills_section?.join(" • ")}
                                </p>
                            </div>

                            {/* AI Tips */}
                            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                                <strong>💡 AI Tip:</strong> {resumeData.improvement_tips}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
