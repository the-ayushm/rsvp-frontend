
"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { soft7AxiosInstance } from "@/lib/axiosInstance"

type Status = "loading" | "success" | "error" | "expired"

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<Status>("loading")
  const [role, setRole] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      return
    }

    soft7AxiosInstance
      .post("/api/user/team/accept", { token })
      .then((res) => {
        setRole(res.data.role)
        setEmail(res.data.email)
        setStatus("success")
        // Redirect to login after 2 seconds with email prefilled
        setTimeout(() => {
          router.push(
            `/login?email=${encodeURIComponent(res.data.email)}&invited=true`
          )
        }, 2000)
      })
      .catch((err) => {
        const msg = err?.response?.data?.error ?? ""
        setStatus(msg === "expired" ? "expired" : "error")
      })
  }, [token, router])

  const roleEmoji =
    role === "ADMIN" ? "👑" : role === "MEMBER" ? "👥" : "👁️"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-surface px-4">
      <div
        className="bg-surface dark:bg-surface rounded-2xl shadow-xl p-10 max-w-md w-full
          text-center border border-border dark:border-border-subtle"
      >
        {/* ── Loading ── */}
        {status === "loading" && (
          <>
            <div
              className="w-16 h-16 rounded-full bg-info-bg dark:bg-info-bg/30
                flex items-center justify-center mx-auto mb-4 animate-pulse"
            >
              <span className="text-3xl">⏳</span>
            </div>
            <h2 className="text-xl font-bold dark:text-white">
              Verifying your invite...
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">Please wait</p>
          </>
        )}

        {/* ── Success ── */}
        {status === "success" && (
          <>
            <div
              className="w-16 h-16 rounded-full bg-[var(--color-success-light)] dark:bg-primary-light/30
                flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold dark:text-white mb-2">
              Invite Accepted!
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground">
              You&apos;ve joined as{" "}
              <span className="font-bold text-[var(--color-primary)]">
                {roleEmoji} {role}
              </span>
            </p>
            <div
              className="mt-4 px-4 py-3 bg-surface-muted dark:bg-surface-raised rounded-xl
                text-sm text-muted-foreground"
            >
              {email}
            </div>
            <p className="text-sm text-muted-foreground mt-4 animate-pulse">
              Redirecting you to login...
            </p>
          </>
        )}

        {/* ── Expired ── */}
        {status === "expired" && (
          <>
            <div
              className="w-16 h-16 rounded-full bg-warning-bg dark:bg-warning-bg/30
                flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-3xl">⏰</span>
            </div>
            <h2 className="text-2xl font-bold dark:text-white mb-2">
              Link Expired
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground">
              This invite link has expired (48 hour limit).
              <br />
              Please ask your admin to resend the invite.
            </p>
          </>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <>
            <div
              className="w-16 h-16 rounded-full bg-error-bg dark:bg-error-bg/30
                flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold dark:text-white mb-2">
              Invalid Link
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground">
              This invite link is invalid or has already been used.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-info
                text-white rounded-xl font-semibold hover:opacity-90 transition"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}