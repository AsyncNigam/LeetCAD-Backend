import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { AuthCard } from "./components/AuthCard";
import { ProblemList } from "./pages/ProblemList";
import { ProblemWorkspace } from "./pages/ProblemWorkspace";
import { useRealtimeAssessment } from "./hooks/useRealtimeAssessment";
import { AdminDashboard } from "./pages/AdminDashboard";
import { SubmissionsHistory } from "./pages/SubmissionsHistory";
import { Leaderboard } from "./pages/Leaderboard";

function AppContent() {
  const { isAuthenticated, token } = useAuth();
  
  // We can pass token to connection logic to get global status
  const { connectionStatus } = useRealtimeAssessment(token, null);

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col">
      <Navbar connectionStatus={connectionStatus} />

      <main className="flex-1 flex flex-col">
        {!isAuthenticated ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <AuthCard />
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/problems" replace />} />
            <Route path="/problems" element={<ProblemList />} />
            <Route path="/problems/:slug" element={<ProblemWorkspace />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/submissions" element={<SubmissionsHistory />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<Navigate to="/problems" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
