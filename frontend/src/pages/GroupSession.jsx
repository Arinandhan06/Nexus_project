import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Globe } from 'lucide-react';
import axios from 'axios';

export default function GroupSession() {
    const navigate = useNavigate();
    const [joinCode, setJoinCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);

    const handleJoin = async () => {
        if (!joinCode || joinCode.length !== 6) {
            setError("Please enter a valid 6-digit code.");
            return;
        }
        setIsJoining(true);
        setError(null);
        try {
            const res = await axios.post("http://localhost:8000/session/join", { code: joinCode });
            // Redirect to the Foundry with that Project ID
            navigate(`/project/${res.data.project_id}/foundry`); // Corrected path
        } catch (err) {
            setError("Invalid Code or Session Expired.");
        }
        setIsJoining(false);
    };


    return (
        <div className="p-8 h-full bg-transparent min-h-screen text-gray-200 font-sans">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                    <Users className="text-cyan-500" size={32} /> Sync & Collaborate
                </h1>
                <p className="text-gray-400 mb-12 text-lg">Work together in real-time. Join a squad or lead one.</p>

                <div className="flex justify-center">

                    {/* JOIN CARD */}
                    <div className="bg-[#0a111e] border border-gray-800 p-8 rounded-2xl relative hover:border-cyan-500/50 transition-all group max-w-lg w-full">
                        <div className="absolute -top-4 -left-4 w-12 h-12 bg-cyan-900/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                            <Globe size={20} className="text-cyan-400" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-4">Join a Session</h2>
                        <p className="text-gray-400 mb-6 text-sm">Enter the 6-digit access code provided by your team lead.</p>

                        <div className="space-y-4">
                            <input
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                placeholder="e.g. 592812"
                                maxLength={6}
                                className="w-full bg-black border border-gray-700 p-4 text-center text-2xl tracking-[0.5em] font-mono rounded-lg focus:outline-none focus:border-cyan-500 transition-colors text-white uppercase placeholder-gray-800"
                            />
                            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

                            <button
                                onClick={handleJoin}
                                disabled={isJoining}
                                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isJoining ? "CONNECTING..." : "ENTER WORKSPACE"}
                            </button>

                            <p className="text-xs text-gray-500 text-center mt-4 pt-4 border-t border-gray-800">
                                Tip: Generate a code from inside any Project Workspace by clicking <span className="text-cyan-400 font-bold">"Share Session"</span>.
                            </p>
                        </div>
                    </div>



                </div>
            </div>
        </div>
    );
}
