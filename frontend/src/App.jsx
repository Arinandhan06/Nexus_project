import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import LoginSignup from "./pages/LoginSignup";
import Dashboard from "./pages/Dashboard";
import Safehouse from "./pages/Safehouse";
import Chambers from "./pages/Chambers";
import Matrix from "./pages/Matrix";
import Profile from "./pages/Profile";
import api from "./lib/api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("authToken") !== null;
  });

  // Activity Tracking Logic
  const activityTimerRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      activityTimerRef.current += 1;

      // Every 10 minutes (tick every 1 min)
      if (activityTimerRef.current >= 10) {
        const today = new Date().toISOString().split("T")[0];

        api
          .post("/profile/activity", {
            date: today,
            hours: 0.17, // roughly 10 mins
            level: 2,
          })
          .catch((err) => console.error("Tracking error:", err));

        // Reset
        activityTimerRef.current = 0;
      }
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setIsAuthenticated(false);
    window.location.href = "/";
  };

  return (
    <Router>
      {!isAuthenticated ? (
        <LoginSignup onLogin={handleLogin} />
      ) : (
        <div className="flex h-screen overflow-hidden bg-transparent text-gray-200 relative">
          {/* Global Background Layer */}
          <div className="fixed inset-0 z-0">
            {/* The Image */}
            <div className="absolute inset-0 bg-[url('/background.jpg')] bg-cover bg-center bg-no-repeat" />
            {/* The Dimming Overlay */}
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
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
    </Router>
  );
}
