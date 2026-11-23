"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react"
import { soft7AxiosInstance } from "@/lib/axiosInstance"
import toast from "react-hot-toast"

function SetupPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!token) {
      setError("Token is missing. Invalid invitation link.")
      toast.error("Token is missing")
      return
    }

    if (!password) {
      setError("Password is required")
      toast.error("Password is required")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      toast.error("Password must be at least 8 characters long")
      return
    }

    const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/.test(password);
    if (!passwordValid) {
      setError("Password must be 8+ chars, include upper, lower, and special character")
      toast.error("Password must be 8+ chars, include upper, lower, and special character")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      toast.error("Passwords do not match")
      return
    }

    try {
      setLoading(true)
      const domain_name = window.location.hostname;
      const res = await soft7AxiosInstance.post("/auth/setup-password", {
        token,
        password,
        domain_name
      })

      if (res.data?.success || res.status === 200) {
        setSuccess(true)
        toast.success("Password set up successfully! 🎉")
        setTimeout(() => {
          router.push("/auth")
        }, 3000)
      } else {
        setError(res.data?.message || "Failed to set up password.")
        toast.error(res.data?.message || "Failed to set up password.")
      }
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string; error?: string } } };
      const msg = errorResponse?.response?.data?.message || errorResponse?.response?.data?.error || "An error occurred. Please try again."
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-white via-primary-lighter to-primary relative overflow-hidden font-sans">
      {/* Floating background circles */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/10 to-primary/5 -top-[300px] -right-[200px] pointer-events-none animate-pulse duration-[8s]"></div>
      <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/8 to-primary/3 -bottom-[300px] -left-[200px] pointer-events-none animate-pulse duration-[10s]"></div>

      <div className="relative w-full max-w-[480px] p-8 md:p-10 bg-surface/40 dark:bg-surface/40 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl z-10 transition-all duration-300 hover:shadow-emerald-500/10 m-4">
        {success ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-[var(--color-primary-light)] dark:bg-primary-light/30 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-text dark:text-[var(--color-primary)]">
              <CheckCircle2 size={48} className="animate-bounce" />
            </div>
            <h2 className="text-3xl font-extrabold text-foreground dark:text-white mb-3 tracking-tight">
              Password Set!
            </h2>
            <p className="text-secondary-foreground dark:text-secondary-foreground mb-6 text-base font-medium">
              Your password has been successfully configured. You are now a team member!
            </p>
            <div className="flex items-center justify-center gap-2 text-primary-text dark:text-[var(--color-primary)] font-semibold animate-pulse">
              <span>Redirecting to login</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-tr from-primary to-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground shadow-lg shadow-emerald-500/25">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground dark:text-white tracking-tight">
                Setup Password
              </h2>
              <p className="text-sm text-secondary-foreground dark:text-secondary-foreground mt-2 font-medium">
                Set a password to complete joining your team.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-error/10 border border-error/20 text-error dark:text-error rounded-xl text-sm font-medium flex items-center gap-2">
                <span className="shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSetupPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground mb-2 ml-1">
                  New Password
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-secondary-foreground group-focus-within:text-primary-text transition-colors z-10">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full h-12 bg-surface/70 dark:bg-surface-raised/70 border-2 border-primary/10 focus:border-primary/80 rounded-full px-5 py-2 pl-12 pr-12 outline-none transition-all duration-300 text-foreground dark:text-white placeholder-muted-foreground focus:ring-4 focus:ring-primary/5 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-secondary-foreground hover:text-primary-text transition-colors z-10"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground mb-2 ml-1">
                  Confirm Password
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-secondary-foreground group-focus-within:text-primary-text transition-colors z-10">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full h-12 bg-surface/70 dark:bg-surface-raised/70 border-2 border-primary/10 focus:border-primary/80 rounded-full px-5 py-2 pl-12 pr-12 outline-none transition-all duration-300 text-foreground dark:text-white placeholder-muted-foreground focus:ring-4 focus:ring-primary/5 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-secondary-foreground hover:text-primary-text transition-colors z-10"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-primary to-primary text-primary-foreground font-semibold text-base uppercase tracking-wider rounded-full shadow-lg hover:from-primary hover:to-primary-hover active:scale-[0.98] transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Setting up password...</span>
                    </>
                  ) : (
                    <span>Set Password & Join</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-white via-primary-lighter to-primary">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <SetupPasswordContent />
    </Suspense>
  )
}
