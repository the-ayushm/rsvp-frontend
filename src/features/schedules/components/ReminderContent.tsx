"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  X,
} from "lucide-react";
// import "/app/reminder/reminder.css";
import { useRouter } from "next/navigation";
type ReminderContentProps = {
  showClose?: boolean;
  onClose?: () => void;
};

export function ReminderContent({ showClose, onClose }: ReminderContentProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState([
    {
      id: 1,
      name: "John Doe",
      date: "2025-11-15",
      time: "10:00 AM",
      reminderName: "Team Meeting",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.reminderName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleView = (id: number) => console.log("View reminder:", id);
  const handleEdit = (id: number) => console.log("Edit reminder:", id);
  const handleDelete = (id: number) => {
    if (confirm("Delete this reminder?")) {
      setContacts(contacts.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="reminder-container w-full h-full relative">
      {/* ❌ Close button — ONLY when showClose = true */}
      {showClose && (
        <button
          onClick={onClose}
          className="absolute top-6 right-8 p-2 rounded-full border border-border dark:border-border bg-surface dark:bg-surface-raised hover:bg-surface-hover dark:hover:bg-surface-active shadow-sm"
          aria-label="Close reminders and go back"
        >
          <X className="w-4 h-4 text-secondary-foreground dark:text-secondary-foreground" />
        </button>
      )}

      <div className="max-w-400 mx-auto">
        {/* HEADER */}
        <div className="mb-6 shrink-0">
          <h1 className="text-3xl font-bold text-foreground! mb-1">Reminders</h1>
          <p className="text-foreground!">
            Manage all your reminder records efficiently
          </p>
        </div>

        {/* STATS CARDS - Simple Colors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
          {/* Card 1 - Light Green */}
          <div className="bg-[var(--color-success-light)] dark:bg-primary-light/50 rounded-lg border border-[rgba(var(--color-primary-rgb),0.3)] dark:border-primary-soft p-5">
            <p className="text-sm text-[var(--color-primary)] dark:text-[var(--color-primary)] mb-1">
              Total Reminders
            </p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-[var(--color-primary)] dark:text-[var(--color-primary)] mb-1">
                {contacts.length}
              </p>
              <div className="p-2 bg-[var(--color-primary)] rounded-lg">
                <Calendar className="text-white" size={24} />
              </div>
            </div>
          </div>

          {/* Card 2 - Light Emerald */}
          <div className="bg-primary-lighter dark:bg-primary-light/30 rounded-lg border border-[rgba(var(--color-primary-rgb),0.3)] dark:border-primary-soft p-5">
            <p className="text-sm text-[var(--color-primary)] dark:text-[var(--color-primary)] mb-1">
              This Week
            </p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold  text-[var(--color-primary)] dark:text-[var(--color-primary)] mb-1">
                5
              </p>
              <div className="p-2 bg-[var(--color-primary)] rounded-lg">
                <Clock className="text-white" size={24} />
              </div>
            </div>
          </div>

          {/* Card 3 - Light Amber */}
          <div className="bg-warning-bg dark:bg-warning-bg/30 rounded-lg border border-warning-border dark:border-warning-border p-5">
            <p className="text-sm text-warning dark:text-warning mb-1">
              Upcoming
            </p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold  text-warning dark:text-warning mb-1">
                2
              </p>
              <div className="p-2 bg-warning rounded-lg">
                <Calendar className="text-white" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* 🔍 SEARCH + FILTER */}
        <div className="flex items-center justify-between mb-6">
          {/* Search Section */}
          <div className="flex items-center gap-3 relative w-60">
            {/* Search Icon */}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />

            <input
              type="text"
              placeholder="   Search reminders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "2rem" }}
              className="
                w-85
                border 
                border-border-strong 
                dark:border-border
                dark:bg-surface-raised
                dark:text-foreground
                rounded-lg 
                py-2
                outline-none
                text-secondary-foreground 
                placeholder-muted-foreground
                dark:placeholder-muted-foreground
              "
            />
          </div>

          {/* RIGHT-SIDE BUTTONS (FILTERS + CREATE) */}
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-white-100 dark:bg-surface-raised hover:bg-[var(--color-primary)] dark:hover:bg-surface-active 
              text-secondary-foreground dark:text-foreground rounded-lg transition-colors text-sm border border-border dark:border-border"
            >
              <Filter size={16} />
              Filters
            </button>

            <button
              onClick={() => router.push("/user/reminder/create")}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary 
              text-white rounded-lg transition-colors text-sm"
            >
              <Plus size={16} />
              Create Reminder
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-surface dark:bg-surface-raised rounded-lg border border-border dark:border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-muted dark:bg-surface-active/50 border-b border-border dark:border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground dark:text-secondary-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground dark:text-secondary-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground dark:text-secondary-foreground uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary-foreground dark:text-secondary-foreground uppercase tracking-wider">
                    Reminder Name
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-secondary-foreground dark:text-secondary-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border dark:divide-border">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-surface-muted dark:hover:bg-surface-active/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-linear-to-br from-surface-hover to-surface-active dark:from-surface-active dark:to-border-strong flex items-center justify-center text-secondary-foreground dark:text-secondary-foreground font-semibold text-sm">
                            {contact.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground dark:text-foreground">
                            {contact.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar
                            size={14}
                            className="text-muted-foreground dark:text-muted-foreground"
                          />
                          <span className="text-sm text-secondary-foreground dark:text-secondary-foreground">
                            {contact.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Clock
                            size={14}
                            className="text-muted-foreground dark:text-muted-foreground"
                          />
                          <span className="text-sm text-secondary-foreground dark:text-secondary-foreground">
                            {contact.time}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-info-bg dark:bg-info-bg/20 text-[var(--color-primary-dark)] dark:text-info">
                          {contact.reminderName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleView(contact.id)}
                            className="p-1.5 text-[var(--color-primary)] dark:text-info hover:bg-[var(--color-primary)] dark:hover:bg-info-bg/30 rounded transition-colors"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(contact.id)}
                            className="p-1.5 text-[var(--color-primary)] dark:text-[var(--color-primary)] hover:bg-[var(--color-primary)] dark:hover:bg-[var(--color-primary-active)]/50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="p-1.5 text-error dark:text-error hover:bg-error dark:hover:bg-error-bg/30 rounded transition-colors"
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
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-muted-foreground dark:text-muted-foreground text-sm">
                          No contacts found. Create one to get started.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
