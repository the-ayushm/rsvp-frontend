/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send,
  List,
  ListOrdered,
  Type,
  Calendar,
  Clock,
  Repeat2,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const SCHEDULE_TYPES = [
  { id: "once", label: "Send Once" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" }
];

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function EditReminderPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const reminderId = parseInt(params.id as string);

  // Dark mode detection
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const hasDarkClass = document.documentElement.classList.contains('dark');
      const hasDataTheme = document.documentElement.getAttribute('data-theme') === 'dark';
      
      setIsDarkMode(darkModeMediaQuery.matches || hasDarkClass || hasDataTheme);
    };
    
    checkDarkMode();
    
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => checkDarkMode();
    
    darkModeMediaQuery.addEventListener('change', handleChange);
    
    const observer = new MutationObserver(handleChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);

  const [message, setMessage] = useState("");

  // Scheduling States
  const [scheduleType, setScheduleType] = useState("once");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [repeatCount, setRepeatCount] = useState(1);
  const [selectedDays, setSelectedDays] = useState<boolean[]>(
    Array(7).fill(false)
  );

  // Contact Info
  const [contact, setContact] = useState<any>(null);

  // UI States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Toolbar States
  const [showEmoji, setShowEmoji] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["contact-reminders", reminderId],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get(
        `/api/user/contact-reminders/${reminderId}`
      );
      return data;
    },
    enabled: !!reminderId,
  });

  useEffect(() => {
    if (data) {
      setMessage(data.message || "");
      setScheduleType(data.frequency || "once");
      setStartDate(data.startDate || "");
      setStartTime(data.startTime || "09:00");
      setRepeatCount(data.repeatCount || 1);

      if (data.selectedDays) {
        const daysArray = Array.isArray(data.selectedDays)
          ? data.selectedDays
          : typeof data.selectedDays === "string"
          ? JSON.parse(data.selectedDays)
          : [];
        setSelectedDays(daysArray);
      }
      setContact(data.contact);
    }
  }, [data]);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(
            start + emoji.length,
            start + emoji.length
          );
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const applyStyle = (style: "bold" | "italic") => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.slice(start, end);

    let formatted = selectedText;
    let cursorPosition = start;

    if (style === "bold") {
      formatted = `*${selectedText || ""}*`;
      cursorPosition = start + 1;
    }
    if (style === "italic") {
      formatted = `_${selectedText || ""}_`;
      cursorPosition = start + 1;
    }

    const newMessage = message.slice(0, start) + formatted + message.slice(end);
    setMessage(newMessage);

    setTimeout(() => {
      if (textareaRef.current) {
        if (selectedText) {
          textarea.setSelectionRange(
            start + formatted.length,
            start + formatted.length
          );
        } else {
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }
        textarea.focus();
      }
    }, 0);
  };

  const applyList = (type: "bullet" | "number") => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lines = message.split("\n");

    let currentPos = 0;
    let startLine = 0;
    let endLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (currentPos <= start && start < currentPos + lineLength) {
        startLine = i;
      }
      if (currentPos <= end && end <= currentPos + lineLength) {
        endLine = i;
        break;
      }
      currentPos += lineLength;
    }

    const newLines = lines.map((line, i) => {
      if (i >= startLine && i <= endLine && line.trim() !== "") {
        if (type === "bullet") {
          return `• ${line.replace(/^[•\-\d+\.]\s*/, "")}`;
        } else if (type === "number") {
          const num = i - startLine + 1;
          return `${num}. ${line.replace(/^[•\-\d+\.]\s*/, "")}`;
        }
      }
      return line;
    });

    setMessage(newLines.join("\n"));

    setTimeout(() => {
      if (textareaRef.current) {
        textarea.focus();
      }
    }, 0);
  };

  const contactReminderMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const { data } = await soft7AxiosInstance.patch(
        `/api/user/contact-reminders/${reminderId}`,
        updateData
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-reminders"] });
      setSuccess("Reminder updated successfully!");
      setTimeout(() => {
        router.push("/user/reminder");
      }, 1500);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.error || err.message || "Failed to update";
      setError(msg);
    },
  });

  const handleSave = async () => {
    if (!message.trim()) {
      setError("Message is required");
      return;
    }

    if (!startDate) {
      setError("Please select a date");
      return;
    }

    if (!startTime) {
      setError("Please select time");
      return;
    }

    if (scheduleType === "weekly" && selectedDays.every((d) => !d)) {
      setError("Please select at least one day for weekly reminder");
      return;
    }

    const updateData = {
      message: message.trim(),
      scheduleType: scheduleType === "once" ? "one" : "repeated",
      frequency: scheduleType !== "once" ? scheduleType : null,
      startDate,
      startTime,
      repeatedCount: scheduleType !== "once" ? repeatCount : null,
      selectedDays: scheduleType === "weekly" ? selectedDays : null,
      remaningCount: scheduleType !== "once" ? repeatCount : null
    };

    contactReminderMutation.mutate(updateData);
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-background dark:bg-surface"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary mx-auto mb-4"></div>
          <p className="text-secondary-foreground dark:text-muted-foreground">Loading reminder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-surface">
      <div className="max-w-4xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-error-bg dark:bg-error-bg/20 border border-error-border dark:border-error-border rounded-lg text-error dark:text-error">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-[var(--color-success-light)] dark:bg-primary-light/20 border border-primary-soft dark:border-primary-soft rounded-lg text-primary-text dark:text-[var(--color-primary)]">
            {success}
          </div>
        )}

        <div className="bg-surface dark:bg-surface-raised rounded-2xl shadow-xl border border-border dark:border-border overflow-hidden">
          {/* HEADER SECTION - FIXED COLORS */}
          <div className="p-6 bg-primary-lighter dark:bg-primary-light/30 border-b border-border dark:border-border">
            <h2 className="text-foreground dark:text-white font-semibold text-lg">
              Edit Reminder Details
            </h2>
            <p className="text-secondary-foreground dark:text-muted-foreground text-sm mt-0.5">
              Update the message and schedule
            </p>
          </div>

          <div className="px-8 pb-8 pt-6">
            <div className="space-y-6">
              {/* Contact Info - FIXED COLORS */}
              <div className="bg-primary-lighter dark:bg-primary-light/20 rounded-lg p-4 border border-primary-soft dark:border-primary-soft">
                <h4 className="font-semibold text-foreground dark:text-white mb-2">Contact</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-soft dark:bg-primary-hover flex items-center justify-center text-primary-text dark:text-primary-text font-semibold">
                    {contact?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground dark:text-white">{contact?.name}</p>
                    <p className="text-sm text-secondary-foreground dark:text-muted-foreground">{contact?.phone}</p>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-foreground dark:text-white mb-2">
                  Message
                </label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border-2 border-border dark:border-border bg-surface dark:bg-surface-raised p-4 h-40 outline-none focus:border-primary dark:focus:border-primary focus:ring-2 focus:ring-primary-soft dark:focus:ring-primary-soft/50 transition-all resize-none text-sm text-foreground dark:text-white placeholder-muted-foreground dark:placeholder-muted-foreground"
                  placeholder="Type your reminder message..."
                />

                {/* Toolbar - FIXED COLORS */}
                <div className="relative mt-3 flex gap-2">
                  <button
                    onClick={() => setShowToolbar(!showToolbar)}
                    className={`p-2 rounded-lg shadow-sm border transition-all ${
                      showToolbar
                        ? "bg-primary text-primary-foreground border-primary dark:bg-primary dark:border-primary"
                        : "bg-surface dark:bg-surface-raised text-secondary-foreground dark:text-secondary-foreground border-border-strong dark:border-border hover:bg-surface-muted dark:hover:bg-surface-active"
                    }`}
                  >
                    <Type size={16} />
                  </button>

                  {showToolbar && (
                    <div className="flex items-center gap-1 bg-surface dark:bg-surface-raised rounded-lg shadow-lg border border-border dark:border-border p-1.5">
                      <button
                        onClick={() => applyStyle("bold")}
                        className="p-1.5 hover:bg-surface-hover dark:hover:bg-surface-active rounded transition-all text-secondary-foreground dark:text-secondary-foreground"
                        title="Bold"
                      >
                        <b className="text-xs">B</b>
                      </button>
                      <button
                        onClick={() => applyStyle("italic")}
                        className="p-1.5 hover:bg-surface-hover dark:hover:bg-surface-active rounded transition-all text-secondary-foreground dark:text-secondary-foreground"
                        title="Italic"
                      >
                        <span className="text-xs italic font-serif">I</span>
                      </button>
                      <button
                        onClick={() => setShowEmoji(!showEmoji)}
                        className="p-1.5 hover:bg-surface-hover dark:hover:bg-surface-active rounded transition-all text-secondary-foreground dark:text-secondary-foreground text-sm"
                      >
                        😊
                      </button>
                      <div className="w-px h-5 bg-surface-active dark:bg-surface-active mx-1" />
                      <button
                        onClick={() => applyList("bullet")}
                        className="p-1.5 hover:bg-surface-hover dark:hover:bg-surface-active rounded transition-all"
                        title="Bullet List"
                      >
                        <List size={14} className="text-secondary-foreground dark:text-secondary-foreground" />
                      </button>
                      <button
                        onClick={() => applyList("number")}
                        className="p-1.5 hover:bg-surface-hover dark:hover:bg-surface-active rounded transition-all"
                        title="Numbered List"
                      >
                        <ListOrdered size={14} className="text-secondary-foreground dark:text-secondary-foreground" />
                      </button>
                    </div>
                  )}

                
                </div>
              </div>

              {/* Schedule Type - FIXED COLORS */}
              <div>
                <label className="block text-sm font-semibold text-foreground dark:text-white mb-3">
                  Schedule Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SCHEDULE_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setScheduleType(type.id)}
                      className={`py-2 px-3 rounded-lg font-medium text-sm transition-all border ${
                        scheduleType === type.id
                          ? "bg-primary text-primary-foreground border-primary dark:bg-primary dark:border-primary"
                          : "bg-surface dark:bg-surface-raised text-secondary-foreground dark:text-secondary-foreground border-border-strong dark:border-border hover:bg-surface-muted dark:hover:bg-surface-active"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time Settings - FIXED COLORS */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground dark:text-white mb-2">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar size={16} className="text-muted-foreground dark:text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-10 py-2 border border-border-strong dark:border-border bg-surface dark:bg-surface-raised text-foreground dark:text-white rounded-lg outline-none focus:border-primary dark:focus:border-primary focus:ring-2 focus:ring-primary-soft dark:focus:ring-primary-soft/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground dark:text-white mb-2">
                      Start Time
                    </label>
                    <div className="relative">
                      <Clock size={16} className="text-muted-foreground dark:text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-10 py-2 border border-border-strong dark:border-border bg-surface dark:bg-surface-raised text-foreground dark:text-white rounded-lg outline-none focus:border-primary dark:focus:border-primary focus:ring-2 focus:ring-primary-soft dark:focus:ring-primary-soft/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Repeat Settings - FIXED COLORS */}
              {scheduleType !== "once" && (
                <div>
                  <label className="block text-sm font-semibold text-foreground dark:text-white mb-3">
                    How many times would you like to repeat this reminder?
                  </label>
                  <div className="relative mb-4">
                    <Repeat2 size={16} className="text-muted-foreground dark:text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={repeatCount || ''}
                      onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                      placeholder="e.g. 10"
                      className="w-full pl-10 pr-3 py-2 border border-border-strong dark:border-border bg-surface dark:bg-surface-raised text-foreground dark:text-white placeholder-muted-foreground dark:placeholder-muted-foreground rounded-lg outline-none focus:border-primary dark:focus:border-primary focus:ring-2 focus:ring-primary-soft dark:focus:ring-primary-soft/50"
                    />
                  </div>

                  {scheduleType === "weekly" && (
                    <div>
                      <label className="block text-sm font-semibold text-foreground dark:text-white mb-3">
                        Select Days
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {DAYS_OF_WEEK.map((day, idx) => (
                          <button
                            key={day}
                            onClick={() => {
                              const newDays = [...selectedDays];
                              newDays[idx] = !newDays[idx];
                              setSelectedDays(newDays);
                            }}
                            className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                              selectedDays[idx]
                                ? "bg-primary text-primary-foreground border-primary dark:bg-primary dark:border-primary"
                                : "bg-surface dark:bg-surface-raised text-secondary-foreground dark:text-secondary-foreground border-border-strong dark:border-border hover:bg-surface-muted dark:hover:bg-surface-active"
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions - FIXED COLORS */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border dark:border-border">
                <button
                  onClick={() => router.push("/user/reminder")}
                  className="px-6 py-2.5 rounded-lg border border-border-strong dark:border-border bg-surface dark:bg-surface-raised hover:bg-surface-muted dark:hover:bg-surface-active transition-all font-medium text-secondary-foreground dark:text-secondary-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={contactReminderMutation.isPending}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all ${
                    contactReminderMutation.isPending
                      ? "bg-disabled-foreground dark:bg-border-strong cursor-not-allowed"
                      : "bg-primary hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary hover:shadow-lg"
                  }`}
                >
                  {contactReminderMutation.isPending
                    ? "Saving..."
                    : "Save Changes"}
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}