import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Briefcase, MapPin, DollarSign, Clock, Star, Users, TrendingUp, Calendar, Target, Award, ExternalLink } from "lucide-react";
import TopBar from "../components/TopBar";
import { ParticleCard } from "../components/MagicBento";

// Keep static mock data for Interviews/Offers/Stats for UI completeness (as requested only Job Matches to be scraped)
const upcomingInterviews = [
  {
    company: "TechCorp Solutions",
    position: "Senior Full Stack Developer",
    date: "Jan 15, 2025",
    time: "2:00 PM PST",
    type: "Technical Interview",
    status: "confirmed",
    interviewer: "Sarah Johnson, CTO"
  },
  {
    company: "InnovateLabs",
    position: "Frontend Developer",
    date: "Jan 18, 2025",
    time: "10:00 AM PST",
    type: "Culture Fit Interview",
    status: "pending",
    interviewer: "Mike Chen, Head of Engineering"
  }
];

const jobOffers = [
  {
    company: "TechCorp Solutions",
    position: "Senior Full Stack Developer",
    salary: "$135,000",
    benefits: ["Health Insurance", "401k Match", "Remote Work", "Stock Options"],
    deadline: "Jan 20, 2025",
    status: "pending"
  }
];

export default function JobHub() {
  const [jobMatches, setJobMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    fetch("http://localhost:8000/job-matches", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setJobMatches(data.jobs || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch jobs", err);
        setLoading(false);
      });
  }, []);

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
            <h1 className="text-3xl font-bold text-white mb-2">Job Hub</h1>
            <p className="text-gray-400">AI-powered job matching based on your resume analysis</p>
          </motion.div>

          {/* Stats Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Target size={20} className="text-green-400" />
                <span className="text-sm text-gray-400">Job Matches</span>
              </div>
              <div className="text-2xl font-bold text-white">{jobMatches.length}</div>
              <div className="text-xs text-green-400">Personalized</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={20} className="text-blue-400" />
                <span className="text-sm text-gray-400">Interviews</span>
              </div>
              <div className="text-2xl font-bold text-white">2</div>
              <div className="text-xs text-blue-400">Scheduled</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Award size={20} className="text-purple-400" />
                <span className="text-sm text-gray-400">Offers</span>
              </div>
              <div className="text-2xl font-bold text-white">1</div>
              <div className="text-xs text-purple-400">Pending review</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm rounded-lg p-4 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={20} className="text-orange-400" />
                <span className="text-sm text-gray-400">Profile Views</span>
              </div>
              <div className="text-2xl font-bold text-white">156</div>
              <div className="text-xs text-orange-400">↑ 23% this month</div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Matches */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 mb-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Briefcase size={20} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Job Matches</h2>
                </div>

                {loading ? (
                  <div className="text-center py-10 text-gray-400">Analyzing market trends...</div>
                ) : jobMatches.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">Upload a resume to get job matches!</div>
                ) : (
                  <div className="space-y-4">
                    {jobMatches.map((job, index) => (
                      <a
                        key={index}
                        href={job.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * index }}
                        >
                          <ParticleCard
                            className="bg-gradient-to-r from-slate-800/40 to-slate-900/40 rounded-xl p-6 border border-slate-700/50 hover:border-green-500/50 transition-all duration-300 group cursor-pointer relative"
                            glowColor="34, 197, 94"
                          >
                            <div className="absolute top-4 right-4 text-gray-600 group-hover:text-green-400 transition-colors z-[101]">
                              <ExternalLink size={16} />
                            </div>

                            <div className="flex items-start justify-between mb-3 pr-8 relative z-[101]">
                              <div className="flex items-start gap-3">
                                <div className="text-2xl">{job.logo || "💼"}</div>
                                <div>
                                  <h3 className="font-semibold text-white group-hover:text-green-400 transition-colors">
                                    {job.title}
                                  </h3>
                                  <p className="text-sm text-gray-400">{job.company}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-bold px-2 py-1 rounded ${job.match_score >= 90 ? 'bg-green-500/20 text-green-400' :
                                  job.match_score >= 80 ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-orange-500/20 text-orange-400'
                                  }`}>
                                  {job.match_score}% Match
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-400 mb-3 relative z-[101]">
                              <div className="flex items-center gap-1">
                                <MapPin size={14} />
                                {job.location}
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign size={14} />
                                {job.salary}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                {job.type}
                              </div>
                            </div>

                            <p className="text-sm text-gray-300 mb-3 line-clamp-2 relative z-[101]">
                              {job.description}
                            </p>

                            <div className="flex items-center justify-between relative z-[101]">
                              <div className="flex flex-wrap gap-1">
                                {job.skills && job.skills.map((skill) => (
                                  <span
                                    key={skill}
                                    className="px-2 py-1 bg-slate-600/50 rounded text-xs text-gray-300"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                              <div className="text-right text-xs text-gray-500">
                                <div>{job.posted}</div>
                                <div>{job.applicants} applicants</div>
                              </div>
                            </div>
                          </ParticleCard>
                        </motion.div>
                      </a>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Interviews */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                    <Calendar size={16} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Upcoming Interviews</h3>
                </div>

                <div className="space-y-3">
                  {upcomingInterviews.map((interview, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-slate-700/30 to-slate-800/30 rounded-lg p-3 border border-slate-600/30"
                    >
                      <h4 className="font-semibold text-white text-sm">{interview.company}</h4>
                      <p className="text-xs text-gray-400 mb-2">{interview.position}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>{interview.date} at {interview.time}</div>
                        <div>{interview.type}</div>
                        <div className={`inline-block px-2 py-1 rounded text-xs ${interview.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                          {interview.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Job Offers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                    <Award size={16} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Job Offers</h3>
                </div>

                <div className="space-y-3">
                  {jobOffers.map((offer, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-slate-700/30 to-slate-800/30 rounded-lg p-3 border border-slate-600/30"
                    >
                      <h4 className="font-semibold text-white text-sm">{offer.company}</h4>
                      <p className="text-xs text-gray-400 mb-2">{offer.position}</p>
                      <div className="text-sm font-bold text-green-400 mb-2">{offer.salary}</div>
                      <div className="space-y-1 mb-2">
                        {offer.benefits.map((benefit) => (
                          <div key={benefit} className="text-xs text-gray-500 flex items-center gap-1">
                            <Star size={10} className="text-yellow-400" />
                            {benefit}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-orange-400">Respond by {offer.deadline}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}