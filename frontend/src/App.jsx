import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import LoginSignup from "./pages/LoginSignup";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Safehouse from "./pages/Safehouse";
import Chambers from "./pages/Chambers";
import Matrix from "./pages/Matrix";
import UploadResume from "./pages/UploadResume";
import Profile from "./pages/Profile";
import api from "./lib/api";

function AuthenticatedApp({ currentUser, onLogout, onOnboardingComplete }) {
  const location = useLocation();

  if (!currentUser?.onboarding_complete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-gray-200 relative">
      {/* Global Background Layer */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('/background.jpg')] bg-cover bg-center bg-no-repeat" />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 flex h-full w-full">
        <Sidebar onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto relative" role="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/safehouse" element={<Safehouse />} />
            <Route path="/chambers" element={<Chambers />} />
            <Route path="/matrix" element={<Matrix currentUser={currentUser} />} />
            <Route path="/profile" element={<Profile currentUser={currentUser} />} />
            <Route path="/onboarding" element={<UploadResume onOnboardingComplete={onOnboardingComplete} />} />
            <Route path="/upload-resume" element={<Navigate to="/onboarding" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") {
      return false;
    }
    return Boolean(sessionStorage.getItem("authToken"));
  });

  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      setAuthChecking(false);
      return;
    }

    const token = sessionStorage.getItem("authToken");
    if (!token) {
      setCurrentUser(null);
      setAuthChecking(false);
      return;
    }

    let ignore = false;
    api
      .get("/me")
      .then((res) => {
        if (!ignore) {
          setCurrentUser(res.data);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.warn("Session check rejected:", err?.message);
          sessionStorage.removeItem("authToken");
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setAuthChecking(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setAuthChecking(false);
  };

  // Activity Tracking
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

  const handleOnboardingComplete = () => {
    setCurrentUser((prev) => (prev ? { ...prev, onboarding_complete: true } : prev));
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout error:", err.message);
    } finally {
      sessionStorage.clear();
      setCurrentUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <Router>
      <Routes>
        {/* OAuth Callback route always accessible */}
        <Route path="/auth/callback" element={<AuthCallback onLoginSuccess={handleAuthSuccess} />} />

        {/* Public Login Route */}
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <LoginSignup />
            )
          }
        />

        {/* Protected Application Routes */}
        <Route
          path="/*"
          element={
            authChecking ? (
              <div className="min-h-screen w-full flex items-center justify-center bg-black text-emerald-400 font-mono">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs tracking-widest uppercase">Connecting to NEXUS Core...</p>
                </div>
              </div>
            ) : currentUser ? (
              <AuthenticatedApp
                currentUser={currentUser}
                onLogout={handleLogout}
                onOnboardingComplete={handleOnboardingComplete}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}
