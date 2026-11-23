"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Bell,
  X,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  XCircle,
  Edit,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReminderContent } from "@/features/schedules/components/ReminderContent";
import { EditReminderModal } from "@/components/reminders/EditReminderModal";
import "@/features/schedules/schedules.css";

import { ArrowLeft } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

export default function ReminderContactsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const fromInbox = searchParams.get("from") === "inbox";

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);

  const ITEMS_PER_PAGE = 10;
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setFilterOpen(false);
      }
    };

    if (filterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterOpen]);

  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get("/admin/reminders");
      return data;
    },

    select: (data) => {
      const items: any[] = data?.data?.items ?? [];
      return items.map((reminder: any) => {
        // Parse date and time from next_send_local or local_datetime (e.g. "2026-09-29T12:41:00")
        const localDt = reminder.next_send_local || reminder.local_datetime || "";
        const [datePart, timePart] = localDt.split("T");
        const timeFormatted = timePart ? timePart.substring(0, 5) : "00:00";

        const scheduleName =
          (reminder.name || "Custom Reminder").substring(0, 30) +
          ((reminder.name || "").length > 30 ? "..." : "");

        return {
          id: reminder.id,
          name: reminder.name || "Unknown",
          date: datePart || new Date().toISOString().split("T")[0],
          time: timeFormatted,
          reminderName: reminder.name || "Custom Reminder",
          scheduleName,
          scheduleType: reminder.frequency,
          status: reminder.status,
          timezone: reminder.timezone,
          contactPhone: null,
          delivered: null,
          triggered: null,
          fullData: reminder,
        };
      });
    },
  });

  const stats = useMemo(() => {
    const now = new Date();

    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const thisWeekCount = contacts.filter((r: any) => {
      const reminderDate = new Date(r.date);

      return reminderDate >= now && reminderDate <= weekFromNow;
    }).length;

    const upcomingCount = contacts.filter((r: any) => {
      const reminderDate = new Date(r.date);

      return reminderDate > weekFromNow;
    }).length;

    return {
      total: contacts.length,
      thisWeek: thisWeekCount,
      upcoming: upcomingCount,
    };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    let filtered = contacts.filter(
      (contact: any) =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.scheduleName.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    // Date filter
    if (dateFilter) {
      const now = new Date();

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((contact: any) => {
        const contactDate = new Date(contact.date);

        const contactDay = new Date(
          contactDate.getFullYear(),
          contactDate.getMonth(),
          contactDate.getDate(),
        );

        switch (dateFilter) {
          case "today":
            return contactDay.getTime() === today.getTime();

          case "thisWeek": {
            const weekFromNow = new Date(
              today.getTime() + 7 * 24 * 60 * 60 * 1000,
            );

            return contactDay >= today && contactDay <= weekFromNow;
          }

          case "thisMonth":
            return (
              contactDate.getMonth() === now.getMonth() &&
              contactDate.getFullYear() === now.getFullYear()
            );

          case "upcoming":
            return contactDay > today;

          default:
            return true;
        }
      });
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter(
        (contact: any) => contact.scheduleType === typeFilter,
      );
    }

    return filtered;
  }, [contacts, searchTerm, dateFilter, typeFilter]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const endIndex = startIndex + ITEMS_PER_PAGE;

  const currentContacts = filteredContacts.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, typeFilter]);

  const pauseReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await soft7AxiosInstance.patch(
        `/admin/reminders/${id}/pause`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder paused");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        (typeof error?.response?.data?.error === "string"
          ? error.response.data.error
          : null) ||
        error?.message ||
        "Failed to pause reminder";
      toast.error(String(msg));
    },
  });

  const resumeReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await soft7AxiosInstance.patch(
        `/admin/reminders/${id}/resume`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder resumed");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        (typeof error?.response?.data?.error === "string"
          ? error.response.data.error
          : null) ||
        error?.message ||
        "Failed to resume reminder";
      toast.error(String(msg));
    },
  });

  const cancelReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await soft7AxiosInstance.patch(
        `/v1/admin/reminders/${id}/cancel`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder cancelled");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        (typeof error?.response?.data?.error === "string"
          ? error.response.data.error
          : null) ||
        error?.message ||
        "Failed to cancel reminder";
      toast.error(String(msg));
    },
  });

  const isActionPending =
    pauseReminderMutation.isPending ||
    resumeReminderMutation.isPending ||
    cancelReminderMutation.isPending;

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const clearFilters = () => {
    setDateFilter("");
    setTypeFilter("");
    setSearchTerm("");
  };

  const scheduleTypes = useMemo<string[]>(() => {
    const types = new Set<string>();

    contacts.forEach((c: any) => {
      if (typeof c.scheduleType === "string") {
        types.add(c.scheduleType);
      }
    });

    return Array.from(types);
  }, [contacts]);

  if (loading) {
    return (
      <div className="reminder-container">
        <div className="max-w-400 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="h-32 rounded-2xl skeleton" />
            <div className="h-32 rounded-2xl skeleton" />
            <div className="h-32 rounded-2xl skeleton" />
          </div>

          <div className="h-80 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="reminder-container">
      <div className="max-w-400 mx-auto">
        {/* HEADER */}
        <div className="mb-8 shrink-0">
          {fromInbox && (
            <button
              onClick={() => router.push("/user/inbox")}
              className="flex items-center gap-2 mb-4 font-medium transition-colors"
              style={{
                color: "var(--color-primary)",
              }}
            >
              <ArrowLeft size={18} />
              Back to Inbox
            </button>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div
              className="p-3 rounded-xl shadow-lg"
              style={{
                background: "var(--color-primary)",
              }}
            >
              <Bell className="w-6 h-6 text-white" />
            </div>

            <h1 className="text-4xl font-bold">Schedules</h1>
          </div>

          <p className="text-lg ml-1">
            Manage all your schedule records efficiently
          </p>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
          {/* TOTAL */}
          <div
            className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--color-primary) 12%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="p-4 rounded-xl shadow-lg"
                style={{
                  background: "var(--color-primary)",
                }}
              >
                <Calendar className="w-8 h-8 text-white" />
              </div>

              <div>
                <p
                  className="text-sm mb-2"
                  style={{
                    color: "var(--color-text-muted)",
                  }}
                >
                  Total Schedules
                </p>

                <p
                  className="text-4xl font-bold"
                  style={{
                    color: "var(--color-text)",
                  }}
                >
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          {/* THIS WEEK */}
          <div
            className="rounded-2xl p-6 transition-all duration-300"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--color-success) 12%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="p-4 rounded-xl shadow-lg"
                style={{
                  background: "var(--color-primary)",
                }}
              >
                <Clock className="w-8 h-8 text-white" />
              </div>

              <div>
                <p
                  className="text-sm mb-2"
                  style={{
                    color: "var(--color-text-muted)",
                  }}
                >
                  This Week
                </p>

                <p
                  className="text-4xl font-bold"
                  style={{
                    color: "var(--color-text)",
                  }}
                >
                  {stats.thisWeek}
                </p>
              </div>
            </div>
          </div>

          {/* UPCOMING */}
          <div
            className="rounded-2xl p-6 transition-all duration-300"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--color-warning) 12%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="p-4 rounded-xl shadow-lg"
                style={{
                  background: "var(--color-primary)",
                }}
              >
                <Bell
                  className="w-8 h-8"
                  style={{
                    color: "white",
                  }}
                />
              </div>

              <div>
                <p
                  className="text-sm mb-2"
                  style={{
                    color: "var(--color-text-muted)",
                  }}
                >
                  Upcoming
                </p>

                <p
                  className="text-4xl font-bold"
                  style={{
                    color: "var(--color-text)",
                  }}
                >
                  {stats.upcoming}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH + ACTIONS */}
        <div className="flex items-center justify-between mb-8">
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 w-[350px] overflow-hidden"
            style={{
              background: "var(--color-input)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Search
              size={18}
              style={{
                color: "var(--color-text-muted)",
              }}
            />

            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none border-0 ring-0 text-sm"
              style={{
                color: "var(--color-text)",
                boxShadow: "none",
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* FILTER */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm"
                style={{
                  background:
                    dateFilter || typeFilter ? "var(--color-primary)" : "var(--color-surface)",
                  color:
                    dateFilter || typeFilter
                      ? "var(--color-primary-foreground)"
                      : "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Filter size={16} />
                Filters
                {(dateFilter || typeFilter) && (
                  <span
                    className="ml-1 px-1.5 py-0.5 text-xs rounded-full"
                    style={{
                      background: "var(--color-background)",
                      color: "var(--color-primary)",
                    }}
                  >
                    {[dateFilter, typeFilter].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* FILTER DROPDOWN */}
              {filterOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-lg shadow-xl z-10"
                  style={{
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Filters</h3>

                      {(dateFilter || typeFilter) && (
                        <button
                          onClick={clearFilters}
                          className="text-xs transition-colors"
                          style={{
                            color: "var(--color-primary)",
                          }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* DATE */}
                    <div className="mb-4">
                      <label
                        className="block text-xs font-medium mb-2"
                        style={{
                          color: "var(--color-text-muted)",
                        }}
                      >
                        Date Range
                      </label>

                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                        style={{
                          background: "var(--color-input)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <option value="">All dates</option>
                        <option value="today">Today</option>
                        <option value="thisWeek">This week</option>
                        <option value="thisMonth">This month</option>
                        <option value="upcoming">Upcoming</option>
                      </select>
                    </div>

                    {/* TYPE */}
                    {scheduleTypes.length > 0 && (
                      <div>
                        <label
                          className="block text-xs font-medium mb-2"
                          style={{
                            color: "var(--color-text-muted)",
                          }}
                        >
                          Schedule Type
                        </label>

                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                          style={{
                            background: "var(--color-input)",
                            color: "var(--color-text)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          <option value="">All types</option>

                          {scheduleTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CREATE */}
            <button
              onClick={() => router.push("/user/reminder/create")}
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg shadow-lg"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
              }}
            >
              Create Schedule
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div
          className="rounded-lg overflow-hidden hidden md:block"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                style={{
                  background: "var(--color-surface-muted)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <tr>
                  <th className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={
                        currentContacts.length > 0 &&
                        selectedIds.length === currentContacts.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(currentContacts.map((c: any) => c.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Name
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Date
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Time
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Reminder Name
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Frequency
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Status
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {currentContacts.length > 0 ? (
                  currentContacts.map((contact: any) => (
                    <tr
                      key={contact.id}
                      style={{ borderBottom: "1px solid var(--color-border)" }}
                    >
                      {/* CHECKBOX */}
                      <td className="px-4 py-4 text-center" style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(contact.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, contact.id]);
                            } else {
                              setSelectedIds((prev) =>
                                prev.filter((id) => id !== contact.id),
                              );
                            }
                          }}
                        />
                      </td>

                      {/* NAME */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-semibold text-xs"
                            style={{
                              background: "var(--color-surface-muted)",
                              color: "var(--color-text)",
                            }}
                          >
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--color-text)" }}
                          >
                            {contact.name}
                          </span>
                        </div>
                      </td>

                      {/* DATE */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar
                            size={13}
                            className="shrink-0"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <span
                            className="text-sm"
                            style={{ color: "var(--color-text)" }}
                          >
                            {contact.date}
                          </span>
                        </div>
                      </td>

                      {/* TIME */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock
                            size={13}
                            className="shrink-0"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <span
                            className="text-sm"
                            style={{ color: "var(--color-text)" }}
                          >
                            {contact.time}
                          </span>
                        </div>
                      </td>

                      {/* REMINDER NAME */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                          style={{
                            background:
                              "color-mix(in oklch, var(--color-info) 12%, transparent)",
                            color: "var(--color-info)",
                            border:
                              "1px solid color-mix(in oklch, var(--color-info) 25%, transparent)",
                          }}
                        >
                          {contact.scheduleName}
                        </span>
                      </td>

                      {/* FREQUENCY */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                          style={{
                            background:
                              "color-mix(in oklch, var(--color-primary) 10%, transparent)",
                            color: "var(--color-primary)",
                            border:
                              "1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)",
                          }}
                        >
                          {contact.scheduleType || "—"}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                          style={{
                            background:
                              contact.status === "upcoming"
                                ? "color-mix(in oklch, var(--color-success) 15%, transparent)"
                                : contact.status === "paused"
                                ? "color-mix(in oklch, var(--color-warning) 15%, transparent)"
                                : contact.status === "sent"
                                ? "color-mix(in oklch, var(--color-success) 15%, transparent)"
                                : "color-mix(in oklch, var(--color-text-muted) 15%, transparent)",
                            color:
                              contact.status === "upcoming"
                                ? "var(--color-success)"
                                : contact.status === "paused"
                                ? "var(--color-warning)"
                                : contact.status === "sent"
                                ? "var(--color-success)"
                                : "var(--color-text-muted)",
                            border:
                              contact.status === "upcoming"
                                ? "1px solid color-mix(in oklch, var(--color-success) 30%, transparent)"
                                : contact.status === "paused"
                                ? "1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)"
                                : contact.status === "sent"
                                ? "1px solid color-mix(in oklch, var(--color-success) 30%, transparent)"
                                : "1px solid color-mix(in oklch, var(--color-text-muted) 30%, transparent)",
                          }}
                        >
                          {contact.status || "—"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {contact.status !== "paused" && contact.status !== "cancelled" && (
                            <button
                              onClick={() => pauseReminderMutation.mutate(contact.id)}
                              disabled={isActionPending}
                              className="p-1.5 rounded hover:bg-warning-bg"
                              style={{ color: "var(--color-warning)" }}
                              title="Pause"
                            >
                              <Pause size={15} />
                            </button>
                          )}

                          {contact.status === "paused" && (
                            <button
                              onClick={() => resumeReminderMutation.mutate(contact.id)}
                              disabled={isActionPending}
                              className="p-1.5 rounded hover:bg-success-bg"
                              style={{ color: "var(--color-success)" }}
                              title="Resume"
                            >
                              <Play size={15} />
                            </button>
                          )}

                          {contact.status !== "cancelled" && (
                            <button
                              onClick={() => {
                                setEditingReminder(contact);
                                setEditModalOpen(true);
                              }}
                              disabled={isActionPending}
                              className="p-1.5 rounded hover:bg-info-bg"
                              style={{ color: "var(--color-info)" }}
                              title="Edit"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                          {contact.status !== "cancelled" && (
                            <button
                              onClick={() => cancelReminderMutation.mutate(contact.id)}
                              disabled={isActionPending}
                              className="p-1.5 rounded hover:bg-error-bg"
                              style={{ color: "var(--color-primary)" }}
                              title="Cancel"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <p
                        className="text-sm"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {searchTerm || dateFilter || typeFilter
                          ? "No schedules match your filters."
                          : "No schedules found. Create one to get started."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4 p-4">
            {currentContacts.length > 0 ? (
              currentContacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3
                        className="font-semibold"
                        style={{
                          color: "var(--color-text)",
                        }}
                      >
                        {contact.name}
                      </h3>

                      <p
                        className="text-xs"
                        style={{
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {contact.scheduleName}
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={selectedIds.includes(contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => [...prev, contact.id]);
                        } else {
                          setSelectedIds((prev) =>
                            prev.filter((id) => id !== contact.id),
                          );
                        }
                      }}
                    />
                  </div>

                  <div
                    className="mt-3 space-y-2 text-sm"
                    style={{
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <div className="flex justify-between">
                      <span>Date</span>

                      <span
                        className="font-medium"
                        style={{
                          color: "var(--color-text)",
                        }}
                      >
                        {contact.date}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Time</span>

                      <span
                        className="font-medium"
                        style={{
                          color: "var(--color-text)",
                        }}
                      >
                        {contact.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    {contact.status !== "paused" && contact.status !== "cancelled" && (
                      <button
                        onClick={() => pauseReminderMutation.mutate(contact.id)}
                        disabled={isActionPending}
                        className="p-2 rounded transition-colors"
                        style={{ color: "var(--color-warning)" }}
                        title="Pause"
                      >
                        <Pause size={16} />
                      </button>
                    )}

                    {contact.status === "paused" && (
                      <button
                        onClick={() => resumeReminderMutation.mutate(contact.id)}
                        disabled={isActionPending}
                        className="p-2 rounded transition-colors"
                        style={{ color: "var(--color-success)" }}
                        title="Resume"
                      >
                        <Play size={16} />
                      </button>
                    )}

                    {contact.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          setEditingReminder(contact);
                          setEditModalOpen(true);
                        }}
                        disabled={isActionPending}
                        className="p-2 rounded transition-colors"
                        style={{ color: "var(--color-info)" }}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {contact.status !== "cancelled" && (
                      <button
                        onClick={() => cancelReminderMutation.mutate(contact.id)}
                        disabled={isActionPending}
                        className="p-2 rounded transition-colors"
                        style={{ color: "var(--color-primary)" }}
                        title="Cancel"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div
                className="text-center text-sm py-10"
                style={{
                  color: "var(--color-text-muted)",
                }}
              >
                No schedules found.
              </div>
            )}
          </div>

          {/* PAGINATION */}
          {filteredContacts.length > 0 && (
            <div
              className="px-6 py-4 border-t flex items-center justify-between"
              style={{
                borderColor: "var(--color-border)",
              }}
            >
              <div
                className="text-sm"
                style={{
                  color: "var(--color-text-muted)",
                }}
              >
                Showing{" "}
                <span
                  className="font-medium"
                  style={{
                    color: "var(--color-text)",
                  }}
                >
                  {startIndex + 1}–{Math.min(endIndex, filteredContacts.length)}
                </span>{" "}
                of{" "}
                <span
                  className="font-medium"
                  style={{
                    color: "var(--color-text)",
                  }}
                >
                  {filteredContacts.length}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all"
                  style={{
                    background:
                      currentPage === 1 ? "var(--color-surface-muted)" : "var(--color-primary)",
                    color:
                      currentPage === 1
                        ? "var(--color-text-muted)"
                        : "var(--color-primary-foreground)",
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={18} />
                  PREV
                </button>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all"
                  style={{
                    background:
                      currentPage === totalPages
                        ? "var(--color-surface-muted)"
                        : "var(--color-primary)",
                    color:
                      currentPage === totalPages
                        ? "var(--color-text-muted)"
                        : "var(--color-primary-foreground)",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                  }}
                >
                  NEXT
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW MODAL */}
      {viewModalOpen && selectedReminder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            <button
              onClick={() => setViewModalOpen(false)}
              className="p-2 absolute right-10 rounded-lg transition-colors"
              style={{
                color: "var(--color-text-muted)",
              }}
            >
              <X size={20} />
            </button>

            <div className="px-8 pb-8 pt-2 mt-8">
              <h2
                className="text-2xl font-bold mb-6 text-center"
                style={{
                  color: "var(--color-text)",
                }}
              >
                Schedule Details
              </h2>

              <div className="space-y-4">
                {/* NAME */}
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{
                    borderColor: "var(--color-border)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Name:
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{
                      color: "var(--color-text)",
                    }}
                  >
                    {selectedReminder.name}
                  </span>
                </div>

                {/* PHONE */}
                {selectedReminder.contactPhone && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Phone:
                    </span>

                    <span
                      className="text-sm font-bold"
                      style={{
                        color: "var(--color-text)",
                      }}
                    >
                      {selectedReminder.contactPhone}
                    </span>
                  </div>
                )}

                {/* DATE */}
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{
                    borderColor: "var(--color-border)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Date:
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{
                      color: "var(--color-text)",
                    }}
                  >
                    {selectedReminder.date}
                  </span>
                </div>

                {/* TIME */}
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{
                    borderColor: "var(--color-border)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Time:
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{
                      color: "var(--color-text)",
                    }}
                  >
                    {selectedReminder.time}
                  </span>
                </div>

                {/* FREQUENCY */}
                {selectedReminder.scheduleType && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Frequency:
                    </span>

                    <span
                      className="text-sm font-bold capitalize"
                      style={{
                        color: "var(--color-text)",
                      }}
                    >
                      {selectedReminder.scheduleType}
                    </span>
                  </div>
                )}

                {/* STATUS */}
                {selectedReminder.status && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Status:
                    </span>

                    <span
                      className="text-sm font-bold capitalize"
                      style={{
                        color: "var(--color-text)",
                      }}
                    >
                      {selectedReminder.status}
                    </span>
                  </div>
                )}

                {/* TIMEZONE */}
                {selectedReminder.timezone && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Timezone:
                    </span>

                    <span
                      className="text-sm font-bold"
                      style={{
                        color: "var(--color-text)",
                      }}
                    >
                      {selectedReminder.timezone}
                    </span>
                  </div>
                )}

                {/* NEXT SEND */}
                {selectedReminder.fullData?.next_send_local && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Next Send:
                    </span>

                    <span
                      className="text-sm font-bold"
                      style={{
                        color: "var(--color-text)",
                      }}
                    >
                      {selectedReminder.fullData.next_send_local.replace("T", " ")}
                    </span>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      <EditReminderModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        reminderData={editingReminder}
      />
    </div>
  );
}
