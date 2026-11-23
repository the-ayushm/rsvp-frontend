/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { soft7AxiosInstance } from "@/lib/axiosInstance";
import React, { createContext, useContext, useEffect, useState } from "react";

// ✅ Updated: id is now a number (not string)
interface Assistant {

  id: number;
  
  name: string;
  role: string;
  status: string;
  promptType: string;
  predefinedPrompt?: string;
  customPrompt?: string;
  provider: string;
  model: string;
  apiKey?: string;
  createdAt: string;
  updatedAt: string;
}

interface AssistantContextType {
  assistants: Assistant[];
  loading: boolean;
  error: string | null;
  fetchAssistants: () => Promise<void>;
  addAssistant: (
    assistant: Omit<Assistant, "id" | "createdAt" | "updatedAt"> | FormData,
  ) => Promise<void>;
  deleteAssistant: (id: number) => Promise<void>; // ✅ updated to number
  updateAssistant: (
    id: number,
    assistant: Omit<Assistant, "id" | "createdAt" | "updatedAt"> | FormData,
  ) => Promise<void>;
}

const AssistantContext = createContext<AssistantContextType | undefined>(
  undefined,
);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fetch all assistants from API
  const fetchAssistants = async () => {
    try {
      setLoading(true);
      const res = await soft7AxiosInstance.get("/admin/ai-assistant");
      const responseData = res.data;
      setAssistants(responseData.data || []);
    } catch (err: any) {
      console.error("Fetch Assistants Error:", err);
      setError(err.message || "Error fetching assistants");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Add new assistant to database via API
  const addAssistant = async (
    assistant: Omit<Assistant, "id" | "createdAt" | "updatedAt"> | FormData,
  ) => {
    try {
      const response = await soft7AxiosInstance.post("/admin/ai-assistant", assistant);
      const newAssistant = response.data.data;
      if (newAssistant) {
        setAssistants((prev) => [...prev, newAssistant]);
      }
    } catch (err: any) {
      console.error("Add Assistant Error:", err);
      setError(err.message || "Error adding assistant");
      throw err;
    }
  };

  // ✅ Delete assistant from database
  const deleteAssistant = async (id: number) => {
    try {
      await soft7AxiosInstance.delete(`/admin/ai-assistant/${id}`);
      setAssistants((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error("Delete Assistant Error:", err);
      setError(err.message || "Error deleting assistant");
    }
  };

  // ✅ Update assistant in database via API
  const updateAssistant = async (
    id: number,
    assistant: Omit<Assistant, "id" | "createdAt" | "updatedAt"> | FormData,
  ) => {
    try {
      const response = await soft7AxiosInstance.put(`/admin/ai-assistant/${id}`, assistant);
      const updatedAssistant = response.data.data;
      if (updatedAssistant) {
        setAssistants((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...updatedAssistant } : a))
        );
      }
    } catch (err: any) {
      console.error("Update Assistant Error:", err);
      setError(err.message || "Error updating assistant");
      throw err;
    }
  };

  // Fetch assistants on load
  useEffect(() => {
    fetchAssistants();
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        assistants,
        loading,
        error,
        fetchAssistants,
        addAssistant,
        deleteAssistant,
        updateAssistant,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};

// ✅ Custom hook to use the AssistantContext
export const useAssistantContext = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error(
      "useAssistantContext must be used within an AssistantProvider",
    );
  }
  return context;
};
