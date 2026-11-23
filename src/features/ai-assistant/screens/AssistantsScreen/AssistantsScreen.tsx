"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAssistantContext } from "@/context/AssistantContext";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import {
  Plus,
  Filter,
  Bot,
  Zap,
  Calendar,
  Edit,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function Page() {
  const router = useRouter();
  const { assistants, loading, error, deleteAssistant } = useAssistantContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Test Assistant Connection
  const handleTestConnection = async (assistant: any) => {
    try {
      setTestingId(assistant.id);
      await soft7AxiosInstance.post("/admin/ai-assistant/test-connection", {
        provider: assistant.provider,
        model: assistant.model,
        apiKey: assistant.apiKey || "",
        assistantId: assistant.id,
      });
      toast.success(`Connection test successful for "${assistant.name}"!`);
    } catch (error: any) {
      console.error("Test connection error:", error);
      toast.error(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          "Connection test failed."
      );
    } finally {
      setTestingId(null);
    }
  };

  // Delete Assistant
  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this assistant?")) {
      try {
        await deleteAssistant(id);
        toast.success("Assistant deleted successfully!");
      } catch (error) {
        console.error("Error deleting assistant:", error);
        toast.error("Failed to delete assistant. Please try again.");
      }
    }
  };

  // Edit Assistant
  const handleEdit = (id: number) => {
    router.push(`/user/ai-assistant/edit/${id}`);
  };

  // Create New Assistant
  const handleCreate = () => {
    router.push("/user/ai-assistant/new");
  };

  // Filter + Search
  const filteredAssistants = assistants.filter((assistant) => {
    const matchesSearch =
      assistant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assistant.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || assistant.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Get unique roles dynamically
  const roles = ["all", ...new Set(assistants.map((a) => a.role))];

  if (loading && assistants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-border border-t-[var(--color-primary)]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-[var(--color-primary)]/20 animate-pulse"></div>
            </div>
          </div>
          <p className="mt-4 text-lg font-display font-semibold text-foreground">Loading assistants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header section */}
      <div className="bg-card border-b border-border sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                AI Assistants
              </h1>
              <p className="text-muted-foreground text-xs mt-0.5">
                Manage and configure your custom AI assistants and agent roles
              </p>
            </div>

            <button 
              onClick={handleCreate} 
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-lg font-semibold text-xs shadow-xs transition h-8"
            >
              <Plus size={14} /> Create AI Assistant
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-error-bg dark:bg-error-bg/20 border border-error-border dark:border-error-border text-error dark:text-error p-4 rounded-xl mb-6 text-sm flex items-center shadow-xs">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Total Assistants */}
          <div className="animate-fade-in-up bg-card rounded-2xl shadow-xs border border-border p-6" style={{ animationDelay: '0.1s' }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Assistants</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <h2 className="text-3xl font-display font-bold text-foreground">{assistants.length}</h2>
                </div>
              </div>
              <div className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center shadow-xs">
                <Bot className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </div>

          {/* Active Assistants */}
          <div className="animate-fade-in-up bg-card rounded-2xl shadow-xs border border-border p-6" style={{ animationDelay: '0.2s' }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Active Assistants</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <h2 className="text-3xl font-display font-bold text-foreground">
                    {assistants.filter((a) => a.status.toLowerCase() === "active").length}
                  </h2>
                </div>
              </div>
              <div className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center shadow-xs">
                <Zap className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>

          {/* Recently Created */}
          <div className="animate-fade-in-up bg-card rounded-2xl shadow-xs border border-border p-6" style={{ animationDelay: '0.3s' }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Recently Created (7d)</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <h2 className="text-3xl font-display font-bold text-foreground">
                    {
                      assistants.filter((a) => {
                        const daysDiff = Math.floor(
                          (Date.now() - new Date(a.createdAt).getTime()) /
                            (1000 * 60 * 60 * 24)
                        );
                        return daysDiff <= 7;
                      }).length
                    }
                  </h2>
                </div>
              </div>
              <div className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center shadow-xs">
                <Calendar className="w-5 h-5 text-success" />
              </div>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          
          {/* Toolbar */}
          <div className="p-3.5 border-b border-border bg-card flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide">All Assistants</h2>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search assistants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring transition h-8"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full sm:w-auto pl-8 pr-7 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-border focus:ring-1 focus:ring-ring appearance-none cursor-pointer h-8"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role === "all" ? "All Roles" : role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/70 border-b border-border text-[11px] uppercase tracking-wider text-foreground/80 dark:text-muted-foreground font-semibold">
                  <th className="py-3 px-5">Assistant</th>
                  <th className="py-3 px-5">Role</th>
                  <th className="py-3 px-5">Model</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Created</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssistants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Bot className="w-12 h-12 mb-3 text-muted-foreground opacity-50" />
                        <p className="font-medium text-foreground">No assistants found</p>
                        <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssistants.map((assistant) => (
                    <tr key={assistant.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-foreground" />
                          </div>
                          <span className="font-semibold text-xs text-foreground">{assistant.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted border border-border text-foreground">
                          {assistant.role}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <div className="text-xs text-foreground font-medium">{assistant.model}</div>
                        <div className="text-[10px] text-muted-foreground">{assistant.provider}</div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                          assistant.status.toLowerCase() === 'active'
                            ? 'bg-primary/10 text-[var(--color-primary-dark)] dark:text-[var(--color-primary)] border-[var(--color-primary)]/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {assistant.status.charAt(0).toUpperCase() + assistant.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-xs text-muted-foreground">
                        {new Date(assistant.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleTestConnection(assistant)}
                            disabled={testingId === assistant.id}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Test Connection"
                          >
                            {testingId === assistant.id ? (
                              <Loader2 size={14} className="animate-spin text-primary" />
                            ) : (
                              <Zap size={14} className="text-primary" />
                            )}
                            <span>Test</span>
                          </button>
                          <button
                            onClick={() => handleEdit(assistant.id)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(assistant.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}