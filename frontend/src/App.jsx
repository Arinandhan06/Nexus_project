import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import LoginSignup from "./pages/LoginSignup";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Safehouse from "./pages/Safehouse";
import Chambers from "./pages/Chambers";
import Matrix from "./pages/Matrix";
import Profile from "./pages/Profile";
import api from "./lib/api";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Validate session against /me
  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const token = sessionStorage.getItem("authToken");
      if (!token) {
        if (active) {
          setCurrentUser(null);
          setAuthChecking(false);
        }
        return;
      }

      try {
        const response = await api.get("/me");
        if (active) {
          setCurrentUser(response.data);
          setAuthChecking(false);
        }
      } catch (err) {
        if (active) {
          console.warn("Session check failed (401 or invalid token):", err.message);
          sessionStorage.removeItem("authToken");
          setCurrentUser(null);
          setAuthChecking(false);
        }
      }
    };

    verifySession();
    return () => {
      active = false;
    };
  }, []);

  // Activity Tracking Logic
  const activityTimerRef = useRef(0);

  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      activityTimerRef.current += 1;
      if (activityTimerRef.current >= 10) {
        const today = new Date().toISOString().split("T")[0];
        api
          .post("/profile/activity", {
            date: today,
            hours: 0.17,
            level: 2,
          })
          .catch((err) => console.error("Tracking error:", err));

        activityTimerRef.current = 0;
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout error:", err.message);
    } finally {
      sessionStorage.clear();
      setCurrentUser(null);
      window.location.href = "/";
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black text-emerald-400 font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs tracking-widest uppercase">Connecting to NEXUS Core...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* OAuth Callback route must always be reachable */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Public or Protected tree */}
        {!currentUser ? (
          <>
            <Route path="/login" element={<LoginSignup />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route
            path="*"
            element={
              <div className="flex h-screen overflow-hidden bg-transparent text-gray-200 relative">
                {/* Global Background Layer */}
                <div className="fixed inset-0 z-0">
                  <div className="absolute inset-0 bg-[url('/background.jpg')] bg-cover bg-center bg-no-repeat" />
                  <div className="absolute inset-0 bg-black/60" />
                </div>

                <div className="relative z-10 flex h-full w-full">
                  <Sidebar onLogout={handleLogout} />
                  <main className="flex-1 overflow-y-auto relative" role="main">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/safehouse" element={<Safehouse />} />
                      <Route path="/chambers" element={<Chambers />} />
                      <Route path="/matrix" element={<Matrix />} />
                      <Route path="/profile" element={<Profile currentUser={currentUser} />} />
                      <Route path="/onboarding" element={<Navigate to="/" replace />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            }
          />
        )}
      </Routes>
    </Router>
  );
}
