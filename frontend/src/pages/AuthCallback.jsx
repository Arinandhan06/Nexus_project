import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Terminal, CheckCircle } from "lucide-react";
import api from "../lib/api";

export default function AuthCallback({ onLoginSuccess }) {
  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const executedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Prevent React 18/19 StrictMode double-execution from clearing token
    if (executedRef.current) return;
    executedRef.current = true;

    const processCallback = async () => {
      try {
        const hash = window.location.hash || "";

        // Parse token from fragment (#token=XYZ)
        let token = null;
        if (hash.startsWith("#")) {
          const params = new URLSearchParams(hash.substring(1));
          token = params.get("token");
        }

        // Fallback: check if already in sessionStorage (e.g. from previous tick)
        if (!token) {
          token = sessionStorage.getItem("authToken");
        }

        if (!token) {
          throw new Error("Missing authentication token in OAuth callback URL.");
        }

        // Store token in session storage immediately
        sessionStorage.setItem("authToken", token);

        // Clean the hash cleanly from browser address bar
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }

        // Verify token with backend /me endpoint with explicit Bearer header
        const response = await api.get("/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const user = response.data;

        setStatus("success");

        if (typeof onLoginSuccess === "function") {
          onLoginSuccess(user);
        }

        // Navigate cleanly to / (or /onboarding if false)
        const target = user.onboarding_complete === false ? "/onboarding" : "/";
        setTimeout(() => {
          if (typeof onLoginSuccess === "function") {
            navigate(target, { replace: true });
          } else {
            window.location.replace(target);
          }
        }, 300);
      } catch (err) {
        console.error("Auth callback verification error:", err);
        if (err.response?.status === 401) {
          sessionStorage.removeItem("authToken");
        }
        setStatus("error");
        setErrorMessage(
          err.response?.data?.detail ||
          err.message ||
          "Session handshake failed. Please try authenticating again."
        );
      }
    };

    processCallback();
  }, [navigate, onLoginSuccess]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md bg-zinc-950/90 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <Terminal size={28} />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold tracking-wide bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
          NEXUS HANDSHAKE
        </h2>

        {status === "verifying" && (
          <div className="mt-6 space-y-4">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-mono text-zinc-400">
              Validating cryptographic credentials...
            </p>
          </div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 space-y-3"
          >
            <CheckCircle size={32} className="text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-300">
              Access Granted. Entering NEXUS...
            </p>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs sm:text-sm text-left flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200">Handshake Rejected</p>
                <p className="mt-1 text-red-300/90">{errorMessage}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/login"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-xs tracking-wider uppercase bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors"
              >
                <RefreshCw size={14} />
                Retry Authentication
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
