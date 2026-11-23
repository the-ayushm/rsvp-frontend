/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronDown, Save, AlertTriangle, CheckCircle, Loader2, X, XCircle, ArrowLeft } from "lucide-react";
import "../../columns.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface MessageBannerProps {
  type: "success" | "error";
  text: string;
  onClose: () => void;
}

/* Polished message banner */
const MessageBanner = ({ type, text, onClose }: MessageBannerProps) => {
  const isSuccess = type === "success";
  
  const bannerStyles = isSuccess
    ? "bg-[var(--color-success-light)] dark:bg-primary-light/20 border-primary-soft dark:border-primary-soft text-[var(--color-success-dark)] dark:text-primary-text"
    : "bg-error-bg dark:bg-error-bg/20 border-error-border dark:border-error-border text-error dark:text-error";
    
  const iconStyles = isSuccess 
    ? "text-primary-text dark:text-[var(--color-primary)]" 
    : "text-error dark:text-error";
    
  const Icon = isSuccess ? CheckCircle : AlertTriangle;

  return (
 
    <div
      role="status"
      className={`p-4 mb-5 border-l-4 rounded-r-xl ${bannerStyles} flex items-start justify-between shadow-sm animate-slideInDown`}
    >
      <div className="flex items-center">
        <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${iconStyles}`} />
        <p className="text-sm font-medium">{text}</p>
      </div>
      <button 
        onClick={onClose} 
        aria-label="Dismiss message" 
        className="text-muted-foreground hover:text-secondary-foreground dark:hover:text-foreground ml-4 transition flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function EditColumn() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
const [form, setForm] = useState<{
  label: string;
  type: string;
  visible: boolean;
}>({
  label: "",
  type: "",
  visible: true,
});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch column data on mount
  useEffect(() => {
    const fetchColumn = async () => {
      if (!id) return;
      
      setIsFetching(true);
      try {
const response = await soft7AxiosInstance.get(
  `/admin/columns/${id}`
);
        const resData = response.data;
        const data = resData?.data || resData;
        
       setForm({
  label: data.label || "",
  type: data.type || "",
  visible:
    data.visible === true ||
    data.visible === "true",
});
      } catch (error) {
        console.error("Error fetching column:", error);
        setMessage({ 
          type: "error", 
          text: `Failed to load column. ${(error as any)?.response?.data?.message || (error as Error).message}` 
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchColumn();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label || !form.type) {
      setMessage({ type: "error", text: "Please fill label and select a data type." });
      return;
    }

    setMessage(null);
    setIsLoading(true);

    try {
     const payload = {
       label: form.label.trim(),
       type: form.type,
       visible: Boolean(form.visible),
     };

     console.log("UPDATE COLUMN ID:", id);
     console.log("UPDATE PAYLOAD:", payload);

     const response = await soft7AxiosInstance.put(
       `/admin/columns/${id}`,
       payload
     );

console.log("UPDATE RESPONSE:", response.data);
      setMessage({ type: "success", text: `Column '${form.label}' updated successfully!` });

      // Redirect back to the columns page after short delay
      setTimeout(() => router.push("/user/manage/columns"), 1200);
    } catch (error) {
      console.error("API Error:", error);
      setMessage({ type: "error", text: `Failed to update column. ${(error as any)?.response?.data?.message || (error as Error).message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel? All unsaved changes will be lost.")) {
      router.push("/user/manage/columns");
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-background dark:bg-muted flex items-center justify-center p-4 sm:p-6">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary-text mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Loading column details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="columns-page flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="bg-card max-w-xl w-full p-6 sm:p-8 rounded-2xl shadow-xl border border-border">
        
        {/* Header Navigation */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => router.back()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground transition font-medium disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-1.5">Edit Data Column</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Update the structure and properties of your custom data field.
        </p>

        {/* Message Banner */}
        {message && <MessageBanner type={message.type} text={message.text} onClose={() => setMessage(null)} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Label Input */}
          <div className="space-y-2">
            <label htmlFor="label" className="block text-sm font-semibold text-foreground dark:text-foreground">
              Column Label
            </label>
            <div className="relative">
              <input
                id="label"
                autoComplete="off"
                placeholder="e.g., Customer Segment, Last Contact Date"
                value={form.label}
                onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                required
                disabled={isLoading}
                className="
                  w-full
                  h-12
                  rounded-xl
                  px-4
                  pr-12
                  text-sm
                  text-foreground
                  bg-surface dark:bg-background
                  border border-border
                  transition focus:ring-2 focus:ring-primary/25 focus:border-primary
                  outline-none
                  disabled:bg-surface-muted dark:disabled:bg-surface/60
                  disabled:cursor-not-allowed
                "
              />
              {form.label && !isLoading && (
                <button
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, label: "" }))}
                  aria-label="Clear text input"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-secondary-foreground dark:hover:text-secondary-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Type Select */}
          <div className="space-y-2">
            <label htmlFor="type" className="block text-sm font-semibold text-foreground dark:text-foreground">
              Data Type
            </label>
            <div className="relative">
              <select
                id="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                disabled={isLoading}
                className="
                  w-full
                  h-12
                  rounded-xl
                  px-4
                  pr-12
                  text-sm
                  text-foreground
                  bg-surface dark:bg-background
                  border border-border
                  appearance-none
                  transition focus:ring-2 focus:ring-primary/25 focus:border-primary
                  outline-none
                  disabled:bg-surface-muted dark:disabled:bg-surface/60
                  disabled:cursor-not-allowed
                "
              >
                <option value="" disabled>Select the data type</option>
                <option value="TEXT">Text (Short/Long strings)</option>
                <option value="NUMBER">Number (Integers or Decimals)</option>
                <option value="DATE">Date (Calendar date)</option>
                <option value="BOOLEAN">Checkbox (True/False)</option>
              </select>

              {/* Dropdown Chevron */}
              <ChevronDown
                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>

          {/* Visibility Switch */}
          <div className="pt-2">
            <label
              htmlFor="visible"
              className="flex items-start cursor-pointer select-none text-sm group"
            >
              {/* Native hidden checkbox */}
              <input
                type="checkbox"
                id="visible"
                checked={form.visible}
                onChange={(e) => setForm({ ...form, visible: e.target.checked })}
                disabled={isLoading}
                className="sr-only"
              />

              {/* Switch Track */}
              <div
                className={`
                  w-12 h-7 rounded-full flex items-center p-1 transition-all duration-300 flex-shrink-0 mt-0.5
                  ${form.visible ? "bg-primary shadow-md shadow-emerald-500/20" : "bg-border-strong dark:bg-surface-active"}
                `}
              >
                {/* Switch Handle */}
                <div
                  className={`
                    w-5 h-5 bg-surface dark:bg-surface-raised rounded-full shadow-md transform transition-transform duration-300
                    ${form.visible ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </div>

              {/* Stacked Labels */}
              <div className="flex flex-col ml-4">
                <span className="text-sm font-semibold text-foreground dark:text-foreground">
                  Visible to Users
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Determines if the column appears in data tables, contact details, and reports.
                </span>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-2">
            
            {/* Update Button */}
            <button
              type="submit"
              disabled={isLoading || !form.label || !form.type}
              className="
                order-1 sm:order-2
                flex-1
                inline-flex
                items-center
                justify-center
                gap-2
                h-12
                px-6
                rounded-xl
                bg-primary
                hover:bg-primary
                disabled:bg-surface-active dark:disabled:bg-surface-active
                disabled:text-muted-foreground dark:disabled:text-muted-foreground
                disabled:cursor-not-allowed
                text-white
                text-sm
                font-semibold
                transition-all duration-200
                shadow-md shadow-[rgba(var(--color-primary-rgb),1)]/10 hover:shadow-[rgba(var(--color-primary-rgb),1)]/20
              "
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update Column</span>
                </>
              )}
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="
                order-2 sm:order-1
                flex-1
                inline-flex
                items-center
                justify-center
                gap-2
                h-12
                px-6
                rounded-xl
                border border-border
                bg-card
                hover:bg-muted/60
                text-foreground
                text-sm
                font-semibold
                transition-all duration-200
              "
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            
          </div>
        </form>
      </div>
    </div>
  );
}