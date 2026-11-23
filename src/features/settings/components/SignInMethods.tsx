/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, LogIn } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Input, Modal } from "@/components/ui";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import GoogleSignInButton from "@/features/auth/components/GoogleSignInButton";
import { GoogleSignInStatus, getGoogleSignInStatus, linkGoogle, startGoogleLink } from "@/features/auth/google";

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Profile card: connect Google to an email/password account, or set a password on a Google-only account. */
export default function SignInMethods() {
  const [status, setStatus] = useState<GoogleSignInStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const load = useCallback(() => {
    getGoogleSignInStatus()
      .then((s) => {
        setStatus(s);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  // Google sign-in not deployed / not configured: nothing to show.
  if (failed || !status) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-4">
        <LogIn size={15} className="stroke-[2.2]" />
        <span>Sign-in methods</span>
      </div>

      <div className="divide-y divide-border">
        <MethodRow
          icon={<span className="text-base font-bold text-foreground">G</span>}
          title="Google"
          subtitle={status.google_connected ? "You can log in with your Google account." : "Log in with one click using Google."}
          connected={status.google_connected}
          action={
            !status.google_connected && status.has_password ? (
              <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
                Connect Google
              </Button>
            ) : null
          }
        />
        <MethodRow
          icon={<KeyRound size={16} className="text-foreground" />}
          title="Email & password"
          subtitle={status.has_password ? "You can log in with your email and password." : "Add a password to also log in with your email."}
          connected={status.has_password}
          action={
            !status.has_password ? (
              <Button size="sm" variant="outline" onClick={() => setPasswordOpen(true)}>
                Set a password
              </Button>
            ) : null
          }
        />
      </div>

      {connectOpen && (
        <ConnectGoogleModal
          onClose={() => setConnectOpen(false)}
          onConnected={() => {
            setConnectOpen(false);
            load();
          }}
        />
      )}
      {passwordOpen && (
        <SetPasswordModal
          onClose={() => setPasswordOpen(false)}
          onDone={() => {
            setPasswordOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function MethodRow({ icon, title, subtitle, connected, action }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  connected: boolean;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {connected ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-xs font-bold text-success">
          <CheckCircle2 size={13} />
          {title === "Google" ? "Connected" : "Set"}
        </span>
      ) : (
        action
      )}
    </div>
  );
}

/** Step 1: current dashboard password. Step 2: pick the Google account with the same email. */
function ConnectGoogleModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [step, setStep] = useState<"password" | "google">("password");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Read at callback time; cleared as soon as the modal closes.
  const passwordRef = useRef("");
  passwordRef.current = password;

  const onCredential = async (credential: string, flowToken: string) => {
    setError("");
    try {
      await linkGoogle(credential, flowToken, passwordRef.current);
      setPassword("");
      toast.success("Google account connected");
      onConnected();
    } catch (err: any) {
      setError(err?.message || "Couldn't connect Google");
      if (err?.code === "GOOGLE_PASSWORD_REQUIRED") {
        setPassword("");
        setStep("password");
      }
      throw err;
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title="Connect Google"
      description={
        step === "password"
          ? "Confirm it's you with your current dashboard password (not your Google password)."
          : "Choose the Google account that uses the same email as this account."
      }
    >
      {step === "password" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!password) return setError("Enter your current password");
            setError("");
            setStep("google");
          }}
          className="space-y-4"
        >
          <Input
            type="password"
            label="Current password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            error={error || undefined}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <GoogleSignInButton text="continue_with" start={startGoogleLink} onCredential={onCredential} />
          {error && <p className="text-center text-xs text-error">{error}</p>}
          <button type="button" onClick={() => setStep("password")} className="mx-auto block text-xs font-medium text-muted-foreground hover:text-foreground">
            Back
          </button>
        </div>
      )}
    </Modal>
  );
}

function SetPasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!STRONG_PASSWORD.test(password)) return setError("Use 8+ characters with upper and lowercase letters, a number and a symbol.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSaving(true);
    setError("");
    try {
      await soft7AxiosInstance.post("/auth/change-password", { new_password: password });
      toast.success("Password set. You can now also log in with your email.");
      onDone();
    } catch (err: any) {
      const data = err?.response?.data;
      setError((typeof data?.error === "string" ? data.error : data?.error?.message) || data?.message || "Couldn't set the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="sm" title="Set a password" description="Log in with your email and this password, as well as Google.">
      <form onSubmit={submit} className="space-y-4">
        <Input type="password" label="New password" autoFocus autoComplete="new-password" value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          helperText="8+ characters with upper and lowercase letters, a number and a symbol." />
        <Input type="password" label="Confirm password" autoComplete="new-password" value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }} error={error || undefined} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={saving}>Set password</Button>
        </div>
      </form>
    </Modal>
  );
}
