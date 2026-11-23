/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, Trash2, Globe, FileEdit } from "lucide-react";
import styles from "./chatbot.module.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

type Bot = {
  id: string;
  name: string;
  description?: string;
  status: string;
  published: boolean;
  updatedAt: string;
  phoneNumberId?: string;
  createdAt?: string;
};

export default function ChatbotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    loadBots();
  }, []);

  async function loadBots() {
    setLoading(true);
    try {
      const response = await soft7AxiosInstance.get("/admin/chatbot");

      if (response.data.success && response.data.data) {
        setBots(response.data.data);
      } else if (Array.isArray(response.data)) {
        setBots(response.data);
      } else {
        setBots([]);
      }
    } catch (error: any) {
      console.error("Error loading bots:", error);
      toast.error(error?.response?.data?.message || "Failed to load chatbots");
      setBots([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this chatbot?")) return;

    try {
      const response = await soft7AxiosInstance.delete(`/admin/chatbot/${id}`);

      if (response.data.success) {
        toast.success("Chatbot deleted successfully");
        setBots((prev) => prev.filter((bot) => bot.id !== id));
      } else {
        toast.error(response.data.message || "Failed to delete chatbot");
      }
    } catch (error: any) {
      console.error("Error deleting bot:", error);
      toast.error(error?.response?.data?.message || "Failed to delete chatbot");
    }
  }

  async function handlePublish(id: string, publish: boolean) {
    setPublishingId(id);
    const loadingToast = toast.loading(
      publish ? "Publishing chatbot..." : "Unpublishing chatbot..."
    );

    try {
      const endpoint = publish
        ? `/admin/chatbot/${id}/publish`
        : `/admin/chatbot/${id}/unpublish`;

      const response = await soft7AxiosInstance.put(endpoint);

      toast.dismiss(loadingToast);

      if (response.data.success) {
        toast.success(
          publish
            ? "Chatbot published successfully! Your bot is now live."
            : "Chatbot unpublished successfully. Your bot is now in draft mode."
        );
        await loadBots();
      } else {
        toast.error(response.data.message || "Failed to update publish state");
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update publish state";

      if (
        errorMessage.toLowerCase().includes("already") ||
        errorMessage.toLowerCase().includes("published") ||
        error?.response?.status === 409
      ) {
        toast.error(
          "Cannot publish: another chatbot is already published. Please unpublish it first."
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setPublishingId(null);
    }
  }

  const publishedCount = bots.filter((bot) => bot.published).length;

  return (
    <div className={styles.chatbotPage}>
      <div className={styles.chatbotMaxWidth}>
        <div className={styles.chatbotHeader}>
          <div>
            <div className={styles.chatbotHeaderContent}>
              <div className={styles.chatbotIcon}>
                <Sparkles size={20} />
              </div>
              <h1 className={styles.chatbotTitle}>Your Chatbots</h1>
            </div>

            <p className={styles.chatbotSubtitle}>
              Manage and deploy your AI assistants
            </p>
          </div>

          <Link
            href="/user/chatbot/new"
            className={`${styles.chatbotBtn} ${styles.chatbotBtnPrimary}`}
          >
            <Plus size={20} strokeWidth={2.25} />
              <span>
                              Create Chatbot
              </span>
          </Link>
        </div>

        <div className={styles.chatbotStats}>
          <div className={styles.chatbotStatCard}>
            <div className={styles.chatbotStatLabel}>Total Bots</div>
            <div className={styles.chatbotStatValue}>{bots.length}</div>
          </div>

          <div className={styles.chatbotStatCard}>
            <div className={styles.chatbotStatLabel}>Published</div>
            <div className={`${styles.chatbotStatValue} ${styles.green}`}>
              {publishedCount}
            </div>
          </div>

          <div className={styles.chatbotStatCard}>
            <div className={styles.chatbotStatLabel}>Drafts</div>
            <div className={`${styles.chatbotStatValue} ${styles.amber}`}>
              {bots.filter((bot) => !bot.published).length}
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.chatbotLoading}>
            <div className={styles.chatbotSpinner} />
            <p>Loading your chatbots...</p>
          </div>
        ) : bots.length === 0 ? (
          <div className={styles.chatbotEmpty}>
            <div className={styles.chatbotEmptyIcon}>
              <Sparkles size={32} color="var(--primary)" />
            </div>

            <h3 className={styles.chatbotEmptyTitle}>No chatbots yet</h3>

            <p className={styles.chatbotEmptyText}>
              Create your first AI assistant to get started
            </p>

            <Link
              href="/user/chatbot/new"
              className={`${styles.chatbotBtn} ${styles.chatbotBtnPrimary}`}
            >
              <Plus size={20} strokeWidth={2.25} />
              <span>
                                Create Your First Bot
              </span>
            </Link>
          </div>
        ) : (
          <div className={styles.chatbotGrid}>
            {[...bots]
              .sort((a, b) => Number(b.published) - Number(a.published))
              .map((bot) => {
              const isPublished = bot.published;
              const isPublishing = publishingId === bot.id;

              return (
                <div key={bot.id} className={styles.chatbotCard}>
                  <div className={styles.chatbotCardAccent} />

                  <div className={styles.chatbotCardContent}>
                    <div className={styles.chatbotCardHeader}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className={styles.chatbotCardTitle}>{bot.name}</h3>

                        <p className={styles.chatbotCardDesc}>
                          {bot.description || "No description provided"}
                        </p>
                      </div>

                      <div
                        className={`${styles.chatbotBadge} ${
                          isPublished
                            ? styles.published
                            : styles.draft
                        }`}
                      >
                        <span
                          className={`${styles.chatbotBadgeDot} ${
                            isPublished ? styles.green : styles.amber
                          }`}
                        />
                        {isPublished ? "Live" : "Draft"}
                      </div>
                    </div>

                    <div className={styles.chatbotActions}>
                      <Link
                        href={`/user/chatbot/${bot.id}/builder`}
                        className={`${styles.chatbotActionBtn} ${styles.builder}`}
                      >
                        <FileEdit size={16} />
                        <span>Builder</span>
                      </Link>

                      {isPublished ? (
                        <button
                          onClick={() => handlePublish(bot.id, false)}
                          disabled={isPublishing}
                          className={`${styles.chatbotActionBtn} ${styles.unpublish}`}
                        >
                          <Globe size={16} />
                          <span>
                            {isPublishing ? "Unpublishing..." : "Unpublish"}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublish(bot.id, true)}
                          disabled={isPublishing}
                          className={`${styles.chatbotActionBtn} ${styles.publish}`}
                        >
                          <Globe size={16} />
                          <span>
                            {isPublishing ? "Publishing..." : "Publish"}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(bot.id)}
                        className={`${styles.chatbotActionBtn} ${styles.delete}`}
                        aria-label={`Delete ${bot.name}`}
                        title="Delete chatbot"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
