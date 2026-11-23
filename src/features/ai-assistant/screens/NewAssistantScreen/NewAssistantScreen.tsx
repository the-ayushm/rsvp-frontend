/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Upload, X, FileText, ArrowLeft, Settings, BookOpen, Bot, Zap, Key } from "lucide-react";
import { useAssistantContext } from "@/context/AssistantContext";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { toast } from "react-hot-toast";

export default function NewAIAssistantPage() {
  const router = useRouter();
  const { assistants, addAssistant } = useAssistantContext();

  const [activeTab, setActiveTab] = useState("settings");
  const [assistantName, setAssistantName] = useState("");
  const [promptMode, setPromptMode] = useState("predefined");
  const [agentRole, setAgentRole] = useState("Customer Support Agent");
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiProvider, setAiProvider] = useState("OpenAI");
  const [model, setModel] = useState("GPT-4o");
  const [apiKey, setApiKey] = useState("");
  const [knowledgeFiles, setKnowledgeFiles] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);

  const agentRoles = [
    "Customer Support Agent",
    "Coding Assistant",
    "Sales Assistant",
    "General Assistant",
  ];

  const aiProviders: Record<string, string[]> = {
    OpenAI: ["GPT-4o", "GPT-4o mini"],
    "Gemini AI": ["Gemini 1.5 Flash", "Gemini 1.5 Pro"],
    "Copilot AI": ["Copilot Standard", "Copilot Pro"],
  };

  // -------------------------------
  
  // 🧩 Drag & Drop File Handlers
  // -------------------------------
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = [...e.dataTransfer.files];
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles([...e.target.files]);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      const isValidType =
        file.name.endsWith(".txt") ||
        file.name.endsWith(".pdf") ||
        file.name.endsWith(".doc") ||
        file.name.endsWith(".docx") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".xlsx");
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      return isValidType && isValidSize;
    });

    const newFiles = validFiles.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size:
        file.size < 1024
          ? file.size + " B"
          : file.size < 1048576
          ? (file.size / 1024).toFixed(2) + " KB"
          : (file.size / 1048576).toFixed(2) + " MB",
      type: file.name.split(".").pop()?.toUpperCase() || "FILE",
      file: file, // Store the actual file object
    }));

    setKnowledgeFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: number) => {
    setKnowledgeFiles(knowledgeFiles.filter((file) => file.id !== id));
  };

  // -------------------------------
  // 💾 Save Assistant (POST /api/user/ai-assistant)
  // -------------------------------
  const handleSave = async () => {
    if (!assistantName.trim()) {
      toast.error("Please enter an assistant name");
      return;
    }

    const nameExists = assistants.some(
      (a) => a.name.toLowerCase() === assistantName.trim().toLowerCase()
    );

    if (nameExists) {
      toast.error("An assistant with this name already exists");
      return;''
    }

    try {
      setLoading(true);

      const payload: any = {
        name: assistantName,
        role: agentRole,
        status: isActive ? "ACTIVE" : "INACTIVE",
        promptType: promptMode,
        provider: aiProvider,
        model: model,
      };

      if (promptMode === "predefined") payload.predefinedPrompt = agentRole;
      if (promptMode === "custom") payload.customPrompt = customPrompt;
      if (apiKey) payload.apiKey = apiKey;

      await addAssistant(payload);

      toast.success("Assistant created successfully!");
      router.push("/user/ai-assistant");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || error?.message || "Something went wrong while saving assistant.");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    setModel(aiProviders[provider][0]);
  };

  // -------------------------------
  // 🔌 Test API Connection
  // -------------------------------
  const handleTestConnection = async () => {
    if (!apiKey) {
      toast.error("Please enter an API Key to test");
      return;
    }
    
    try {
      setTestingConnection(true);
      await soft7AxiosInstance.post("/admin/ai-assistant/test-connection", {
        provider: aiProvider,
        model,
        apiKey
      });
      toast.success("Connection successful! API Key is valid.");
    } catch (error: any) {
      console.error("Test connection error:", error);
      toast.error(error?.response?.data?.error?.message || error?.response?.data?.message || "Connection failed. Invalid API Key.");
    } finally {
      setTestingConnection(false);
    }
  };

  // -------------------------------
  // 🎨 UI Rendering
  // -------------------------------
  return (
    <div className="ai-assistant-page">
      <div className="ai-assistant-content">
      {/* Back to dashboard */}
      <button
        onClick={() => router.push("/user/ai-assistant")}
        className="bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs mb-6 flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h1 className="ai-page-title mb-6">Assistant Configuration</h1>

      {/* Tabs */}
      <div className="tabs-container">
        {["settings"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? "active" : ""}`}
          >
            {tab === "settings" ? (
              <>
                <Settings size={18} />
                Settings
              </>
            ) : (
              <>
                <BookOpen size={18} />
                Knowledge Base
              </>
            )}
          </button>
        ))}
      </div>

      {/* -------------------- SETTINGS TAB -------------------- */}
      {activeTab === "settings" && (
        <div className="space-y-6 w-full">
          {/* Basic Info */}
          <section className="form-section">
            <h2 className="form-section-title flex items-center gap-2">
              <Bot size={20} className="text-primary-text" />
              Basic Information
            </h2>
            <div className="mb-4">
              <label className="form-label">Assistant Name</label>
              <input
                type="text"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="e.g., Customer Support Bot, Coding Assistant..."
                className="form-input"
              />
            </div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <label className="form-label mb-1">Assistant Status</label>
                <p className="text-sm text-muted-foreground">Enable or disable this assistant</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`assistant-status-toggle ${isActive ? 'active' : ''}`}
              >
                <div className="assistant-status-toggle-thumb" />
              </button>
            </div>
          </section>

          {/* Prompt Configuration */}
          <section className="form-section">
            <h2 className="form-section-title flex items-center gap-2">
              <FileText size={20} className="text-primary-text" />
              Prompt Configuration
            </h2>

            <div className="prompt-mode-toggle">
              {["predefined", "custom"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPromptMode(mode)}
                  className={`prompt-mode-button ${
                    promptMode === mode ? "active" : ""
                  }`}
                >
                  {mode === "predefined" ? "Predefined Prompts" : "Custom Prompt"}
                </button>
              ))}
            </div>

            {promptMode === "predefined" ? (
              <div>
                <label className="form-label">Select Agent Role</label>
                <div className="relative">
                  <select
                    value={agentRole}
                    onChange={(e) => setAgentRole(e.target.value)}
                    className="form-select pr-10"
                  >
                    {agentRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="form-label">Customize Prompt</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="form-textarea"
                  placeholder="Enter your custom system instructions and guidelines for the assistant agent here..."
                />
              </div>
            )}
          </section>

          {/* AI Configuration */}
          <section className="form-section">
            <h2 className="form-section-title flex items-center gap-2">
              <Zap size={20} className="text-primary-text" />
              AI Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Provider */}
              <div>
                <label className="form-label">AI Provider</label>
                <div className="relative">
                  <select
                    value={aiProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="form-select pr-10"
                  >
                    {Object.keys(aiProviders).map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="form-label">Model</label>
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="form-select pr-10"
                  >
                    {aiProviders[aiProvider].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* API Key */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="form-label mb-0 flex items-center gap-2">
                  <Key size={16} />
                  API Key
                </label>
                {aiProvider === "OpenAI" && (
                  <span className="text-xs text-primary-text">
                    * Standard OpenAI keys apply
                  </span>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${aiProvider} API key`}
                className="form-input w-full"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/user/ai-assistant")}
                className="bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-primary text-primary-foreground border border-primary hover:bg-primary-hover shadow-xs"
              >
                {loading ? "Saving..." : "Save Assistant"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* -------------------- KNOWLEDGE TAB -------------------- */}
      {false && activeTab === "knowledge" && (
        <div className="space-y-6 w-full">
          <section className="form-section">
            <h2 className="form-section-title">Upload Knowledge Base Files</h2>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`file-upload-zone ${dragActive ? "drag-active" : ""}`}
            >
              <Upload className="file-upload-icon" />
              <p className="text-foreground mb-2 font-medium">
                Drag and drop files here
              </p>
              <p className="file-upload-subtitle">
                Supports: .txt, .pdf, .doc, .docx, .csv, .xls, .xlsx (Max 5MB)
              </p>
              <label className="file-upload-button">
                Browse Files
                <input
                  type="file"
                  accept=".txt,.pdf,.doc,.docx,.csv,.xls,.xlsx"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </div>
          </section>

          {knowledgeFiles.length > 0 && (
            <section className="form-section">
              <h2 className="form-section-title">
                Uploaded Files ({knowledgeFiles.length})
              </h2>
              <div className="space-y-3">
                {knowledgeFiles.map((file) => (
                  <div
                    key={file.id}
                    className="uploaded-file-item"
                  >
                    <div className="flex items-center gap-4">
                      <div className="uploaded-file-icon-wrapper">
                        <FileText className="w-6 h-6 text-primary-text" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">
                          {file.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {file.size} • {file.type}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-muted-foreground hover:text-[var(--color-error)] transition-colors p-2 hover:bg-[color-mix(in_oklch,var(--color-error)_10%,transparent)] rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      </div>
    </div>
  );
}