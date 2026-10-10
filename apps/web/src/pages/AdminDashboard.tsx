import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Plus,
  Shield,
  Upload,
  Users,
  BarChart3,
  FileCode,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────

interface PlatformStats {
  totalUsers: number;
  totalSubmissions: number;
  totalProblems: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

type CreatePhase = "IDLE" | "SUBMITTING" | "UPLOADING_FILE" | "SUCCESS" | "ERROR";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// ── Component ───────────────────────────────────────────────

export function AdminDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  // ── Platform stats ────────────────────────────────────
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Problem creation form ─────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("EASY");
  const [targetVolume, setTargetVolume] = useState("");
  const [tolerance, setTolerance] = useState("0.1");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<CreatePhase>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [editProblemId, setEditProblemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Access guard ──────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) {
      navigate("/problems");
    }
  }, [isAdmin, navigate]);

  // ── Fetch stats + users ───────────────────────────────
  useEffect(() => {
    if (!token || !isAdmin) return;

    Promise.all([
      fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_BASE}/problems`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([statsData, usersData, problemsData]) => {
        setStats(statsData);
        setUsers(usersData);
        setProblems(problemsData);
        setLoadingStats(false);
      })
      .catch((err) => {
        console.error("Failed to fetch admin data:", err);
        setLoadingStats(false);
      });
  }, [token, isAdmin]);

  // ── Update role handler ───────────────────────────────
  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    if (!token || user?.role !== "OWNER") return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to update role");
      }
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to update user role");
    }
  }, [token, user?.role]);

  // ── Create problem handler ────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!title.trim() || !description.trim() || !file || !targetVolume) {
      setError("All fields are required.");
      setPhase("ERROR");
      return;
    }

    setError(null);
    setPhase("SUBMITTING");

    try {
      if (editProblemId) {
        // Edit mode
        const res = await fetch(`${API_BASE}/admin/problems/${editProblemId}/edit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            difficulty,
            targetVolume: parseFloat(targetVolume),
            tolerance: parseFloat(tolerance),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as any).message || `Failed to update (HTTP ${res.status})`);
        }
        
        const { problem } = await res.json();
        setProblems(prev => prev.map(p => p.id === problem.id ? problem : p));
        setPhase("SUCCESS");
        return;
      }

      // Step 1: Create problem + get presigned URL
      const res = await fetch(`${API_BASE}/admin/problems`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          difficulty,
          targetVolume: parseFloat(targetVolume),
          tolerance: parseFloat(tolerance),
          filename: file.name,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || `Failed (HTTP ${res.status})`);
      }

      const { uploadUrl } = await res.json();

      // Step 2: Upload golden file directly to R2
      setPhase("UPLOADING_FILE");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`File upload failed (HTTP ${uploadRes.status})`);
      }

      setPhase("SUCCESS");
      // Reset form
      setTitle("");
      setDescription("");
      setDifficulty("EASY");
      setTargetVolume("");
      setTolerance("0.1");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create problem");
      setPhase("ERROR");
    }
  }, [title, description, difficulty, targetVolume, tolerance, file, token]);

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-brand-forest" />
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              Admin Dashboard
            </h1>
          </div>
          <p className="text-text-muted">
            Platform management and problem creation.
          </p>
        </div>
        <button
          onClick={() => { 
            setEditProblemId(null);
            setTitle("");
            setDescription("");
            setDifficulty("EASY");
            setTargetVolume("");
            setTolerance("0.1");
            setFile(null);
            setShowForm(!showForm); 
            setPhase("IDLE"); 
            setError(null); 
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          New Problem
        </button>
      </div>

      {/* ── Stats Cards ────────────────────────────────── */}
      {loadingStats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 text-brand-mint animate-spin" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="panel p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wide">Total Users</span>
            </div>
            <p className="text-2xl font-mono font-bold text-text-primary">{stats.totalUsers}</p>
          </div>
          <div className="panel p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wide">Total Submissions</span>
            </div>
            <p className="text-2xl font-mono font-bold text-text-primary">{stats.totalSubmissions}</p>
          </div>
          <div className="panel p-5">
            <div className="flex items-center gap-2 text-text-muted mb-2">
              <FileCode className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wide">Total Problems</span>
            </div>
            <p className="text-2xl font-mono font-bold text-text-primary">{stats.totalProblems}</p>
          </div>
        </div>
      ) : null}

      {/* ── Create Problem Form ────────────────────────── */}
      {showForm && (
        <div className="panel mb-8 p-6 animate-fade-in">
          <h2 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-forest" />
            {editProblemId ? "Edit Problem" : "Create New Problem"}
          </h2>

          {phase === "SUCCESS" ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full p-4 bg-brand-mint/20 border border-brand-mint">
                <CheckCircle2 className="h-6 w-6 text-brand-mint-dark" />
              </div>
              <p className="text-lg font-medium text-text-primary">
                {editProblemId ? "Problem Updated!" : "Problem Created!"}
              </p>
              <p className="text-sm text-text-muted">
                {editProblemId ? "The problem details have been updated." : "The golden file has been uploaded and the problem is live."}
              </p>
              <button
                onClick={() => { setShowForm(false); setPhase("IDLE"); }}
                className="btn-primary mt-2"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Calibration Cube (20mm)"
                  className="w-full px-4 py-2.5 bg-surface-subtle border border-border rounded-lg text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-brand-forest/50 focus:border-brand-forest transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Description (Markdown)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Full problem description in Markdown..."
                  rows={6}
                  className="w-full px-4 py-2.5 bg-surface-subtle border border-border rounded-lg text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-brand-forest/50 focus:border-brand-forest transition-colors font-mono resize-y"
                />
              </div>

              {/* Difficulty + Volume + Tolerance row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-subtle border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-forest/50 focus:border-brand-forest transition-colors"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Target Volume (mm³)
                  </label>
                  <input
                    type="number"
                    value={targetVolume}
                    onChange={(e) => setTargetVolume(e.target.value)}
                    placeholder="8000"
                    className="w-full px-4 py-2.5 bg-surface-subtle border border-border rounded-lg text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-brand-forest/50 focus:border-brand-forest transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Tolerance (ratio)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tolerance}
                    onChange={(e) => setTolerance(e.target.value)}
                    placeholder="0.1"
                    className="w-full px-4 py-2.5 bg-surface-subtle border border-border rounded-lg text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-brand-forest/50 focus:border-brand-forest transition-colors font-mono"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Golden STEP File
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-3 bg-surface-subtle border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-brand-forest/50 transition-colors"
                >
                  <Upload className="h-4 w-4 text-text-muted" />
                  <span className="text-sm text-text-muted">
                    {file ? (
                      <span className="text-text-primary font-mono">{file.name}</span>
                    ) : (
                      "Click to select .step/.stp file"
                    )}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".step,.stp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                </div>
              </div>

              {/* Error */}
              {phase === "ERROR" && error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleCreate}
                disabled={phase === "SUBMITTING" || (phase === "UPLOADING_FILE" && !editProblemId)}
                className="btn-primary w-full"
              >
                {phase === "SUBMITTING" || phase === "UPLOADING_FILE" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {phase === "SUBMITTING" ? (editProblemId ? "Updating problem..." : "Creating problem...") : "Uploading golden file..."}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {editProblemId ? "Update Problem" : "Create Problem"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Users Table ────────────────────────────────── */}
        <div className="panel h-fit p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-forest" />
          Registered Users
        </h2>

        {users.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-surface-subtle/50 transition-colors">
                    <td className="py-3 px-4 text-text-primary font-medium">{u.name}</td>
                    <td className="py-3 px-4 text-text-muted font-mono text-xs">{u.email}</td>
                    <td className="py-3 px-4">
                      {user?.role === "OWNER" && u.role !== "OWNER" ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-surface-subtle border border-border text-xs rounded px-2 py-1 outline-none cursor-pointer focus:border-brand-forest transition-colors"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset ${
                          u.role === "OWNER"
                            ? "text-purple-400 bg-purple-400/10 ring-purple-400/20"
                            : u.role === "ADMIN"
                              ? "text-blue-400 bg-blue-400/10 ring-blue-400/20"
                              : "text-gray-400 bg-gray-400/10 ring-gray-400/20"
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-muted text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Problems Table ─────────────────────────────── */}
      <div className="panel h-fit p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <FileCode className="h-4 w-4 text-brand-forest" />
          Manage Problems
        </h2>

        {problems.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No problems found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Difficulty</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-surface-subtle/50 transition-colors">
                    <td className="py-3 px-4 text-text-primary font-medium">{p.title}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded ring-1 ring-inset text-gray-500 bg-gray-50 ring-gray-200">
                        {p.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button 
                        className="text-xs text-brand-forest hover:underline font-semibold"
                        onClick={() => {
                          setEditProblemId(p.id);
                          setTitle(p.title);
                          setDescription(p.description);
                          setDifficulty(p.difficulty);
                          setTargetVolume(p.targetVolume.toString());
                          setTolerance(p.tolerance.toString());
                          setFile(null);
                          setShowForm(true);
                          setPhase("IDLE");
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
