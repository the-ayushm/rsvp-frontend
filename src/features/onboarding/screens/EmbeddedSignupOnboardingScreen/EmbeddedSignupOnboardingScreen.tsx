"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, AlertCircle, ChevronLeft } from "lucide-react";
import { useEmbeddedSignup } from "../../useEmbeddedSignup";

export default function WhatsAppSignupPage() {
  const router = useRouter();
  const { loading, sdkReady, error, stage, launch, cancel } = useEmbeddedSignup();
  const isProcessing = stage === "connecting" || stage === "success";
  const isWaiting = stage === "waiting_meta";

if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading signup form...</p>
      </div>
    </div>
  );
}

 if (isProcessing) {
   return (
     <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
       <div className="text-center">
         <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
         <p className="text-foreground">
           Setting up your WhatsApp Business account...
         </p>
         <p className="text-sm text-muted-foreground mt-2">
           Please wait, this may take a moment.
         </p>
       </div>
     </div>
   );
 }


return (
  <div className="min-h-screen bg-background text-foreground py-12 px-4">
    <div id="fb-root" />

    <div className="max-w-2xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl font-semibold border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-8 mb-6">
        {/* Header */}
        <div className="text-center mb-8">
          {/* WhatsApp Icon */}
          <div className="w-20 h-20 bg-[var(--color-primary-light)] dark:bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-14 h-14 text-[var(--color-primary)] dark:text-[var(--color-primary)]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            Connect Your WhatsApp Business Account
          </h1>

          <p className="text-muted-foreground">
            Sign up to start using WhatsApp Business Platform and get started
            with messaging
          </p>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-destructive">{error}</p>
            </div>
            <Link href="/user/integrations/whatsapp" className="mt-3 inline-block text-sm font-medium text-primary-text underline">Check connected accounts</Link>
            {!sdkReady && <button type="button" onClick={() => window.location.reload()} className="ml-4 text-sm font-medium text-primary-text underline">Reload signup</button>}
          </div>
        )}

        {/* Benefits */}
        <div className="bg-secondary/60 rounded-xl p-6 mb-6 border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            What you&apos;ll get:
          </h2>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-foreground">
                Instant access to WhatsApp Business Platform
              </span>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-foreground">
                Free credits to get started (100 credits)
              </span>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-foreground">
                Send and receive messages through WhatsApp
              </span>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-foreground">
                Access to templates and automation features
              </span>
            </li>
          </ul>
        </div>

        {/* Signup Button */}
        <div className="text-center">
          <button
            onClick={launch}
            disabled={!sdkReady || isWaiting}
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-bold text-primary-foreground bg-primary hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {isWaiting ? "Continue in Facebook..." : sdkReady ? "Login with Facebook" : "Loading..."}
          </button>
          {isWaiting && <div role="status" className="mt-4 space-y-2 text-sm text-muted-foreground"><p>Complete the setup in the Facebook popup. We will connect the result to your account automatically.</p><button type="button" onClick={cancel} className="text-primary-text underline">Cancel signup</button></div>}
        </div>

      </div>

      {/* Terms */}
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          By signing up, you agree to our Terms of Service and Privacy Policy.
          Your WhatsApp Business Account will be connected securely through
          Meta&apos;s official Embedded Signup process.
        </p>
      </div>
    </div>
  </div>
);
}
