import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play, CheckCircle, ArrowLeft, Cpu, AlertCircle,
    FileCode, Send, Paperclip, GripVertical, GripHorizontal, Users
} from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function TheFoundry() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);
    const [currentPhase, setCurrentPhase] = useState(1);
    const [code, setCode] = useState("// Write your solution here...\n\nprint('Hello World')");

    // Chat State
    const [messages, setMessages] = useState([
        { role: "system", content: "Welcome to The Foundry. I am The Architect. Ready. You can upload screenshots of your output for verification." }
    ]);
    const [chatInput, setChatInput] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [isChatting, setIsChatting] = useState(false);

    // Verification State
    const fileInputRef = useRef(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isApproved, setIsApproved] = useState(false);

    const chatEndRef = useRef(null);

    // --- RESIZING STATE ---
    const [leftWidth, setLeftWidth] = useState(30); // Percentage
    const [topHeight, setTopHeight] = useState(60); // Percentage
    const [language, setLanguage] = useState("english"); // New State

    const containerRef = useRef(null);
    const rightPanelRef = useRef(null);

    // COLLABORATION STATE
    const [sessionCode, setSessionCode] = useState(null);
    const [remoteCode, setRemoteCode] = useState(null);

    // Sync Interval (Every 5s)
    // Sync Interval (Every 5s) - DISABLED due to manual sync preference and server connection handling
    /*
    useEffect(() => {
        if (!projectId) return;
        const interval = setInterval(async () => {
            try {
                const res = await axios.get(`http://localhost:8000/project/${projectId}/sync`);
                if (res.data.code && res.data.code !== code) {
                    // Manual sync preferred
                }
            } catch (e) { }
        }, 5000);
        return () => clearInterval(interval);
    }, [projectId, code]);
    */

    const handleShare = async () => {
        if (sessionCode) {
            alert(`Session Code: ${sessionCode}`);
            return;
        }
        try {
            const res = await axios.post("http://localhost:8000/session/create", { project_id: projectId });
            setSessionCode(res.data.code);
            alert(`Session Live! Share this code: ${res.data.code}`);
        } catch (e) { alert("Error generating code"); }
    };

    const handleEditorChange = (val) => {
        setCode(val);
        // Debounced Sync
        const timeoutId = setTimeout(() => {
            axios.post("http://localhost:8000/project/sync", { project_id: projectId, code: val });
        }, 1000);
        return () => clearTimeout(timeoutId);
    };

    // Resize Handlers
    const handleDragLeft = (e) => {
        e.preventDefault();
        const handleMouseMove = (moveEvent) => {
            if (!containerRef.current) return;
            const containerWidth = containerRef.current.clientWidth;
            const newWidth = (moveEvent.clientX / containerWidth) * 100;
            if (newWidth > 15 && newWidth < 60) setLeftWidth(newWidth);
        };
        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "default";
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "col-resize";
    };

    const handleDragTop = (e) => {
        e.preventDefault();
        const handleMouseMove = (moveEvent) => {
            if (!rightPanelRef.current) return;
            const panelHeight = rightPanelRef.current.clientHeight;
            // Calculate relative Y position within the right panel
            const rect = rightPanelRef.current.getBoundingClientRect();
            const newHeight = ((moveEvent.clientY - rect.top) / panelHeight) * 100;
            if (newHeight > 20 && newHeight < 80) setTopHeight(newHeight);
        };
        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "default";
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "row-resize";
    };


    useEffect(() => {
        if (projectId) {
            axios.get(`http://localhost:8000/project/${projectId}`)
                .then(res => {
                    setProject(res.data);
                    setCurrentPhase(res.data.current_phase);
                })
                .catch(err => console.error("Failed to load project", err));
        }
    }, [projectId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const activePhase = project?.phases?.find(p => p.id === currentPhase);

    const handleRunCode = async () => {
        setIsValidating(true);
        setMessages(prev => [...prev, { role: "system", content: "⚡ **EXECUTING CODE...**" }]);

        try {
            const res = await axios.post("http://localhost:8000/foundry/validate", {
                code: code,
                phase_objective: activePhase?.description || "Run code"
            });

            const { output, review } = res.data;

            // Use standard text for output block so ReactMarkdown renders it nicely
            const outputMsg = `**TERMINAL OUTPUT:**\n\`\`\`bash\n${output}\n\`\`\``;
            const reviewMsg = review ? `\n\n**ARCHITECT CRITIQUE:**\n${review}` : "";

            setMessages(prev => [...prev, { role: "system", content: outputMsg + reviewMsg }]);

        } catch (err) {
            setMessages(prev => [...prev, { role: "system", content: "❌ **ERROR:** Failed to execute simulation." }]);
        }
        setIsValidating(false);
    };

    const handleChat = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = { role: "user", content: chatInput };
        setMessages(prev => [...prev, userMsg]);
        setChatInput("");
        setIsChatting(true);

        try {
            const res = await axios.post("http://localhost:8000/foundry/chat", {
                message: userMsg.content,
                code: code,
                project_context: {
                    title: project.title,
                    phase_title: activePhase?.title,
                    phase_description: activePhase?.description
                },
                language: language // Pass language state
            });
            setMessages(prev => [...prev, { role: "system", content: res.data.response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: "system", content: "Connection lost." }]);
        }
        setIsChatting(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsVerifying(true);
        setMessages(prev => [...prev, { role: "user", content: `[Uploaded Screenshot: ${file.name}]` }]);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("phase_objective", activePhase?.description);

        try {
            const res = await axios.post("http://localhost:8000/foundry/verify", formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.approved) {
                setIsApproved(true);
                setMessages(prev => [...prev, { role: "system", content: `✅ **VERIFIED:** ${res.data.feedback} You may now submit the phase.` }]);
            } else {
                setMessages(prev => [...prev, { role: "system", content: `❌ **REJECTED:** ${res.data.feedback}` }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: "system", content: "Error processing image." }]);
        }
        setIsVerifying(false);
    };

    const handleSubmitPhase = async () => {
        if (!isApproved) {
            alert("Please upload a screenshot of your output for verification first.");
            return;
        }

        try {
            await axios.post("http://localhost:8000/project/unlock-phase", {
                project_id: projectId,
                phase_id: currentPhase
            });
            setCurrentPhase(prev => prev + 1);
            setIsApproved(false);
            setMessages(prev => [...prev, { role: "system", content: `Phase ${currentPhase} Complete! Initializing Phase ${currentPhase + 1}...` }]);
        } catch (err) {
            console.error("Failed to submit phase");
        }
    };

    if (!project || !activePhase) return <div className="text-white p-10 font-mono">INITIALIZING THE FOUNDRY...</div>;

    return (
        <div ref={containerRef} className="flex h-screen max-h-screen w-full bg-transparent text-gray-300 font-sans overflow-hidden select-none">

            {/* 1. LEFT PANEL - CHAT - Resizable */}
            <div
                style={{ width: `${leftWidth}%` }}
                className="flex flex-col bg-[#070e18] shrink-0 z-10 h-full transition-none"
            >
                <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0 bg-[#070e18]">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate("/my-lab")} className="text-gray-400 hover:text-white transition">
                            <ArrowLeft size={20} />
                        </button>
                        <h2 className="text-gray-100 font-semibold tracking-wide">The Architect</h2>
                    </div>

                    {/* Language Toggle */}
                    <button
                        onClick={() => setLanguage(l => l === "english" ? "tamil" : "english")}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${language === "tamil"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:border-blue-400"
                            }`}
                    >
                        {language === "tamil" ? "தமிழ் (Tamil)" : "ENG (US)"}
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 min-h-0 pb-4">
                    <AnimatePresence>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[95%] rounded-lg p-3 text-xs leading-relaxed ${msg.role === "user"
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                                    : "bg-gray-800 border border-gray-700 text-gray-200"
                                    }`}>
                                    {msg.role === "system" && <span className="block text-[10px] text-cyan-500 mb-1 font-bold">AI</span>}

                                    {/* Render Markdown Content */}
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>

                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isChatting && <div className="text-xs text-gray-500 animate-pulse">The Architect is thinking...</div>}
                    {isVerifying && <div className="text-xs text-cyan-500 animate-pulse">Analyzing visual data...</div>}
                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-800 flex gap-2 items-center shrink-0 bg-[#070e18]">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-gray-500 hover:text-cyan-400 transition p-2 hover:bg-gray-800 rounded-lg"
                        title="Upload Verification Screenshot"
                    >
                        <Paperclip size={18} />
                    </button>

                    <form onSubmit={handleChat} className="flex-1 flex gap-2">
                        <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            placeholder="Query..."
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-white"
                        />
                        <button type="submit" disabled={isChatting} className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition disabled:opacity-50">
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>

            {/* DRAG HANDLE (Chat <-> Content) */}
            <div
                onMouseDown={handleDragLeft}
                className="w-1 bg-[#1a2332] hover:bg-cyan-500 cursor-col-resize z-50 flex items-center justify-center transition-colors hover:w-1.5"
            >
                <GripVertical size={12} className="text-gray-600 pointer-events-none" />
            </div>

            {/* RIGHT SIDE - CONTENT */}
            <div ref={rightPanelRef} className="flex-1 flex flex-col h-full overflow-hidden min-w-0">

                {/* TOP: CODE EDITOR (Resizable Height) */}
                <div style={{ height: `${topHeight}%` }} className="flex flex-col border-b border-gray-800 relative bg-[#1e1e1e] min-h-0">
                    <div className="h-10 bg-[#0a111e] border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-10 w-full">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                            <FileCode size={14} />
                            <span>main.py</span>
                        </div>
                        <button
                            onClick={handleShare}
                            className={`flex items-center gap-2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${sessionCode ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                        >
                            <Users size={12} /> {sessionCode ? sessionCode : "Share Session"}
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    const res = await axios.get(`http://localhost:8000/project/${projectId}/sync`);
                                    if (res.data.code) {
                                        setCode(res.data.code);
                                        // alert("Workspace Config Refreshed"); // Optional feedback
                                    }
                                } catch (e) { console.error("Sync failed"); }
                            }}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                            title="Pull latest code from cloud"
                        >
                            <ArrowLeft size={10} className="rotate-180" /> Sync Cloud
                        </button>
                        <button
                            onClick={handleRunCode}
                            disabled={isValidating}
                            className="flex items-center gap-2 bg-[#00ff9d] hover:bg-[#00cc7d] text-black px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide transition-all shadow-[0_0_10px_rgba(0,255,157,0.2)] disabled:opacity-50"
                        >
                            {isValidating ? <Cpu className="animate-spin" size={14} /> : <Play size={14} fill="currentColor" />}
                            {isValidating ? "PROCESSING..." : "RUN & REVIEW"}
                        </button>
                    </div>

                    <div className="flex-1 relative w-full overflow-hidden">
                        <Editor
                            height="100%"
                            width="100%"
                            defaultLanguage="python"
                            theme="vs-dark"
                            value={code}
                            onChange={handleEditorChange}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "'Fira Code', monospace",
                                scrollBeyondLastLine: false,
                                padding: { top: 16 },
                                automaticLayout: true
                            }}
                        />
                    </div>
                </div>

                {/* DRAG HANDLE (Editor <-> Info) */}
                <div
                    onMouseDown={handleDragTop}
                    className="h-1 bg-[#1a2332] hover:bg-cyan-500 cursor-row-resize z-50 flex items-center justify-center transition-colors hover:h-1.5 shrink-0"
                >
                    <GripHorizontal size={12} className="text-gray-600 pointer-events-none" />
                </div>

                {/* BOTTOM: INFO PANEL */}
                <div className="flex-1 bg-transparent flex flex-col min-h-0 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 flex items-start justify-between shrink-0 bg-transparent">
                        <div>
                            <h1 className="text-lg font-bold text-white mb-0.5 tracking-tight">{activePhase.title}</h1>
                            <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">PHASE {activePhase.id}</p>
                        </div>
                        {isApproved ? (
                            <button onClick={handleSubmitPhase} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-black font-bold text-[10px] uppercase rounded flex items-center gap-2">
                                Next <CheckCircle size={12} />
                            </button>
                        ) : (
                            <div className="flex flex-col items-end gap-1">
                                <button disabled className="px-4 py-1.5 bg-gray-800 text-gray-500 font-bold text-[10px] uppercase rounded cursor-not-allowed border border-gray-700">
                                    Next &gt;
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Split Content Grid - Scrollable Content */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 p-6 min-h-0">
                        <div className="grid grid-cols-2 gap-8">
                            {/* COL 1: Objective & Instructions */}
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase flex items-center gap-2">
                                    <CheckCircle size={12} /> Objective
                                </h4>
                                <p className="text-xs text-gray-300 mb-4 leading-relaxed bg-[#0a111e] p-3 rounded border border-gray-800/50">
                                    {activePhase.description}
                                </p>

                                <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase">
                                    Instructions
                                </h4>
                                <ul className="space-y-2">
                                    {activePhase.tasks.map((task, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                                            <span className="mt-1 w-1 h-1 rounded-full bg-cyan-500 shrink-0 shadow-[0_0_4px_cyan]" />
                                            <span className="leading-relaxed">{task}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* COL 2: Resources & Status */}
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase">
                                    Resources
                                </h4>
                                <ul className="space-y-2 mb-6">
                                    {activePhase.resources && activePhase.resources.length > 0 ? (
                                        activePhase.resources.map((res, idx) => (
                                            <li key={idx}>
                                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-500 hover:text-white transition group">
                                                    <span className="opacity-50 group-hover:opacity-100">🔗</span> {res.label}
                                                </a>
                                            </li>
                                        ))
                                    ) : (
                                        <li>
                                            <a href={`https://www.google.com/search?q=${encodeURIComponent(activePhase.title + " tutorial")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-green-500 hover:text-white transition group">
                                                <span className="opacity-50 group-hover:opacity-100">🔍</span> Search: {activePhase.title}
                                            </a>
                                        </li>
                                    )}
                                </ul>

                                <div className={`p-3 rounded border ${isApproved ? 'bg-green-900/10 border-green-500/30' : 'bg-[#0e1623] border-gray-800'}`}>
                                    <h4 className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Verification</h4>
                                    {isApproved ? (
                                        <div className="text-green-400 text-xs font-bold flex items-center gap-2">
                                            <CheckCircle size={14} /> Verified
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2 text-gray-500 text-[10px]">
                                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                            <p>Upload a screenshot in chat to verify.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
