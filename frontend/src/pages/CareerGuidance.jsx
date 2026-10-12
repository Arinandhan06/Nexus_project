import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Upload, FileText, CheckCircle, ArrowLeft, X, Briefcase,
    MessageCircle, Send, Bot, Sparkles, Plus, History, Copy, Edit, Trash2
} from "lucide-react";
import axios from "axios";
import { useProgressStore } from "../store/useProgressStore";

export default function CareerGuidance() {
    const navigate = useNavigate();
    // Safe access to store
    const store = useProgressStore();
    const setProfile = store.setProfile || (() => { });
    const setProjects = store.setProjects || (() => { });

    // --- Resume Upload State ---
    const [file, setFile] = useState(null);
    const [targetRole, setTargetRole] = useState("Software Engineer");
    const [uploading, setUploading] = useState(false);
    const [uploaded, setUploaded] = useState(false);

    // --- Chatbot State ---
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Hello! I'm your career assistant. I can help you analyze your resume gaps, suggest projects, or refine your roadmap. Ask me anything!",
            sender: "bot",
            timestamp: new Date(),
        },
    ]);
    const [chatInput, setChatInput] = useState("");
    const [isTyping, setIsTyping] = useState(false); // Define isTyping state
    const messagesEndRef = useRef(null);

    // --- Persistence & History State ---
    const [sessionId, setSessionId] = useState(sessionStorage.getItem("active_chat_session") || null);
    const [chatHistoryList, setChatHistoryList] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        // Load session if exists
        if (sessionId) {
            loadChatHistory(sessionId);
        } else {
            createNewSession();
        }
        loadAllSessions();
    }, [sessionId]);

    const createNewSession = async () => {
        try {
            const token = sessionStorage.getItem("authToken"); // Get Token
            const res = await axios.post("http://localhost:8000/chat/new", {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const newId = res.data.session_id;
            setSessionId(newId);
            sessionStorage.setItem("active_chat_session", newId);
            setMessages([
                {
                    id: 'intro',
                    text: "Hello! I'm your career assistant. I can help you analyze your resume gaps, suggest projects, or refine your roadmap. Ask me anything!",
                    sender: "bot",
                    timestamp: new Date()
                }
            ]);
            loadAllSessions();
        } catch (e) {
            console.error("Failed to create session", e);
        }
    };

    // Helper to remove JSON blocks from chat display
    const cleanMessageText = (text) => {
        if (!text) return "";
        let cleaned = text.replace(/```(?:json)?\s*[\s\S]*?\s*```/g, "").trim();
        const rawJsonStart = cleaned.lastIndexOf('{ "projects":');
        if (rawJsonStart > -1) {
            cleaned = cleaned.substring(0, rawJsonStart).trim();
        }
        return cleaned;
    };

    const loadChatHistory = async (sessId) => {
        try {
            const token = sessionStorage.getItem("authToken"); // Get Token
            const res = await axios.get(`http://localhost:8000/chat/history/${sessId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Transform to UI format
            const hist = res.data.messages.map((m, i) => ({
                id: i,
                text: cleanMessageText(m.content), // Apply cleaning to history
                sender: m.role === 'assistant' ? 'bot' : m.role,
                timestamp: new Date()
            }));

            if (hist.length === 0) {
                setMessages([
                    {
                        id: 'intro',
                        text: "Hello! I'm your career assistant. I can help you analyze your resume gaps, suggest projects, or refine your roadmap. Ask me anything!",
                        sender: "bot",
                        timestamp: new Date()
                    }
                ]);
            } else {
                setMessages(hist);
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const loadAllSessions = async () => {
        try {
            const token = sessionStorage.getItem("authToken"); // Get Token
            const res = await axios.get("http://localhost:8000/chat/sessions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChatHistoryList(res.data);
        } catch (e) { console.error(e); }
    }

    const deleteSession = async (sessId) => {
        if (!confirm("Are you sure you want to delete this chat?")) return;
        try {
            const token = sessionStorage.getItem("authToken");
            await axios.delete(`http://localhost:8000/chat/sessions/${sessId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // If deleting active session, switch to new one or clear
            if (sessionId === sessId) {
                setSessionId(null);
                setMessages([]);
                sessionStorage.removeItem("active_chat_session");
                createNewSession();
            }
            loadAllSessions();
        } catch (e) { console.error("Delete failed", e); }
    };

    const switchSession = (id) => {
        setSessionId(id);
        sessionStorage.setItem("active_chat_session", id);
        setShowHistory(false);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const removeFile = () => {
        setFile(null);
        setUploaded(false);
    };

    const handleUpload = async () => {
        if (!file || !targetRole) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("target_role", targetRole);

        try {
            // Ensure backend URL is correct
            const token = sessionStorage.getItem("authToken");
            const response = await axios.post("http://localhost:8000/analyze", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                },
            });

            console.log("Analysis Data:", response.data);
            if (response.data.profile) setProfile(response.data.profile);
            if (response.data.projects) setProjects(response.data.projects);

            setUploading(false);
            setUploaded(true);

            setMessages(prev => [...prev, {
                id: Date.now(),
                text: `✅ I've analyzed your resume! Based on your gaps for "${targetRole}", I have generated new projects in the Project Lab.`,
                sender: "bot",
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error("Upload error:", error);
            alert("Analysis failed. Ensure Backend is running (http://localhost:8000).");
            setUploading(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg = { id: Date.now(), text: chatInput, sender: "user", timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setChatInput("");
        setIsTyping(true);

        try {
            // Updated to send JSON with session_id
            const token = sessionStorage.getItem("authToken");
            const res = await axios.post("http://localhost:8000/chat", {
                message: userMsg.text,
                session_id: sessionId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            let responseText = res.data.response;

            // Check for JSON block (Project Generation)
            // Allow ```json or just ```
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

            if (jsonMatch) {
                try {
                    const jsonContent = JSON.parse(jsonMatch[1]);
                    if (jsonContent.projects && Array.isArray(jsonContent.projects)) {

                        // Sanitize and Normalize new projects
                        const newProjects = jsonContent.projects.map((p, idx) => ({
                            ...p,
                            id: p.id || `gen-${Date.now()}-${idx}`,
                            difficulty: p.difficulty || "Medium", // Default to Medium if missing
                            icon: p.icon || "code",
                            color: p.color || "from-blue-500 to-cyan-600"
                        }));

                        const currentProjects = store.generatedProjects || [];

                        // 1. Identify which levels are being updated
                        const updatedLevels = new Set();
                        newProjects.forEach(p => {
                            const diff = (p.difficulty || "").toLowerCase();
                            if (diff.includes("easy") || diff.includes("beginner")) updatedLevels.add("easy");
                            if (diff.includes("medium") || diff.includes("intermediate")) updatedLevels.add("medium");
                            if (diff.includes("hard") || diff.includes("tough") || diff.includes("advanced")) updatedLevels.add("hard");
                        });

                        // 2. Filter out OLD projects that match the updated levels
                        const keptProjects = currentProjects.filter(p => {
                            const diff = (p.difficulty || "").toLowerCase();
                            let isTargeted = false;

                            if (updatedLevels.has("easy") && (diff.includes("easy") || diff.includes("beginner"))) isTargeted = true;
                            if (updatedLevels.has("medium") && (diff.includes("medium") || diff.includes("intermediate"))) isTargeted = true;
                            if (updatedLevels.has("hard") && (diff.includes("hard") || diff.includes("tough") || diff.includes("advanced"))) isTargeted = true;

                            return !isTargeted; // Keep if NOT targeted
                        });

                        // 3. Merge
                        const merged = [...keptProjects, ...newProjects];
                        setProjects(merged);

                        // 4. Persist to Backend (Save for Refresh)
                        axios.post("http://localhost:8000/update-generated-projects", { projects: merged })
                            .catch(err => console.error("Failed to save projects persistence:", err));

                        // Remove JSON from display text
                        // FIX: Aggressive regex to catch ```json ... ``` AND raw JSON blocks if leaked
                        responseText = responseText.replace(/```(?:json)?\s*[\s\S]*?\s*```/g, "").trim();

                        // Also remove pure raw JSON if it exists at the end (sometimes LLM forgets code blocks)
                        const rawJsonStart = responseText.lastIndexOf('{ "projects":');
                        if (rawJsonStart > -1) {
                            responseText = responseText.substring(0, rawJsonStart).trim();
                        }

                        responseText += "\n\n✅ **Project Lab updated!** (Refreshed specific levels)";
                    }
                } catch (e) {
                    console.error("Failed to parse project JSON", e);
                }
            }

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: responseText,
                sender: "bot",
                timestamp: new Date()
            }]);
        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: "Sorry, I'm offline right now.",
                sender: "bot",
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-transparent p-6 text-gray-200">
            <Link to="/" className="flex items-center gap-2 text-neon hover:text-neon/80 mb-6 w-fit">
                <ArrowLeft size={20} /> Back to Dashboard
            </Link>

            <h1 className="text-3xl font-bold text-neon mb-2 flex items-center gap-2">
                <Sparkles className="text-neon" /> Career Guidance Center
            </h1>
            <p className="text-gray-400 mb-8">Upload your resume for analysis or chat with our AI to refine your path.</p>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full flex-1">

                {/* LEFT WRAPPER */}
                <div className="flex flex-col gap-6">

                    {/* LEFT: Resume */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 h-fit">

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                <Upload className="text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Resume Analysis</h2>
                        </div>

                        {!uploaded ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Target Role</label>
                                    <input
                                        type="text"
                                        value={targetRole}
                                        onChange={(e) => setTargetRole(e.target.value)}
                                        className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-neon outline-none"
                                    />
                                </div>

                                {!file ? (
                                    <label className="border-2 border-dashed border-gray-700 hover:border-neon rounded-xl p-8 flex flex-col items-center cursor-pointer transition-colors">
                                        <FileText size={40} className="text-gray-500 mb-2" />
                                        <span className="text-gray-400">Click to upload PDF/TXT</span>
                                        <input type="file" onChange={handleFileChange} className="hidden" accept=".pdf,.txt" />
                                    </label>
                                ) : (
                                    <div className="bg-gray-800 p-4 rounded-xl flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <FileText className="text-neon" />
                                            <span className="text-white truncate max-w-[200px]">{file.name}</span>
                                        </div>
                                        <button onClick={removeFile}><X className="text-gray-400 hover:text-red-400" /></button>
                                    </div>
                                )}

                                <button
                                    onClick={handleUpload}
                                    disabled={!file || uploading}
                                    className="w-full btn-primary py-3 flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {uploading ? <span className="animate-pulse">Analyzing...</span> : "Analyze & Generate Projects"}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <CheckCircle size={60} className="text-green-500 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-white mb-2">Analysis Complete!</h3>
                                <p className="text-gray-400 mb-6">Your customized projects are ready in the Project Lab.</p>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => setUploaded(false)} className="text-sm text-gray-500 hover:text-white">Upload New Resume</button>
                                    <Link to="/project-lab" className="btn-secondary">Go to Project Lab</Link>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Resume Builder Promo Section */}
                    <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-5 flex items-center justify-between mt-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FileText className="text-purple-400" size={20} /> AI Resume Architect
                            </h3>
                            <p className="text-sm text-gray-300 mt-1">
                                Build a perfect resume tailored to your dream job using your Sentinel projects.
                            </p>
                        </div>
                        <Link to="/resume-builder" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            Build Now <ArrowLeft className="rotate-180" size={16} />
                        </Link>
                    </div>

                </div>


                {/* RIGHT: Chat */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col h-[600px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <MessageCircle className="text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Career Mentor AI</h2>
                        </div>

                        <div className="flex gap-2 relative">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="Chat History"
                            >
                                <History size={20} />
                            </button>
                            <button
                                onClick={createNewSession}
                                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="New Chat"
                            >
                                <Plus size={20} />
                            </button>

                            {/* History Dropdown */}
                            {showHistory && (
                                <div className="absolute top-12 right-0 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                    {chatHistoryList.map(s => (
                                        <div
                                            key={s.id}
                                            className={`p-3 border-b border-gray-800 flex justify-between items-center group hover:bg-gray-800 transition-colors ${s.id === sessionId ? 'bg-gray-800 text-neon' : 'text-gray-400'}`}
                                        >
                                            <span
                                                onClick={() => switchSession(s.id)}
                                                className="cursor-pointer truncate flex-1"
                                            >
                                                {s.title}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteSession(s.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                                title="Delete Chat"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin scrollbar-thumb-gray-700">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`group flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.sender === "bot" && <div className="w-8 h-8 rounded-full bg-neon/20 flex items-center justify-center"><Bot size={16} className="text-neon" /></div>}

                                <div className={`relative max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === "user"
                                    ? "bg-blue-600 text-white rounded-tr-none"
                                    : "bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none"
                                    }`}>
                                    {/* Pure text for safety */}
                                    <p className="whitespace-pre-wrap">{msg.text}</p>

                                    {/* Copy / Edit Actions */}
                                    <div className={`absolute -bottom-6 ${msg.sender === 'user' ? 'right-0' : 'left-0'} flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(msg.text)}
                                            className="text-gray-500 hover:text-white p-1" title="Copy"
                                        >
                                            <Copy size={12} />
                                        </button>
                                        {msg.sender === 'user' && (
                                            <button
                                                onClick={() => setChatInput(msg.text)}
                                                className="text-gray-500 hover:text-white p-1" title="Edit"
                                            >
                                                <Edit size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isTyping && <div className="text-xs text-gray-500 ml-12">AI is typing...</div>}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                            placeholder="Ask about your resume..."
                            className="flex-1 bg-gray-800 border-gray-700 rounded-xl px-4 text-white focus:border-neon outline-none"
                        />
                        <button onClick={handleSendChat} className="p-3 bg-neon text-black rounded-xl hover:bg-neon/80 flex items-center justify-center transition-colors">
                            <Send size={20} />
                        </button>
                    </div>
                </div>
                {/* End Right Chat */}

            </div>
            {/* End Grid */}

        </div>
    );
}
