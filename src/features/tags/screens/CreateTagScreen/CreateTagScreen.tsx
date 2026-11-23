/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Save,
  Tag as TagIcon,
  XCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface Notification {
  message: string;
  type: "error" | "success";
}

/* =========================================================
   DESIGN COLORS
========================================================= */
const UI = {
  pageBg: "var(--color-background)",
  cardBg: "var(--color-surface)",
  border: "var(--color-border)",
  text: "var(--color-text)",
  mutedText: "var(--color-text-muted)",
  primary: "var(--color-primary)",
  primaryHover: "var(--color-primary-hover)",
};

/* =========================================================
   NOTIFICATION
========================================================= */
const NotificationToast = ({
  notification,
}: {
  notification: Notification | null;
}) => {
  if (!notification) return null;

  return (
    <div
      className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl transition-all duration-300 ${
        notification.type === "success"
          ? "border-primary-soft bg-[var(--color-success-light)] text-[var(--color-success-dark)]"
          : "border-error-border bg-error-bg text-error"
      }`}
      role="alert"
    >
      {notification.type === "success" ? (
        <CheckCircle className="h-5 w-5 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0" />
      )}

      <p className="text-sm font-medium">{notification.message}</p>
    </div>
  );
};

/* =========================================================
   CREATE TAG PAGE
========================================================= */
export default function CreateTagPage() {
  const [tagName, setTagName] = useState("");
  const [tagGroup, setTagGroup] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] =
    useState<Notification | null>(null);

  const showNotification = (
    message: string,
    type: "error" | "success"
  ) => {
    setNotification({
      message,
      type,
    });

    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const navigateToTags = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/manage/tags";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTagName = tagName.trim();

    if (!trimmedTagName) {
      showNotification("Tag Name is required.", "error");
      return;
    }

    setLoading(true);

    const payload = {
      name: trimmedTagName,
      group: tagGroup.trim() || null,
    };

    try {
      await soft7AxiosInstance.post(
        "/api/user/tags/create",
        payload
      );

      showNotification(
        `Tag '${trimmedTagName}' created successfully!`,
        "success"
      );

      setTimeout(navigateToTags, 600);
    } catch (error) {
      showNotification(
        "Network error. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full px-4 py-10"
      style={{
        backgroundColor: UI.pageBg,
      }}
    >
      <NotificationToast notification={notification} />

      <div className="mx-auto w-full max-w-3xl">
        {/* =================================================
            BACK
        ================================================= */}
        <a
          href="/user/manage/tags"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{
            color: UI.text,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = UI.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = UI.text;
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tags
        </a>

        {/* =================================================
            MAIN CARD
        ================================================= */}
        <div
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{
            backgroundColor: UI.cardBg,
            borderColor: UI.border,
          }}
        >
          {/* =================================================
              HEADER
          ================================================= */}
          <div
            className="border-b px-6 py-5"
            style={{
              borderColor: UI.border,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                }}
              >
                <TagIcon
                  className="h-5 w-5"
                  style={{
                    color: UI.primary,
                  }}
                />
              </div>

              <div>
                <h1
                  className="text-2xl font-bold"
                  style={{
                    color: UI.text,
                  }}
                >
                  Create New Tag
                </h1>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: UI.mutedText,
                  }}
                >
                  Add a tag name and optionally assign it
                  to a related group.
                </p>
              </div>
            </div>
          </div>

          {/* =================================================
              FORM
          ================================================= */}
          <form
            onSubmit={handleSubmit}
            className="space-y-6 px-6 py-6"
          >
            {/* TAG NAME */}
            <div>
              <label
                htmlFor="tag-name"
                className="mb-2 block text-sm font-semibold"
                style={{
                  color: UI.text,
                }}
              >
                Tag Name{" "}
                <span className="text-error">*</span>
              </label>

              <input
                id="tag-name"
                type="text"
                value={tagName}
                onChange={(e) =>
                  setTagName(e.target.value)
                }
                placeholder="e.g. Important"
                disabled={loading}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: UI.cardBg,
                  borderColor: UI.border,
                  color: UI.text,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor =
                    UI.primary;
                  e.currentTarget.style.boxShadow =
                    `0 0 0 3px var(--color-primary-ring)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    UI.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* TAG GROUP */}
            <div>
              <label
                htmlFor="tag-group"
                className="mb-2 block text-sm font-semibold"
                style={{
                  color: UI.text,
                }}
              >
                Tag Group{" "}
                <span
                  className="font-normal"
                  style={{
                    color: UI.mutedText,
                  }}
                >
                  (Optional)
                </span>
              </label>

              <input
                id="tag-group"
                type="text"
                value={tagGroup}
                onChange={(e) =>
                  setTagGroup(e.target.value)
                }
                placeholder="e.g. Priority"
                disabled={loading}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: UI.cardBg,
                  borderColor: UI.border,
                  color: UI.text,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor =
                    UI.primary;
                  e.currentTarget.style.boxShadow =
                    `0 0 0 3px var(--color-primary-ring)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor =
                    UI.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              />

              <p
                className="mt-2 text-xs"
                style={{
                  color: UI.mutedText,
                }}
              >
                Group logically connects similar tags.
              </p>
            </div>

            {/* =================================================
                ACTIONS
            ================================================= */}
            <div
              className="flex items-center justify-end gap-3 border-t pt-5"
              style={{
                borderColor: UI.border,
              }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={navigateToTags}
                className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: UI.cardBg,
                  borderColor: UI.border,
                  color: UI.text,
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: UI.primary,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor =
                      UI.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    UI.primary;
                }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {loading ? "Saving..." : "Save Tag"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}