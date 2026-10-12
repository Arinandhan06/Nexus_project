import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Briefcase,
  Terminal,
  Shield,
  Cpu,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import api from "../lib/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const PROGRESS_STAGES = [
  "Transmitting quantum dossier to NEXUS Core...",
  "NEXUS is reading your dossier...",
  "Deconstructing codebase competencies & parsing skill tree...",
  "Synthesizing 30-Day Chamber schedule & adversarial weaknesses..."
];

export default function UploadResume({ onOnboardingComplete }) {
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Progress message cycler during upload
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setStageIndex((prev) => (prev + 1) % PROGRESS_STAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return;

    const name = selectedFile.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isDocx = name.endsWith(".docx");

    if (!isPdf && !isDocx) {
      setError("Invalid file format. NEXUS accepts PDF (.pdf) and Word (.docx) dossiers only.");
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File size (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5MB limit. Please upload a smaller dossier.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select or drop a valid PDF or DOCX dossier first.");
      return;
    }

    setStageIndex(0);
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_role", targetRole || "Software Engineer");

    try {
      const response = await api.post("/resume/analyze", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess(true);

      if (typeof onOnboardingComplete === "function") {
        onOnboardingComplete(response.data);
      }

      // Transition smoothly into /matrix
      setTimeout(() => {
        navigate("/matrix", { replace: true });
      }, 1200);
    } catch (err) {
      console.error("Dossier analysis error:", err);
      let detail = err.response?.data?.detail;
      if (err.response?.status === 413) {
        detail = "File size exceeds 5MB limit. Please provide a condensed dossier.";
      } else if (err.response?.status === 415) {
        detail = detail || "Unsupported or corrupted document format. Only valid PDF and DOCX files are allowed.";
      }
      setError(detail || err.message || "Failed to analyze resume dossier. Please verify the document and retry.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black/90 text-white px-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-2xl bg-zinc-950/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-[0_0_60px_rgba(16,185,129,0.15)] backdrop-blur-xl"
      >
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 mb-4 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
            <Terminal size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            CADET DOSSIER INGESTION
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-mono">
            [PROTOCOL // ONBOARDING CALIBRATION]
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            NEXUS will parse your technical skills, construct your initial Matrix, and schedule your 30-day Chamber trials.
          </p>
        </div>

        {/* Target Role Input */}
        <div className="mb-6">
          <label className="block text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-2">
            <Briefcase size={14} />
            <span>Target Role Designation</span>
          </label>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            disabled={loading || success}
            placeholder="e.g. Full Stack Engineer, Systems Programmer"
            className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-emerald-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all font-mono"
          />
        </div>

        {/* Drag-and-Drop Dropzone */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? "border-emerald-400 bg-emerald-950/30 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.01]"
                : "border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/40 hover:bg-zinc-900/70"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 mb-4">
              <Upload size={26} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-200 mb-1">
              Drop candidate dossier here, or <span className="text-emerald-400 underline underline-offset-4">browse files</span>
            </h3>
            <p className="text-xs text-zinc-500 font-mono mt-2">
              Supported Formats: PDF (.pdf) or Word (.docx) • Max size: 5 MB
            </p>
          </div>
        ) : (
          /* Selected File Card */
          <div className="bg-zinc-900/80 border border-emerald-500/40 rounded-2xl p-5 mb-6 flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                <FileText size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-200 truncate font-mono">
                  {file.name}
                </p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {formatFileSize(file.size)} • {file.name.endsWith(".docx") ? "Word Document" : "PDF Document"}
                </p>
              </div>
            </div>
            {!loading && !success && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                aria-label="Remove file"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs sm:text-sm flex items-start gap-3"
            >
              <AlertCircle size={20} className="shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-200">Dossier Calibration Rejection</p>
                <p className="mt-1 text-red-300/90 font-mono text-xs">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="mt-2 text-xs font-semibold underline hover:text-red-100 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Dismiss & Re-select
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Progress State with Progressive Messages */}
        <AnimatePresence>
          {loading && !success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 p-6 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 text-center space-y-4"
            >
              <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-300 font-mono tracking-wide">
                  {PROGRESS_STAGES[stageIndex]}
                </p>
                <p className="text-xs text-zinc-500 font-mono">
                  Calibrating adversarial chambers... Do not refresh.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Confirmation */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 rounded-2xl bg-emerald-950/50 border border-emerald-500/60 text-center space-y-2 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle size={36} className="text-emerald-400 mx-auto" />
              <p className="text-base font-bold text-emerald-300">
                Calibration Complete
              </p>
              <p className="text-xs font-mono text-emerald-400/80">
                Entering Job-Readiness Matrix & 30-Day Chamber Schedule...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Action Button */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!file || loading || success}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold text-sm tracking-wide bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950 font-mono uppercase"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Calibrating Matrix...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle size={20} />
                <span>Matrix Initialized</span>
              </>
            ) : (
              <>
                <Cpu size={20} />
                <span>Initialize Calibration</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Footer Security Notice */}
        <div className="mt-6 text-center text-[11px] text-zinc-600 font-mono">
          NEXUS Dossier Protocol • Untrusted input sanitization active • Strict Pydantic parsing
        </div>
      </motion.div>
    </div>
  );
}
