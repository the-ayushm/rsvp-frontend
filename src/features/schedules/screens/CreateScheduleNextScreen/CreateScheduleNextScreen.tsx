/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Repeat,
  Sparkles,
  Users,
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronLeft,
  Edit,
  Send,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

type Recipient = { id: number | string; label: string; type: string };

export default function CreateReminderStep2() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // State

  const [draft, setDraft] = useState<{
    recipients: Recipient[];
    templateName?: string;
    language?: string;
    variables?: Record<string, string>;
    scheduleType?: "one" | "repeated" | "yourwish";
    date?: string;
    time?: string;
    phoneNumberId?: string;
    selectedTemplateId?: string;
    components?: any[];
    headerMode?: string;
  }>(() => {
    try {
      const raw = localStorage.getItem("draftReminder");
      return raw ? JSON.parse(raw) : { recipients: [],  };
    } catch {
      return { recipients: [], };
    }
  });

  useEffect(() => {
    if (!draft.recipients || draft.recipients.length === 0 || !draft.templateName) {
      setTimeout(() => router.push("/user/reminder/create"), 200);
    }
  }, [draft.recipients, draft.templateName, router]);

  const [activeTab, setActiveTab] = useState<"one" | "repeated" | "yourwish">(
    "one"
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allDay, setAllDay] = useState(false);
  const [onDate, setOnDate] = useState("");
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("10:00");
  const [repeatEvery, setRepeatEvery] = useState<number | "">("");
  const [repeatUnit, setRepeatUnit] = useState("daily");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [appliedType, setAppliedType] = useState<
    "one" | "repeated" | "yourwish" | null
  >(null);

  const scheduleOptions = [
    {
      id: "one" as const,
      label: "One-Time",
      icon: Calendar,
      description: "Send reminder once at specific time",
    },
    {
      id: "repeated" as const,
      label: "Repeated",
      icon: Repeat,
      description: "Send reminder on regular intervals",
    },
    {
      id: "yourwish" as const,
      label: "Custom",
      icon: Sparkles,
      description: "Create your own schedule pattern",
    },
  ];

  const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];
  const daysFullName = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const generateCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -i);
      days.unshift({ date: prevMonthDay.getDate(), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, isCurrentMonth: true });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: i, isCurrentMonth: false });
    }
    return days;
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handlePrevMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1)
    );
  };

  const handleNextMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1)
    );
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      day
    );
    setSelectedDate(newDate);
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const dateDay = String(newDate.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${dateDay}`;
    setOnDate(formattedDate);
  };

  const createReminderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await soft7AxiosInstance.post(
        "/admin/reminders",
        payload
      );
      return data;
    },
    onSuccess: (data) => {
      localStorage.removeItem("draftReminder");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      router.push("/user/reminder");
      toast.success(data?.message || `Successfully created reminder(s)!`);
    },
    onError: (error: any) => {
      const messages =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create Reminder";
      toast.error(messages);
      console.error("Error creating reminder:", error);
    },
  });

  const handleSave = async () => {
    if (activeTab === "one" && !onDate) {
      toast.error("Please select a date");
      return;
    }
    if (activeTab === "repeated" && !onDate) {
      toast.error("Please select a date");
      return;
    }

    const local_datetime = `${onDate}T${fromTime}:00`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const contact_ids = draft.recipients?.map((r) => String(r.id)) || [];
    const frequency = activeTab === "one" ? "once" : repeatUnit;

    const media_uploads: any[] = [];
    const components = draft.components || [];
    const hasDynamicMediaHeader =
      components.some(
        (c: any) =>
          c.type === "HEADER" &&
          ["IMAGE", "VIDEO", "DOCUMENT"].includes((c.format || "").toUpperCase())
      );

    if (hasDynamicMediaHeader) {
      const headerComponent = components.find((c: any) => c.type === "HEADER");
      const format = (headerComponent?.format || "IMAGE").toLowerCase();
      const url =
        draft.variables?.headerImageUrl ||
        draft.variables?.headerVideoUrl ||
        draft.variables?.headerDocumentUrl;
      if (url) {
        media_uploads.push({ type: format, url });
      }
    }

    const parameter_mapping: Record<string, string> = {};
    if (draft.variables) {
      for (const key in draft.variables) {
        if (!["headerImageUrl", "headerVideoUrl", "headerDocumentUrl"].includes(key)) {
          parameter_mapping[key] = draft.variables[key];
        }
      }
    }

    const payload = {
      name: draft.templateName || "Reminder",
      contact_ids,
      phone_number_id: draft.phoneNumberId || "",
      template_id: draft.selectedTemplateId || "",
      frequency,
      local_datetime,
      timezone,
      parameter_mapping,
      media_uploads,
    };

    createReminderMutation.mutate(payload);
  };

  const handleCancel = () => {
    localStorage.removeItem("draftReminder");
    router.push("/user/reminder/create");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-6xl mx-auto p-6">
        {/* HEADER */}
        <div className="mb-6 px-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedule Reminder</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Choose when and how your reminder should be delivered
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        {/* TOP ROW - Schedule Type Cards + Recipients */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {scheduleOptions.map((option) => {
            const Icon = option.icon;
            const isActive = activeTab === option.id;
            const isApplied = appliedType === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => setActiveTab(option.id)}
                className={`relative p-5 rounded-xl transition-all duration-300 text-left bg-card border-2 ${
                  isActive ? "border-primary shadow-md" : "border-border hover:shadow-sm"
                }`}
              >
                {isApplied && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                    <Check size={12} className="text-primary-foreground" />
                  </div>
                )}
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-all ${
                  isActive ? "bg-primary" : "bg-muted"
                }`}>
                  <Icon size={22} className={isActive ? "text-primary-foreground" : "text-muted-foreground"} />
                </div>
                <h3 className="font-semibold text-base mb-1 text-foreground">
                  {option.label}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {option.description}
                </p>
              </button>
            );
          })}

          {/* Recipients Card */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center shadow-sm">
                <Users size={22} className="text-primary-text" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground mb-0.5">
                  Recipients
                </h3>
                <p className="text-xs text-muted-foreground">
                  {draft.recipients?.length || 0} selected
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {draft.recipients?.slice(0, 1).map((r) => (
                <div
                  key={String(r.id)}
                  className="px-3 py-2 bg-primary/10 rounded-lg text-xs text-primary-text font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {r.label}
                </div>
              ))}
              {draft.recipients && draft.recipients.length > 1 && (
                <div className="px-3 py-2 rounded-lg text-xs text-muted-foreground text-center font-medium border border-border">
                  +{draft.recipients.length - 1} more
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* LEFT COLUMN - Date & Time */}
          <div className="bg-card rounded-2xl shadow-sm p-6 flex flex-col min-h-[500px] border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">
                Date & Time
              </h2>
            </div>
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-4">
                <label className="text-muted-foreground font-medium w-16">
                  Date
                </label>
                <input
                  type="date"
                  value={onDate}
                  onChange={(e) => setOnDate(e.target.value)}
                  disabled={createReminderMutation?.isPending}
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              {!allDay && (
                <div className="flex items-center gap-4">
                  <label className="text-muted-foreground font-medium w-16">
                    Time
                  </label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    disabled={createReminderMutation?.isPending}
                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              )}
            </div>
            {activeTab === "repeated" && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-lg font-bold text-foreground mb-4">
                  Repeat
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-muted-foreground font-medium">Every</span>
                  <input
                    type="number"
                    min="0"
                    value={repeatEvery}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setRepeatEvery("");
                      } else {
                        const numVal = parseInt(val);
                        if (!isNaN(numVal) && numVal >= 0) {
                          setRepeatEvery(numVal);
                        }
                      }
                    }}
                    placeholder="Enter value"
                    disabled={createReminderMutation?.isPending}
                    className="w-16 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <select
                    value={repeatUnit}
                    onChange={(e) => setRepeatUnit(e.target.value)}
                    disabled={createReminderMutation?.isPending}
                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {repeatUnit === "weekly" && (
                  <div className="mb-3">
                    <span className="text-sm text-muted-foreground font-medium mb-2 block">
                      On
                    </span>
                    <div className="flex gap-2">
                      {daysOfWeek.map((day, idx) => {
                        const isSel = selectedDays.includes(daysFullName[idx]);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleDay(daysFullName[idx])}
                            disabled={createReminderMutation?.isPending}
                            className={`w-8 h-8 rounded-full text-xs font-semibold transition-all border ${
                              isSel
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-background border-border text-foreground hover:border-primary/50"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border mt-auto">
              <button
                onClick={handleCancel}
                disabled={createReminderMutation?.isPending}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-background text-foreground font-medium border border-border hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createReminderMutation?.isPending}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
              >
                {createReminderMutation?.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN - Calendar */}
          <div className="bg-card rounded-2xl shadow-sm p-6 flex flex-col min-h-[500px] border border-border">
            <div className="flex items-center justify-end mb-6">
              <div className="flex gap-2">
                <button
                  onClick={handlePrevMonth}
                  disabled={createReminderMutation?.isPending}
                  className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-muted transition-all text-foreground"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={handleNextMonth}
                  disabled={createReminderMutation?.isPending}
                  className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-muted transition-all text-foreground"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-muted-foreground py-1.5"
                >
                  {day}
                </div>
              ))}
              {generateCalendar().map((day, idx) => {
                const today = new Date();
                const isToday =
                  day.isCurrentMonth &&
                  day.date === today.getDate() &&
                  selectedDate.getMonth() === today.getMonth() &&
                  selectedDate.getFullYear() === today.getFullYear();

                let dayDateString = "";
                if (day.isCurrentMonth) {
                  const year = selectedDate.getFullYear();
                  const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                  const dateDay = String(day.date).padStart(2, "0");
                  dayDateString = `${year}-${month}-${dateDay}`;
                }
                const isSelected = day.isCurrentMonth && onDate === dayDateString;

                return (
                  <button
                    key={idx}
                    onClick={() => day.isCurrentMonth && handleDateClick(day.date)}
                    disabled={!day.isCurrentMonth || createReminderMutation?.isPending}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary border"
                        : isToday
                        ? "bg-primary/20 text-primary-text border border-primary/30"
                        : day.isCurrentMonth
                        ? "bg-background text-foreground border border-border hover:border-primary/50"
                        : "bg-background/50 text-muted-foreground border border-transparent opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {day.date}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM RIGHT - Create Reminder Button */}
        <button
          onClick={handleSave}
          disabled={!onDate || createReminderMutation?.isPending}
          className={`fixed bottom-5 right-5 z-50 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg ${
            onDate && !createReminderMutation?.isPending
              ? "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-primary/30"
              : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
          }`}
        >
          {createReminderMutation?.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <Send size={20} />
              <span>Create Reminder</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}