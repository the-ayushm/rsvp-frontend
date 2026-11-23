/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import styles from "../../chatbot.module.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

const BuilderCanvas = dynamic(
  () => import("@/features/chatbot/components/builder/BuilderCanvas"),
  { ssr: false }
);

export default function BuilderPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = use(props.params);

  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBot = async () => {
      setLoading(true);

      try {
        const response = await soft7AxiosInstance.get(`/admin/chatbot/${id}`);

        if (response.data.success && response.data.data) {
          setBot(response.data.data);
        } else {
          setBot(null);
          toast.error(response.data.message || "Failed to load chatbot");
        }
      } catch (error: any) {
        console.error("Failed to fetch chatbot:", error);

        if (error?.response?.status === 404) {
          toast.error("Chatbot not found");
        } else {
          toast.error(
            error?.response?.data?.message || "Failed to load chatbot"
          );
        }

        setBot(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchBot();
    }
  }, [id]);

  if (loading) {
    return (
      <div className={styles.chatbotBuilderCenter}>
        <div className={styles.chatbotBuilderLoading}>
          <div className={styles.chatbotBuilderLoader}>
            <div className={styles.chatbotBuilderLoaderInner}>
              <Loader2
                size={30}
                style={{
                  animation: "chatbotSpin 1s linear infinite",
                }}
              />
            </div>
          </div>

          <p className={styles.chatbotBuilderLoadingText}>
            Loading builder...
          </p>
        </div>
      </div>
    );
  }

  if (!bot?.id) {
    return (
      <div className={styles.chatbotBuilderCenter}>
        <div className={styles.chatbotError}>
          <div className={styles.chatbotErrorIcon}>⚠️</div>

          <h2 className={styles.chatbotErrorTitle}>Chatbot Not Found</h2>

          <p className={styles.chatbotErrorText}>
            The chatbot you&apos;re looking for doesn&apos;t exist or has been
            deleted.
          </p>

          <a
            href="/user/chatbot"
            className={`${styles.chatbotBtn} ${styles.chatbotBtnPrimary}`}
          >
            Back to Chatbots
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatbotBuilderPage}>
      <BuilderCanvas bot={bot} apiBase="/api/user/chatbots" />
    </div>
  );
}
