"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { MESSAGE_MAX_LENGTH, SUBJECT_MAX_LENGTH } from "../state";
import type { LiveSupport } from "../useLiveSupport";

export default function NewChatForm({ support }: { support: LiveSupport }) {
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [adminId, setAdminId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { admins, loadAdmins } = support;

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    // Retrying with unchanged content reuses the same client_request_id.
    const err = await support.startChat({ message, subject, adminId: adminId || undefined });
    setSubmitting(false);
    if (err) setError(err);
  };

  const inputClass =
    "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <label htmlFor="support-admin" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-foreground">
          Talk to
        </label>
        <select
          id="support-admin"
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          className={`${inputClass} cursor-pointer`}
        >
          <option value="">Anyone on the support team</option>
          {admins === null && <option disabled>Loading team…</option>}
          {admins?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name || a.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-subject" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-foreground">
          Topic <span className="font-medium normal-case tracking-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="support-subject"
          value={subject}
          maxLength={SUBJECT_MAX_LENGTH}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Contact import"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="support-message" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-foreground">
          How can we help?
        </label>
        <textarea
          id="support-message"
          value={message}
          autoFocus
          rows={5}
          maxLength={MESSAGE_MAX_LENGTH}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Describe your issue — the more detail, the faster we can help."
          className={`${inputClass} resize-none`}
        />
        {message.length > MESSAGE_MAX_LENGTH - 500 && (
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {message.length.toLocaleString()} / {MESSAGE_MAX_LENGTH.toLocaleString()}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs font-semibold text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !message.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        {submitting ? "Starting chat…" : error ? "Try again" : "Start chat"}
      </button>
      <p className="-mt-2 text-center text-[11px] text-muted-foreground">Ctrl + Enter to send</p>
    </form>
  );
}
