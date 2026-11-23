/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState, Suspense } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupSuccessContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("account_id");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading to show success animation
    setTimeout(() => setLoading(false), 1500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-lighter to-primary-lighter">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)] mx-auto mb-4" />
          <p className="text-secondary-foreground">Completing setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-lighter to-primary-lighter py-12 px-4">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-surface rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-[var(--color-primary-light)] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-[var(--color-primary)]" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-4">
            Successfully Connected!
          </h1>

          <p className="text-lg text-secondary-foreground mb-8">
            Your WhatsApp Business Account has been successfully connected.
            You&apos;ve received <span className="font-bold text-[var(--color-primary)]">100 free credits</span> to get started!
          </p>

          <div className="bg-primary-lighter rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-foreground mb-4">What&apos;s Next?</h2>
            <ul className="space-y-3 text-left">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span className="text-secondary-foreground">
                  Start sending messages to your contacts
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span className="text-secondary-foreground">
                  Create message templates for your business
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                <span className="text-secondary-foreground">
                  Set up automated workflows and campaigns
                </span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center">
            <Link
              href="/user/dashboard"
              className="px-6 py-3 bg-[var(--color-primary-hover)] text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover transition"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/user/inbox"
              className="px-6 py-3 bg-surface-hover text-secondary-foreground rounded-xl font-semibold hover:bg-surface-active transition"
            >
              View Inbox
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-lighter to-primary-lighter">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)] mx-auto mb-4" />
          <p className="text-secondary-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SignupSuccessContent />
    </Suspense>
  );
}
