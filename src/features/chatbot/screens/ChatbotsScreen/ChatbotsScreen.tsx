/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, Trash2, FileEdit, Bot as BotIcon, LayoutTemplate } from "lucide-react";
import { Switch, Table, Tabs } from "@/components/ui";
import ChatbotTemplatesPanel from "../../templates/ChatbotTemplatesPanel";
import styles from "../../chatbot.module.css";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mutationPending = useRef(false);
  const [tab, setTab] = useState<"bots" | "templates">("bots");

  // ?tab=templates opens the Templates tab directly.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "templates") setTab("templates");
  }, []);

  const changeTab = (id: string) => {
    const next = id === "templates" ? "templates" : "bots";
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "templates") url.searchParams.set("tab", "templates"); else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  };

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
    if (mutationPending.current) return;
    if (!confirm("Are you sure you want to delete this chatbot?")) return;
    mutationPending.current = true;
    setDeletingId(id);

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
    } finally {
      mutationPending.current = false;
      setDeletingId(null);
    }
  }

  async function handlePublish(id: string, publish: boolean) {
    if (mutationPending.current) return;
    mutationPending.current = true;
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
        setBots(previous => previous.map(bot => bot.id === id
          ? { ...bot, published: publish, status: publish ? "published" : "draft" }
          : bot));
      } else {
        toast.error(response.data.message || "Failed to update publish state");
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update publish state";

      toast.error(errorMessage);
    } finally {
      mutationPending.current = false;
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

        <Tabs className="mb-6" activeTab={tab} onChange={changeTab} tabs={[
          { id: "bots", label: "Your Chatbots", icon: <BotIcon size={16} />, count: bots.length },
          {
            id: "templates",
            icon: <LayoutTemplate size={16} />,
            label: (
              <span className="inline-flex items-center gap-2">
                Templates
                <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-text">New</span>
              </span>
            ),
          },
        ]} />

        {tab === "templates" ? (
          <ChatbotTemplatesPanel />
        ) : loading ? (
          <div className={styles.chatbotLoading}>
            <div className={styles.chatbotSpinner} />
            <p>Loading your chatbots...</p>
          </div>
        ) : bots.length === 0 ? (
          <div className={styles.chatbotEmpty}>
            <div className={styles.chatbotEmptyIcon}>
              <Sparkles size={32} color="var(--color-primary-text)" />
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
          <Table<Bot>
            data={[...bots].sort((a, b) => Number(b.published) - Number(a.published))}
            rowKey={bot => bot.id}
            columns={[
              {
                key: "name", header: "Chatbot Name", width: "30%",
                render: bot => (
                  <Link href={`/user/chatbot/${bot.id}/builder`}
                    className="block min-w-40 whitespace-normal font-semibold text-foreground hover:text-primary-text hover:underline break-words">
                    {bot.name}
                  </Link>
                ),
              },
              {
                key: "description", header: "Description", width: "40%",
                render: bot => <span className="block min-w-48 max-w-xl whitespace-normal text-muted-foreground break-words">{bot.description || "No description provided"}</span>,
              },
              {
                key: "published", header: "Publish", width: "15%",
                render: bot => (
                  <div className="flex items-center gap-3 whitespace-nowrap" aria-busy={publishingId === bot.id}>
                    <Switch
                      checked={bot.published}
                      onCheckedChange={checked => handlePublish(bot.id, checked)}
                      disabled={publishingId !== null || deletingId !== null}
                      aria-label={`Publish ${bot.name}`}
                    />
                    {publishingId === bot.id && <span role="status" className="text-xs text-muted-foreground">Saving...</span>}
                  </div>
                ),
              },
              {
                key: "actions", header: "Actions", width: "15%",
                render: bot => (
                  <div className="flex items-center gap-2">
                    <Link href={`/user/chatbot/${bot.id}/builder`}
                      className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-primary-text hover:bg-surface-hover"
                      aria-label={`Open builder for ${bot.name}`} title="Open builder">
                      <FileEdit size={18} />
                    </Link>
                    <button type="button" onClick={() => handleDelete(bot.id)}
                      disabled={publishingId !== null || deletingId !== null}
                      className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-error hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Delete ${bot.name}`} title="Delete chatbot">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
