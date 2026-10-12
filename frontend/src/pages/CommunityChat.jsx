import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash,
  MessageSquare,
  Send,
  Paperclip,
  Image as ImageIcon,
  Code as CodeIcon,
  MoreVertical,
  Search,
  Users,
  FileText,
  Smile
} from "lucide-react";
import TopBar from "../components/TopBar";
import axios from "axios";

// Mock Data for Channels


// Mock Data for Messages


export default function CommunityChat() {
  const [activeChannel, setActiveChannel] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch Channels on Mount
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const token = sessionStorage.getItem("authToken");
        const res = await axios.get("http://localhost:8000/community/channels", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChannels(res.data);
        if (res.data.length > 0) setActiveChannel(res.data[0]);
      } catch (err) {
        console.error("Failed to fetch channels", err);
      }
    };
    fetchChannels();
  }, []);

  // Poll Messages
  useEffect(() => {
    if (!activeChannel) return;

    const fetchMessages = async () => {
      try {
        const token = sessionStorage.getItem("authToken");
        const res = await axios.get(`http://localhost:8000/community/messages/${activeChannel.name}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Only update if different to avoid jitter? React diffing handles this well mostly.
        // For now, simple replace.
        setMessages(res.data);
      } catch (err) { }
    };

    fetchMessages(); // Initial fetch
    const interval = setInterval(fetchMessages, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [activeChannel]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel) return;

    // Optimistic UI update (optional, but safer to wait for poll or just append locally ephemeral)
    // We will just fire and forget, let polling catch it (or manual append for responsiveness)

    // Append locally for instant feeling
    const tempMsg = {
      id: Date.now(),
      user: "You",
      avatar: "",
      role: "Member",
      content: newMessage,
      time: new Date().toLocaleTimeString(),
      type: "text",
      channel: activeChannel.name
    };
    setMessages(prev => [...prev, tempMsg]);
    const msgToSend = newMessage;
    setNewMessage("");

    try {
      const token = sessionStorage.getItem("authToken");
      await axios.post("http://localhost:8000/community/messages", {
        channel: activeChannel.name,
        content: msgToSend,
        type: "text"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-transparent text-gray-200">
      <TopBar />

      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full p-4 gap-4">
        {/* Sidebar - Channel List */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-64 bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl flex flex-col hidden md:flex"
        >
          <div className="p-4 border-b border-white/5">
            <h2 className="font-bold text-lg text-white mb-4">Community</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Find channels..."
                className="w-full bg-[#0B1221] border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-6">
            {/* Categories */}
            {[...new Set(channels.map(c => c.category))].map(category => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">{category}</h3>
                <div className="space-y-1">
                  {channels.filter(c => c.category === category).map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => setActiveChannel(channel)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${activeChannel?.id === channel.id
                        ? "bg-cyan-500/10 text-cyan-400"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                        }`}
                    >
                      <Hash size={16} />
                      {channel.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
                <span className="font-bold text-white text-xs">Y</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">You</p>
                <p className="text-xs text-green-400">Online</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Chat Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl flex flex-col overflow-hidden relative"
        >
          {/* Background Decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

          {/* Chat Header */}
          <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2">
              <Hash size={24} className="text-cyan-400" />
              <div>
                <h2 className="font-bold text-white">{activeChannel?.name || "Select a Channel"}</h2>
                <p className="text-xs text-gray-400">Topic: General discussion for {activeChannel?.name || "..."}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0B1221] bg-gray-700" />
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-[#0B1221] bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">+24</div>
              </div>
              <MoreVertical size={20} className="cursor-pointer hover:text-white" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!activeChannel ? (
              <div className="flex items-center justify-center h-full text-gray-500">Select a channel to start chatting</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 group ${msg.user === 'You' ? 'flex-row-reverse' : ''}`}>
                  <img src={msg.avatar || `https://ui-avatars.com/api/?name=${msg.user}&background=random`} alt={msg.user} className="w-10 h-10 rounded-full bg-gray-700 object-cover" />
                  <div className={`max-w-[70%] ${msg.user === 'You' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-gray-200">{msg.user}</span>
                      <span className="text-xs text-gray-500">{msg.time}</span>
                    </div>

                    {msg.type === 'text' && (
                      <div className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.user === 'You'
                        ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                        : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-none group-hover:bg-white/10 transition-colors'
                        }`}>
                        {msg.content}
                      </div>
                    )}

                    {msg.type === 'code' && (
                      <div className="bg-[#0D1117] border border-gray-700 rounded-xl overflow-hidden w-full min-w-[300px]">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                          <span className="text-xs text-cyan-400 font-mono">{msg.language}</span>
                          <CodeIcon size={12} className="text-gray-500" />
                        </div>
                        <pre className="p-3 text-sm font-mono text-gray-300 overflow-x-auto">
                          <code>{msg.content}</code>
                        </pre>
                      </div>
                    )}

                    {msg.type === 'file' && (
                      <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-500/30 cursor-pointer transition-colors">
                        <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                          <FileText size={20} className="text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{msg.content}</p>
                          <p className="text-xs text-gray-500">{msg.size}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-900/50 border-t border-white/5">
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 bg-[#0B1221] border border-white/10 rounded-xl p-2 focus-within:border-cyan-500/50 transition-colors">
              <button type="button" className="p-2 text-gray-400 hover:text-cyan-400 transition-colors">
                <Paperclip size={20} />
              </button>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={`Message #${activeChannel?.name || "..."}`}
                disabled={!activeChannel}
                className="w-full bg-transparent border-none focus:ring-0 text-gray-200 placeholder-gray-500 resize-none max-h-32 py-2 text-sm disabled:opacity-50"
                rows={1}
              />
              <div className="flex items-center gap-1">
                <button type="button" className="p-2 text-gray-400 hover:text-gray-200 transition-colors" title="Insert Code Block">
                  <CodeIcon size={20} />
                </button>
                <button type="button" className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
                  <ImageIcon size={20} />
                </button>
                <button type="submit" className="p-2 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg transition-colors ml-1">
                  <Send size={18} />
                </button>
              </div>
            </form>
            <div className="text-center mt-2">
              <p className="text-[10px] text-gray-600">
                **Tip**: You can drag and drop code files directly into the chat to share snippets.
              </p>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
