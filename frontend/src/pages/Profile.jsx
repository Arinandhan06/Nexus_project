import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { User, Mail, MapPin, Calendar, Award, BookOpen, Star, Shield, Edit, Camera, Check, Play, Terminal } from "lucide-react";
import TopBar from "../components/TopBar";
import ActivityHeatmap from "../components/ActivityHeatmap";
import api from "../lib/api";
import { NexusPanel, NexusButton, StatBadge, GlitchText } from "../components/nexus";

export default function Profile({ currentUser }) {
  const [profileData, setProfileData] = useState(null);
  const [meData, setMeData] = useState(currentUser || null);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  // Real activity data for heatmap
  const [activityData, setActivityData] = useState([]);

  const fetchProfile = async () => {
    await Promise.resolve();
    const token = sessionStorage.getItem("authToken");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [resProfile, resMe] = await Promise.allSettled([
        api.get("/profile"),
        api.get("/me")
      ]);

      if (resProfile.status === "fulfilled" && !resProfile.value.data.error) {
        setProfileData(resProfile.value.data);
        setGoals(resProfile.value.data.goals || []);
        setActivityData(resProfile.value.data.activity || []);
      }

      if (resMe.status === "fulfilled" && resMe.value.data) {
        setMeData(resMe.value.data);
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch profile", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleGoal = async (goal) => {
    // Optimistic UI
    const updatedGoals = goals.map(g => g.id === goal.id ? { ...g, is_done: !g.is_done } : g);
    setGoals(updatedGoals);

    try {
      await api.put(`/profile/goals/${goal.id}`, { is_done: !goal.is_done });
    } catch (e) {
      console.error("Failed to update goal");
      // Revert
      fetchProfile();
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get("email");

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    const updates = {
      full_name: formData.get("full_name"),
      bio: formData.get("bio"),
      location: formData.get("location"),
      email: email,
      avatar: profileData?.avatar // Preserve existing avatar
    };

    try {
      await api.post("/profile/update", updates);
      setIsEditing(false);
      fetchProfile(); // Refresh
    } catch (err) {
      alert("Failed to update profile");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setProfileData(prev => ({ ...prev, avatar: base64String }));

      try {
        const updates = {
          full_name: profileData.full_name || "",
          bio: profileData.bio || "",
          location: profileData.location || "",
          email: profileData.email || "",
          avatar: base64String
        };
        await api.post("/profile/update", updates);
      } catch (err) {
        console.error("Failed to upload avatar");
        fetchProfile();
      }
    };
    reader.readAsDataURL(file);
  };

  // derived user object
  const user = {
    name: meData?.display_name || profileData?.full_name || "Cadet X",
    username: meData?.github_username ? `@${meData.github_username}` : "@cadet",
    role: profileData?.role || `Chamber ${meData?.current_chamber ?? 1} Cadet`,
    email: meData?.email || profileData?.email || "cadet@nexus.ai",
    location: profileData?.location || "NEXUS Grid",
    joinDate: "Phase 1 Awakening",
    avatar: meData?.avatar_url || profileData?.avatar,
    bio: profileData?.bio || "Preparing for adversarial AI coding trials",
    nxp: meData?.total_nxp ?? 0,
    streak: meData?.current_streak ?? 0,
    bestStreak: meData?.best_streak ?? 0,
    chamber: meData?.current_chamber ?? 1,
  };

  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const stats = [
    { label: "Nexus Points (NXP)", value: `${user.nxp} NXP`, icon: Star, color: "text-emerald-400", bg: "bg-emerald-950/60 border border-emerald-500/30" },
    { label: "Chamber Streak", value: `${user.streak} (Best: ${user.bestStreak})`, icon: Shield, color: "text-cyan-400", bg: "bg-cyan-950/60 border border-cyan-500/30" },
    { label: "Active Chamber", value: `Chamber ${user.chamber}`, icon: BookOpen, color: "text-amber-400", bg: "bg-amber-950/60 border border-amber-500/30" },
    { label: "Goals Completed", value: goals.filter(g => g.is_done).length, icon: Award, color: "text-purple-400", bg: "bg-purple-950/60 border border-purple-500/30" }
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] text-cyan-400 font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs tracking-widest uppercase">Querying Cadet Archive...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent font-sans">
      <TopBar />

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header Card */}
          <NexusPanel variant="cyan" glow={true} className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
              {/* Avatar */}
              <div className="relative group shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-zinc-900 border-2 border-cyan-400/60 flex items-center justify-center shadow-xl relative z-10 overflow-hidden shadow-cyan-500/20">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={56} className="text-zinc-500" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute -bottom-1 -right-1 p-2 bg-cyan-400 rounded-xl text-zinc-950 shadow-lg z-20 hover:bg-cyan-300 transition-colors cursor-pointer"
                  aria-label="Upload Avatar"
                >
                  <Camera size={15} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  className="hidden"
                  accept="image/*"
                />
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left min-w-0">
                <div className="flex flex-col md:flex-row items-center md:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-1.5">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
                        <GlitchText variant="white" text={user.name} />
                      </h1>
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                        {user.username}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-mono">
                      <span className="text-cyan-400 font-semibold">{user.role}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-emerald-400 font-semibold">{user.nxp} NXP</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-amber-400 font-semibold">🔥 {user.streak} Streak</span>
                    </div>
                    <p className="text-zinc-400 text-xs sm:text-sm mt-2 font-mono">{user.bio}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <NexusButton
                      variant="cyan"
                      size="sm"
                      icon={Play}
                      onClick={() => navigate("/intro")}
                      title="Replay cinematic awakening sequence"
                    >
                      Replay Awakening
                    </NexusButton>
                    <NexusButton
                      variant="outline"
                      size="sm"
                      icon={Edit}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Profile
                    </NexusButton>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-3 text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-2 bg-zinc-900/70 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <Mail size={13} className="text-cyan-400" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-900/70 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <MapPin size={13} className="text-cyan-400" />
                    <span>{user.location}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-900/70 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <Calendar size={13} className="text-cyan-400" />
                    <span>Joined {user.joinDate}</span>
                  </div>
                </div>
              </div>
            </div>
          </NexusPanel>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <NexusPanel
                key={stat.label}
                variant={index === 0 ? "green" : index === 1 ? "cyan" : index === 2 ? "amber" : "neutral"}
                className="p-5"
              >
                <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                  <stat.icon size={20} />
                </div>
                <div className="text-2xl font-bold font-mono text-white mb-0.5">{stat.value}</div>
                <div className="text-xs font-mono text-zinc-400">{stat.label}</div>
              </NexusPanel>
            ))}
          </div>

          {/* Heatmap & Goals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NexusPanel variant="neutral" className="md:col-span-2 min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800/80">
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">Time Spent in Chamber Trials</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                  Cadet Activity
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center overflow-x-auto">
                <ActivityHeatmap data={activityData} />
              </div>
            </NexusPanel>

            <NexusPanel variant="neutral" className="h-full min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800/80">
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">Current Protocol Goals</h3>
              </div>

              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 font-mono">
                {goals.length === 0 && <div className="text-zinc-500 text-xs">No active chamber goals.</div>}
                {goals.map((goal, i) => (
                  <div
                    key={goal.id || i}
                    onClick={() => toggleGoal(goal)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/40 transition-colors cursor-pointer select-none"
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${goal.is_done ? 'border-cyan-400 bg-cyan-400' : 'border-zinc-600'}`}>
                      {goal.is_done && <Check size={11} className="text-zinc-950 font-bold" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${goal.is_done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{goal.text}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border border-white/5 font-mono ${goal.color || "text-zinc-400 bg-zinc-800"}`}>{goal.tag}</span>
                  </div>
                ))}
              </div>
            </NexusPanel>
          </div>

        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Edit Profile</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Full Name</label>
                <input name="full_name" defaultValue={user?.name || ""} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Bio</label>
                <input name="bio" defaultValue={user?.bio || ""} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input name="email" defaultValue={user?.email || ""} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Location</label>
                <input name="location" defaultValue={user?.location || ""} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-cyan-500 outline-none" />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-bold transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
