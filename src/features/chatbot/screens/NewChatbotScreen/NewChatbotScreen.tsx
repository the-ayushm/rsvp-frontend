/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import styles from "../../chatbot.module.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

export default function NewBotPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a bot name");
      return;
    }

    setIsLoading(true);

    try {
      const response = await soft7AxiosInstance.post("/admin/chatbot/create", {
        name: name.trim(),
        description: description.trim(),
      });

      const bot = response.data.data;

      if (!bot?.id) {
        throw new Error("Chatbot was created but no chatbot ID was returned");
      }

      toast.success("Chatbot created successfully!");
      router.push(`/user/chatbot/${bot.id}/builder`);
    } catch (error: any) {
      console.error("Failed to create chatbot:", error);

      toast.error(
        error?.response?.data?.message || "Failed to create chatbot"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.chatbotCreatePage}>
      <div className={styles.chatbotCreateContainer}>
        <Link href="/user/chatbot" className={styles.chatbotBackLink}>
          <ArrowLeft size={16} />
          <span>Back to Chatbots</span>
        </Link>

        <div className={styles.chatbotCreateHeader}>
          <div className={styles.chatbotCreateIcon}>
            <Sparkles size={26} />
          </div>

          <h1 className={styles.chatbotCreateTitle}>Create New Chatbot</h1>

          <p className={styles.chatbotCreateSubtitle}>
            Set up your AI assistant in just a few steps
          </p>
        </div>

        <div className={styles.chatbotForm}>
          <form onSubmit={onSubmit} className={styles.chatbotFormContent}>
            <div className={styles.chatbotFormGroup}>
              <label className={styles.chatbotLabel} htmlFor="bot-name">
                Bot Name <span className={styles.chatbotRequired}>*</span>
              </label>

              <input
                id="bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.chatbotInput}
                placeholder="e.g., Customer Support Bot"
                required
                autoComplete="off"
              />

              <p className={styles.chatbotHint}>
                Choose a descriptive name for your chatbot
              </p>
            </div>

            <div className={styles.chatbotFormGroup}>
              <label
                className={styles.chatbotLabel}
                htmlFor="bot-description"
              >
                Description{" "}
                <span className={styles.chatbotOptional}>(Optional)</span>
              </label>

              <textarea
                id="bot-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${styles.chatbotInput} ${styles.chatbotTextarea}`}
                rows={5}
                placeholder="Describe what your chatbot does and how it helps users..."
              />

              <p className={styles.chatbotHint}>
                Add details about your bot&apos;s purpose and capabilities
              </p>
            </div>

            <div className={styles.chatbotFormActions}>
              <button
                type="submit"
                disabled={isLoading}
                className={`${styles.chatbotBtn} ${styles.chatbotBtnPrimary}`}
              >
                {isLoading ? (
                  <>
                    <span className={styles.chatbotSpinner} />
                    Creating...
                  </>
                ) : (
                  "Create Chatbot"
                )}
              </button>

              <Link
                href="/user/chatbot"
                className={`${styles.chatbotBtn} ${styles.chatbotBtnSecondary}`}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <p className={styles.chatbotHelper}>
          You can customize your chatbot settings after creation
        </p>
      </div>
    </div>
  );
}
