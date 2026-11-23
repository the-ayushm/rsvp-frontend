"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Bell,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReminderContent } from "@/features/schedules/components/ReminderContent";
import "./reminder.css";

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
      const { data } = await soft7AxiosInstance.get(
        "/api/user/contact-reminders/list",
      );

      return data;
    },

    select: (data) => {
      return data.map((reminder: any) => ({
        id: reminder.id,
        name: reminder.contactName || "Unknown",
        date: reminder.startDate || new Date().toISOString().split("T")[0],
        time: `${reminder.startTime || "00:00"}`,
        reminderName: reminder.templateName || "Custom Reminder",
        scheduleName:
          (
            reminder.templateName ||
            reminder.message ||
            "Custom Reminder"
          ).substring(0, 30) +
          ((reminder.templateName || reminder.message || "").length > 30
            ? "..."
            : ""),
        scheduleType: reminder.scheduleType,
        contactPhone: reminder.contactPhone,
        delivered: reminder.delivered,
        triggered: reminder.triggered,
        fullData: reminder,
      }));
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

  const handleView = (id: number) => {
    const reminder = contacts.find((c: any) => c.id === id);

    if (reminder) {
      setSelectedReminder(reminder);
      setViewModalOpen(true);
    }
  };

  const handleEdit = (id: number) => {
    router.push(`/user/reminder/${id}`);
  };

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await soft7AxiosInstance.delete(
        `/api/user/contact-reminders/${id}`,
      );

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["reminders"],
      });

      toast.success("Reminder deleted successfully");
    },

    onError: (error: any) => {
      console.error("Error deleting reminder:", error);

      toast.error(error?.response?.data?.error || "Failed to delete reminder");
    },
  });

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this reminder?")) {
      deleteReminderMutation.mutateAsync(id);
    }
  };

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
                color: "var(--terracotta)",
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
                background: "var(--terracotta)",
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
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--terracotta) 12%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="p-4 rounded-xl shadow-lg"
                style={{
                  background: "var(--terracotta)",
                }}
              >
                <Calendar className="w-8 h-8 text-white" />
              </div>

              <div>
                <p
                  className="text-sm mb-2"
                  style={{
                    color: "var(--muted-foreground)",
                  }}
                >
                  Total Schedules
                </p>

                <p
                  className="text-4xl font-bold"
                  style={{
                    color: "var(--foreground)",
                  }}
                >
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          {/* THIS WEEK */}
          <div
            className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--sage) 12%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="p-4 rounded-xl shadow-lg"
                style={{
                  background: "var(--terracotta)",
                }}
              >
                <Clock className="w-8 h-8 text-white" />
              </div>

              <div>
                <p
                  className="text-sm mb-2"
                  style={{
                    color: "var(--muted-foreground)",
                  }}
                >
                  This Week
                </p>

                <p
                  className="text-4xl font-bold"
                  style={{
                    color: "var(--foreground)",
                  }}
                >
                  {stats.thisWeek}
                </p>
              </div>
            </div>
          </div>

          {/* UPCOMING */}
          <div
            className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--mustard) 12%, transparent)",
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="p-4 rounded-xl shadow-lg"
                style={{
                  background: "var(--terracotta)",
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
                    color: "var(--muted-foreground)",
                  }}
                >
                  Upcoming
                </p>

                <p
                  className="text-4xl font-bold"
                  style={{
                    color: "var(--foreground)",
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
              background: "var(--input)",
              border: "1px solid var(--border)",
            }}
          >
            <Search
              size={18}
              style={{
                color: "var(--muted-foreground)",
              }}
            />

            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none border-0 ring-0 text-sm"
              style={{
                color: "var(--foreground)",
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
                    dateFilter || typeFilter ? "var(--accent)" : "var(--card)",
                  color:
                    dateFilter || typeFilter
                      ? "var(--accent-foreground)"
                      : "var(--foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                <Filter size={16} />
                Filters
                {(dateFilter || typeFilter) && (
                  <span
                    className="ml-1 px-1.5 py-0.5 text-xs rounded-full"
                    style={{
                      background: "var(--paper)",
                      color: "var(--terracotta)",
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
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    color: "var(--popover-foreground)",
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
                            color: "var(--terracotta)",
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
                          color: "var(--muted-foreground)",
                        }}
                      >
                        Date Range
                      </label>

                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                        style={{
                          background: "var(--input)",
                          color: "var(--foreground)",
                          border: "1px solid var(--border)",
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
                            color: "var(--muted-foreground)",
                          }}
                        >
                          Schedule Type
                        </label>

                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                          style={{
                            background: "var(--input)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
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
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              style={{
                background: "var(--terracotta)",
                color: "var(--accent-foreground)",
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
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                style={{
                  background: "var(--paper-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <tr>
                  <th className="px-4 py-3 w-12 text-center">
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

                  {["Name", "Date", "Time", "Schedule Name"].map((heading) => (
                    <th
                      key={heading}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {heading}
                    </th>
                  ))}

                  <th
                    className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                    style={{
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody
                style={{
                  borderColor: "var(--border)",
                }}
              >
                {currentContacts.length > 0 ? (
                  currentContacts.map((contact: any) => (
                    <tr
                      key={contact.id}
                      className="transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td className="px-4 py-4 w-12 text-center">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                            style={{
                              background: "var(--paper-2)",
                              color: "var(--foreground)",
                            }}
                          >
                            {contact.name.charAt(0)}
                          </div>

                          <span
                            className="text-sm font-medium"
                            style={{
                              color: "var(--foreground)",
                            }}
                          >
                            {contact.name}
                          </span>
                        </div>
                      </td>

                      {/* DATE */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar
                            size={14}
                            style={{
                              color: "var(--muted-foreground)",
                            }}
                          />

                          <span
                            className="text-sm"
                            style={{
                              color: "var(--foreground)",
                            }}
                          >
                            {contact.date}
                          </span>
                        </div>
                      </td>

                      {/* TIME */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock
                            size={14}
                            style={{
                              color: "var(--muted-foreground)",
                            }}
                          />

                          <span
                            className="text-sm"
                            style={{
                              color: "var(--foreground)",
                            }}
                          >
                            {contact.time}
                          </span>
                        </div>
                      </td>

                      {/* SCHEDULE */}
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                          style={{
                            background:
                              "color-mix(in oklch, var(--plum) 12%, transparent)",
                            color: "var(--plum)",
                            border:
                              "1px solid color-mix(in oklch, var(--plum) 25%, transparent)",
                          }}
                        >
                          {contact.scheduleName}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleView(contact.id)}
                            className="p-1.5 rounded transition-colors"
                            style={{
                              color: "var(--muted-foreground)",
                            }}
                            title="View"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            onClick={() => handleEdit(contact.id)}
                            className="p-1.5 rounded transition-colors"
                            style={{
                              color: "var(--muted-foreground)",
                            }}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => handleDelete(contact.id)}
                            disabled={deleteReminderMutation.isPending}
                            className="p-1.5 rounded transition-colors"
                            style={{
                              color: "var(--muted-foreground)",
                            }}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p
                        className="text-sm"
                        style={{
                          color: "var(--muted-foreground)",
                        }}
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
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3
                        className="font-semibold"
                        style={{
                          color: "var(--foreground)",
                        }}
                      >
                        {contact.name}
                      </h3>

                      <p
                        className="text-xs"
                        style={{
                          color: "var(--muted-foreground)",
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
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <div className="flex justify-between">
                      <span>Date</span>

                      <span
                        className="font-medium"
                        style={{
                          color: "var(--foreground)",
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
                          color: "var(--foreground)",
                        }}
                      >
                        {contact.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => handleView(contact.id)}
                      className="p-2 rounded"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      onClick={() => handleEdit(contact.id)}
                      className="p-2 rounded"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="p-2 rounded"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div
                className="text-center text-sm py-10"
                style={{
                  color: "var(--muted-foreground)",
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
                borderColor: "var(--border)",
              }}
            >
              <div
                className="text-sm"
                style={{
                  color: "var(--muted-foreground)",
                }}
              >
                Showing{" "}
                <span
                  className="font-medium"
                  style={{
                    color: "var(--foreground)",
                  }}
                >
                  {startIndex + 1}–{Math.min(endIndex, filteredContacts.length)}
                </span>{" "}
                of{" "}
                <span
                  className="font-medium"
                  style={{
                    color: "var(--foreground)",
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
                      currentPage === 1 ? "var(--muted)" : "var(--primary)",
                    color:
                      currentPage === 1
                        ? "var(--muted-foreground)"
                        : "var(--primary-foreground)",
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
                        ? "var(--muted)"
                        : "var(--primary)",
                    color:
                      currentPage === totalPages
                        ? "var(--muted-foreground)"
                        : "var(--primary-foreground)",
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
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              onClick={() => setViewModalOpen(false)}
              className="p-2 absolute right-10 rounded-lg transition-colors"
              style={{
                color: "var(--muted-foreground)",
              }}
            >
              <X size={20} />
            </button>

            <div className="px-8 pb-8 pt-2 mt-8">
              <h2
                className="text-2xl font-bold mb-6 text-center"
                style={{
                  color: "var(--foreground)",
                }}
              >
                Schedule Details
              </h2>

              <div className="space-y-4">
                {/* NAME */}
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{
                    borderColor: "var(--border)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Name:
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{
                      color: "var(--foreground)",
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
                      borderColor: "var(--border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Phone:
                    </span>

                    <span
                      className="text-sm font-bold"
                      style={{
                        color: "var(--foreground)",
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
                    borderColor: "var(--border)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Date:
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{
                      color: "var(--foreground)",
                    }}
                  >
                    {selectedReminder.date}
                  </span>
                </div>

                {/* TIME */}
                <div
                  className="flex items-center justify-between py-3 border-b"
                  style={{
                    borderColor: "var(--border)",
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Time:
                  </span>

                  <span
                    className="text-sm font-bold"
                    style={{
                      color: "var(--foreground)",
                    }}
                  >
                    {selectedReminder.time}
                  </span>
                </div>

                {/* TYPE */}
                {selectedReminder.scheduleType && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Type:
                    </span>

                    <span
                      className="text-sm font-bold"
                      style={{
                        color: "var(--foreground)",
                      }}
                    >
                      {selectedReminder.scheduleType}
                    </span>
                  </div>
                )}

                {/* MESSAGE */}
                {selectedReminder.fullData?.message && (
                  <div
                    className="flex items-center justify-between py-3 border-b"
                    style={{
                      borderColor: "var(--border)",
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Message:
                    </span>

                    <span
                      className="text-sm font-bold text-right max-w-[60%] truncate"
                      style={{
                        color: "var(--foreground)",
                      }}
                      title={selectedReminder.fullData.message}
                    >
                      {selectedReminder.fullData.message.length > 50
                        ? selectedReminder.fullData.message.substring(0, 50) +
                          "..."
                        : selectedReminder.fullData.message}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
