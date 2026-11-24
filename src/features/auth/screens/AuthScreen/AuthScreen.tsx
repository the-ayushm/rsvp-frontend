/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Phone,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  Key,
  ChevronDown,
  MessageSquare,
  Users,
  BarChart3,
  ArrowLeft,
  ShieldCheck,
  X,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";
import { getFirstPermittedRoute, hasPermissionKey } from "@/lib/permissions";
import GoogleSignInButton from "@/features/auth/components/GoogleSignInButton";
import AuthProgressOverlay from "@/features/auth/components/AuthProgressOverlay";
import { completeGoogleLogin, startGoogleLogin } from "@/features/auth/google";
import { DoveKnotLogo } from "@/components/brand/DoveKnotLogo";
import "./auth.css";

type ForgotStep = "request" | "verify" | "reset";

const FIXED_COMPANY_ID = "ae815512-cf4b-4e7e-8472-16d3c2d4bb18";

function maskEmail(email: string) {
  if (!email || !email.includes("@")) return email;
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `**@${domain}`;
  const visible = name.slice(0, 2);
  const hidden = "*".repeat(name.length - 2);
  return `${visible}${hidden}@${domain}`;
}

function maskPhone(phone: string) {
  if (!phone || phone.length < 4) return "*".repeat(phone.length || 10);
  const visible = phone.slice(-4);
  const hidden = "*".repeat(phone.length - 4);
  return `${hidden}${visible}`;
}

// ── Shared style helpers ──────────────────────────────────────────────
const inputClass = (hasError?: boolean) =>
  `w-full h-12 rounded-xl border bg-background/60 pl-11 pr-11 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors duration-200 focus:ring-4 ${
    hasError
      ? "border-destructive/60 focus:border-destructive focus:ring-destructive/10"
      : "border-border focus:border-accent focus:ring-accent/10"
  }`;

const iconWrapClass =
  "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/55";

const primaryBtnClass =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-accent-foreground shadow-[0_10px_25px_-10px_rgba(var(--color-primary-rgb),0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(var(--color-primary-rgb),0.65)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-60 disabled:hover:translate-y-0";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 ml-1 text-xs text-destructive">{message}</p>;
}

function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

const PASSWORD_RULES = [
  { label: "8+ characters", test: (v: string) => v.length >= 8 },
  { label: "Upper & lowercase", test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number", test: (v: string) => /\d/.test(v) },
  { label: "A symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];
const isStrongPassword = (v: string) => PASSWORD_RULES.every((r) => r.test(v));

/** Live checklist under the sign-up password instead of one long error line. */
function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-[12px] transition-colors ${
              ok ? "text-success" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                ok ? "border-success bg-success text-primary-foreground" : "border-border-strong"
              }`}
            >
              {ok && <Check size={10} strokeWidth={3} />}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

export default function AuthPage() {
  const [isForgotActive, setIsForgotActive] = useState(false);
  const [isRegisterActive, setIsRegisterActive] = useState(false);
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>(
    {},
  );
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerPassword, setRegisterPassword] = useState("");

  // ── Country code picker ──
  const ALL_COUNTRIES = [
    { dialCode: "+91", name: "India", flag: "🇮🇳" },
    { dialCode: "+1", name: "United States", flag: "🇺🇸" },
    { dialCode: "+44", name: "United Kingdom", flag: "🇬🇧" },
    { dialCode: "+971", name: "UAE", flag: "🇦🇪" },
    { dialCode: "+61", name: "Australia", flag: "🇦🇺" },
    { dialCode: "+1", name: "Canada", flag: "🇨🇦" },
    { dialCode: "+86", name: "China", flag: "🇨🇳" },
    { dialCode: "+33", name: "France", flag: "🇫🇷" },
    { dialCode: "+49", name: "Germany", flag: "🇩🇪" },
    { dialCode: "+62", name: "Indonesia", flag: "🇮🇩" },
    { dialCode: "+39", name: "Italy", flag: "🇮🇹" },
    { dialCode: "+81", name: "Japan", flag: "🇯🇵" },
    { dialCode: "+60", name: "Malaysia", flag: "🇲🇾" },
    { dialCode: "+52", name: "Mexico", flag: "🇲🇽" },
    { dialCode: "+31", name: "Netherlands", flag: "🇳🇱" },
    { dialCode: "+64", name: "New Zealand", flag: "🇳🇿" },
    { dialCode: "+234", name: "Nigeria", flag: "🇳🇬" },
    { dialCode: "+92", name: "Pakistan", flag: "🇵🇰" },
    { dialCode: "+63", name: "Philippines", flag: "🇵🇭" },
    { dialCode: "+7", name: "Russia", flag: "🇷🇺" },
    { dialCode: "+966", name: "Saudi Arabia", flag: "🇸🇦" },
    { dialCode: "+27", name: "South Africa", flag: "🇿🇦" },
    { dialCode: "+82", name: "South Korea", flag: "🇰🇷" },
    { dialCode: "+34", name: "Spain", flag: "🇪🇸" },
    { dialCode: "+94", name: "Sri Lanka", flag: "🇱🇰" },
    { dialCode: "+46", name: "Sweden", flag: "🇸🇪" },
    { dialCode: "+41", name: "Switzerland", flag: "🇨🇭" },
    { dialCode: "+66", name: "Thailand", flag: "🇹🇭" },
    { dialCode: "+90", name: "Turkey", flag: "🇹🇷" },
    { dialCode: "+380", name: "Ukraine", flag: "🇺🇦" },
    { dialCode: "+84", name: "Vietnam", flag: "🇻🇳" },
    { dialCode: "+20", name: "Egypt", flag: "🇪🇬" },
    { dialCode: "+55", name: "Brazil", flag: "🇧🇷" },
    { dialCode: "+57", name: "Colombia", flag: "🇨🇴" },
    { dialCode: "+880", name: "Bangladesh", flag: "🇧🇩" },
  ];
  const [selectedCountry, setSelectedCountry] = useState(ALL_COUNTRIES[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  // ──────────────────────────

  const [forgotStep, setForgotStep] = useState<ForgotStep>("request");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [timer, setTimer] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(true);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [adminSecret, setAdminSecret] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Close country dropdown on outside click
  useEffect(() => {
    if (!showCountryDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCountryDropdown(false);
        setCountrySearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCountryDropdown]);

  // Clear auth data ONLY if no active session exists.
  // Previously this ran unconditionally on every mount — if the router.replace()
  // after login hadn't completed yet, the auth page was still mounted and would
  // wipe the freshly-set token, causing an immediate session expiry.
  useEffect(() => {
    const hasActiveToken =
      localStorage.getItem("console_access_token") ||
      document.cookie.includes("consoleAccessToken=") ||
      document.cookie.includes("accessToken=");

    if (hasActiveToken) {
      // A valid session exists — do NOT clear. The middleware / router will
      // redirect the user to their dashboard automatically.
      return;
    }

    // No active session → safe to wipe any stale data
    const cookieNames = [
      "consoleAccessToken",
      "accessToken",
      "refreshToken",
      "adminToken",
      "company_id",
      "user_role",
      "console_access_token",
    ];
    cookieNames.forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
    localStorage.clear();
  }, []);

  // Stores the session and routes the user in; shared by password and Google sign-in.
  const [signedIn, setSignedIn] = useState<{ title: string; subtitle: string } | null>(null);
  const completeLogin = (data: any, isNewUser = false): boolean => {
    const token = data?.data?.token;
    const user = data?.data?.data;
    const companyId = user?.company_id;
    const permissions: string[] = user?.permissions ?? user?.permission ?? [];
    const role = String(user?.role ?? "")
      .trim()
      .toLowerCase();
    const status = String(user?.status ?? "")
      .trim()
      .toLowerCase();
    const allowedRoles = ["user", "member", "viewer"];

    if (status === "suspended" || status === "suspend") {
      setLoginErrors({
        general: "Your account has been suspended. Please contact support.",
      });
      toast.error("Your account has been suspended. Please contact support.");
      return false;
    }

    if (!allowedRoles.includes(role)) {
      setLoginErrors({
        general:
          "Access denied. You do not have permission to access this portal.",
      });
      toast.error(
        "Access denied. You do not have permission to access this portal.",
      );
      return false;
    }

    if (token) {
      localStorage.setItem("console_access_token", token);
      document.cookie = `consoleAccessToken=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    }
    if (user) localStorage.setItem("user_data", JSON.stringify(user));
    if (companyId) localStorage.setItem("company_id", companyId);

    const isTeam = ["member", "viewer"].includes(String(role || "").toLowerCase());
    if (isTeam) {
      localStorage.setItem("permissions", JSON.stringify(permissions || []));
    } else if (permissions.length > 0) {
      localStorage.setItem("permissions", JSON.stringify(permissions));
    } else {
      localStorage.removeItem("permissions");
    }

    const firstName = String(user?.name ?? "").trim().split(/\s+/)[0];
    setSignedIn(
      isNewUser
        ? { title: "Your account is ready!", subtitle: "Setting up your console…" }
        : { title: firstName ? `Welcome back, ${firstName}!` : "Welcome back!", subtitle: "Taking you to your dashboard…" },
    );

    if (isTeam) {
      const targetRoute = hasPermissionKey(permissions || [], "dashboard")
        ? "/user/dashboard"
        : getFirstPermittedRoute(permissions || []) || "/user/dashboard";
      router.replace(targetRoute);
    } else {
      router.replace("/user/dashboard");
    }
    queryClient.invalidateQueries({ queryKey: ["user-role"] });
    return true;
  };

  // ✅ LOGIN MUTATION
  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const domain_name =
        typeof window !== "undefined" ? window.location.hostname : "";

      const res = await soft7AxiosInstance.post("/auth/login", {
        identifier: email,
        password,
        domain_name,
      });

      return res.data;
    },
    onMutate: () => setLoginErrors({}),
    onError: async (error: any, variables) => {
      const data = error?.response?.data;

      const backendMsg =
        typeof data?.error === "string"
          ? data.error
          : data?.error?.message || data?.message || "Login failed";

      const normalizedMsg = String(backendMsg).toLowerCase();

      let finalMsg = backendMsg;

      if (normalizedMsg.includes("account is not active")) {
        try {
          const roleRes = await soft7AxiosInstance.post("/auth/get-role", {
            identifier: variables.email,
          });

          const userStatus = String(
            roleRes?.data?.data?.status || roleRes?.data?.status || "",
          )
            .trim()
            .toLowerCase();

          if (userStatus === "suspended" || userStatus === "suspend") {
            finalMsg =
              "Your account has been suspended. Please contact support.";
          } else if (userStatus === "inactive") {
            finalMsg =
              "This account is inactive, but login is currently blocked by the server.";
          }
        } catch {
          finalMsg = backendMsg;
        }
      }

      if (normalizedMsg.includes("suspended")) {
        finalMsg = "Your account has been suspended. Please contact support.";
      }

      setLoginErrors({ general: finalMsg });
      toast.error(finalMsg);
    },
    onSuccess: (data) => completeLogin(data),
  });

  // ✅ GOOGLE SIGN-IN / SIGN-UP (same API for both tabs; a first sign-in creates the user)
  const [googleOff, setGoogleOff] = useState(false);
  const signInWithGoogle = async (credential: string, flowToken: string) => {
    setLoginErrors({});
    setRegisterErrors({});
    let data: any;
    try {
      data = await completeGoogleLogin(credential, flowToken);
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed", { duration: 6000 });
      throw err;
    }
    // Suspended / wrong role: completeLogin already explained why.
    if (!completeLogin(data, !!data?.data?.is_new_user)) throw new Error("denied");
  };

  const registerMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      phone,
      password,
      role,
      companyId,
    }: any) => {
      const currentDomain =
        typeof window !== "undefined" ? window.location.hostname : "";
      const { data } = await soft7AxiosInstance.post("/auth/register", {
        name,
        email,
        phone,
        password,
        role,
        company_id: companyId,
        domain_name: currentDomain,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success("Registration successful 🎉");
        setIsRegisterActive(false);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Registration failed ❌");
    },
  });

  //  SEND OTP MUTATION
  const sendOtpMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await soft7AxiosInstance.post("/auth/send-otp", {
        email,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setForgotStep("verify");
      setTimer(60);
      setIsEditingDetails(false);
      setEmailError("");
      toast.success(`OTP sent to ${maskEmail(email)}`);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      const errorMsg =
        data?.message ||
        (typeof data?.error === "string" ? data.error : data?.error?.message) ||
        "Failed to send OTP";
      toast.error(errorMsg);
      setEmailError(errorMsg);
    },
  });

  //  VERIFY OTP MUTATION
  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const response = await soft7AxiosInstance.post("/auth/verify-otp", {
        email,
        otp,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const token =
        data?.data?.token ||
        data?.token ||
        data?.resetToken ||
        data?.data?.resetToken;
      if (token) {
        setResetToken(token);
      }
      toast.success(data?.message || "OTP verified successfully!");
      setOtpError(false);
      setForgotStep("reset");
    },
    onError: (error: any) => {
      setOtpError(true);
      const data = error?.response?.data;
      const errorMessage =
        data?.message ||
        (typeof data?.error === "string" ? data.error : data?.error?.message) ||
        "Invalid OTP. Please try again.";
      toast.error(errorMessage);
    },
  });

  // ✅ RESET PASSWORD MUTATION
  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      token,
      newPassword,
    }: {
      token: string;
      newPassword: string;
    }) => {
      const response = await soft7AxiosInstance.post("/auth/reset-password", {
        token: token,
        newPassword: newPassword,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Password updated successfully!");
      setIsForgotActive(false);
      setForgotStep("request");
      setEmail("");
      setPhone("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setResetToken("");
      setIsEditingDetails(true);
      setTimeout(() => {
        router.push("/auth");
        toast.success("Please login with your new password");
      }, 2000);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      const errorMsg =
        data?.message ||
        (typeof data?.error === "string" ? data.error : data?.error?.message) ||
        "Failed to reset password";
      toast.error(errorMsg);
      setPasswordError(errorMsg);
    },
  });

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    loginMutation.mutate({
      email: form.get("email") as string,
      password: form.get("password") as string,
    });
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setRegisterErrors((prev) => ({
        ...prev,
        email: "Please enter a valid email address",
      }));
      return;
    }
    if (!isStrongPassword(registerPassword)) {
      setRegisterErrors((prev) => ({
        ...prev,
        password: "Please meet all the password requirements below",
      }));
      return;
    }
    registerMutation.mutate({
      name: form.get("name") as string,
      email,
      phone: `${selectedCountry.dialCode}${form.get("phone") as string}`,
      password: registerPassword,
      role,
      adminSecret,
      companyId: FIXED_COMPANY_ID,
    });
  };

  const handleSendOtp = async () => {
    setEmailError("");
    if (!email || email.trim() === "") {
      toast.error("Please enter your email");
      setEmailError("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      setEmailError("Invalid email format");
      return;
    }
    if (channel === "whatsapp" && !phone) {
      toast.error("Please enter your phone number");
      return;
    }
    sendOtpMutation.mutate({ email });
  };

  const handleVerifyOtp = async () => {
    setOtpError(false);
    if (!otp || otp.trim() === "") {
      toast.error("Please enter OTP");
      setOtpError(true);
      return;
    }
    if (otp.length !== 6) {
      toast.error("OTP must be 6 digits");
      setOtpError(true);
      return;
    }
    if (!/^\d+$/.test(otp)) {
      toast.error("OTP must contain only numbers");
      setOtpError(true);
      return;
    }
    verifyOtpMutation.mutate({ email, otp });
  };

  const handleResetPassword = async () => {
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      setPasswordError("Passwords do not match");
      return;
    }
    if (!newPassword || newPassword.trim() === "") {
      toast.error("Please enter a password");
      setPasswordError("Password is required");
      return;
    }
    const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/.test(
      newPassword,
    );
    if (!passwordValid) {
      toast.error(
        "Password must be 8+ chars, include upper, lower, and special character",
      );
      setPasswordError(
        "Password must be 8+ chars with uppercase, lowercase, and special character",
      );
      return;
    }
    if (!resetToken) {
      toast.error("Reset token not found. Please verify OTP again.");
      return;
    }
    resetPasswordMutation.mutate({ token: resetToken, newPassword });
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    handleSendOtp();
  };

  const clearFieldError = (form: "login" | "register", field: string) => {
    if (form === "login") {
      setLoginErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    } else {
      setRegisterErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const filteredCountries = ALL_COUNTRIES.filter((c) =>
    `${c.name} ${c.dialCode}`
      .toLowerCase()
      .includes(countrySearch.toLowerCase()),
  );

  const openForgot = () => {
    setIsForgotActive(true);
    setLoginErrors({});
  };

  const closeForgot = () => {
    setIsForgotActive(false);
    setIsEditingDetails(true);
    setEmailError("");
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      {/* Background: soft brand gradients, drifting glows and a faded dot grid */}
      <div aria-hidden className="auth-bg pointer-events-none absolute inset-0" />
      <div aria-hidden className="auth-blob auth-blob-a pointer-events-none absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full" />
      <div aria-hidden className="auth-blob auth-blob-b pointer-events-none absolute -bottom-40 -right-24 h-[520px] w-[520px] rounded-full" />
      <div aria-hidden className="auth-dots pointer-events-none absolute inset-0" />

      {/* Auth card */}
      <div className="auth-card-in auth-card relative grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-border bg-card lg:grid-cols-[0.9fr_1fr]">
        {/* ── Brand panel ── */}
        <div className="auth-brand-panel relative hidden flex-col overflow-hidden p-10 text-white lg:flex">
          <div aria-hidden className="auth-panel-dots pointer-events-none absolute inset-0" />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />

          <div className="relative">
            <DoveKnotLogo light priority />
            <h1 className="mt-10 max-w-sm font-display text-[32px] font-semibold leading-[1.16] text-white">
              {isRegisterActive ? "Start growing on WhatsApp today" : "Welcome back! Let's continue your journey"}
            </h1>
            <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-white/70">
              Campaigns, chatbots and your team inbox, all in one place.
            </p>
          </div>

          {/* Animated visual */}
          <div className="relative flex flex-1 items-center justify-center py-8">
            <div className="relative h-[240px] w-[240px]">
              <div className="absolute inset-0 rounded-full border border-primary-foreground/25 animate-[spin_18s_linear_infinite]" />
              <div className="absolute inset-6 rounded-full border border-dashed border-primary-foreground/20 animate-[spin_24s_linear_infinite_reverse]" />
              <div className="absolute inset-12 rounded-full bg-primary-foreground/5" />

              <div className="absolute -left-4 top-10 animate-[float_4s_ease-in-out_infinite] rounded-2xl bg-card px-3.5 py-2.5 text-foreground shadow-xl">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-xs font-semibold">Messages</span>
                </div>
              </div>
              <div className="absolute -right-4 bottom-8 animate-[float_4s_ease-in-out_infinite_1s] rounded-2xl bg-card px-3.5 py-2.5 text-foreground shadow-xl">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-primary" />
                  <span className="text-xs font-semibold">Contacts</span>
                </div>
              </div>
              <div className="absolute -right-2 top-6 animate-[float_5s_ease-in-out_infinite_.5s] rounded-2xl bg-card px-3.5 py-2.5 text-foreground shadow-xl">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" />
                  <span className="text-xs font-semibold">Campaigns</span>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-card text-primary shadow-2xl">
                  <MessageSquare size={34} strokeWidth={1.8} />
                </div>
              </div>
            </div>
          </div>

          <ul className="relative space-y-2.5 text-[13.5px] text-white/80">
            {["Bulk campaigns with real-time reports", "No-code chatbots and automations", "One shared inbox for your team"].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Check size={12} strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Form panel ── */}
        <div className="auth-form-panel flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
          {/* Mobile brand mark */}
          <div className="mb-8 lg:hidden">
            <DoveKnotLogo priority />
          </div>

          <div className="mx-auto w-full max-w-[380px]">
            {/* Tab switcher */}
            <div className="relative mb-8 grid grid-cols-2 rounded-xl border border-border bg-muted p-1">
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-card shadow-sm transition-transform duration-300 ease-out ${
                  isRegisterActive ? "translate-x-full" : ""
                }`}
              />
              {([
                ["Log in", false],
                ["Sign up", true],
              ] as const).map(([label, register]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setIsRegisterActive(register);
                    setLoginErrors({});
                    setRegisterErrors({});
                  }}
                  className={`relative z-10 rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                    isRegisterActive === register ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {!isRegisterActive ? (
              <div key="login" className="auth-fade">
                <h2 className="font-display text-[26px] font-bold text-foreground">
                  Welcome back
                </h2>
                <p className="mt-1.5 text-[14px] text-muted-foreground">
                  Log in to continue to your console.
                </p>

                <div className="mt-7">
                  {!googleOff && (
                    <>
                      <GoogleSignInButton
                        text="continue_with"
                        start={startGoogleLogin}
                        onCredential={signInWithGoogle}
                        onUnavailable={() => setGoogleOff(true)}
                      />
                      <OrDivider label="or log in with email" />
                    </>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <div className="relative">
                        <Mail className={iconWrapClass} size={18} />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="you@company.com"
                          onChange={() => clearFieldError("login", "email")}
                          className={inputClass(!!loginErrors.email)}
                        />
                      </div>
                      <FieldError message={loginErrors.email} />
                    </div>

                    <div>
                      <div className="relative">
                        <Lock className={iconWrapClass} size={18} />
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          name="password"
                          required
                          placeholder="Password"
                          onChange={() => clearFieldError("login", "password")}
                          className={inputClass(!!loginErrors.password)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-accent"
                        >
                          {showLoginPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      <FieldError message={loginErrors.password} />
                    </div>

                    <div className="-mt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={openForgot}
                        className="text-[13px] font-medium text-accent hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loginMutation?.isPending}
                      className={primaryBtnClass}
                    >
                      {loginMutation?.isPending ? "Logging in…" : "Log in"}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-[14px] text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterActive(true);
                        setLoginErrors({});
                      }}
                      className="font-semibold text-foreground hover:text-accent"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              <div key="register" className="auth-fade">
                <h2 className="font-display text-[26px] font-bold text-foreground">
                  Create your account
                </h2>
                <p className="mt-1.5 text-[14px] text-muted-foreground">
                  Set up your console in a couple of minutes.
                </p>

                <div className="mt-7">
                  {!googleOff && (
                    <>
                      <GoogleSignInButton
                        text="signup_with"
                        start={startGoogleLogin}
                        onCredential={signInWithGoogle}
                        onUnavailable={() => setGoogleOff(true)}
                      />
                      <OrDivider label="or sign up with email" />
                    </>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <div className="relative">
                        <User className={iconWrapClass} size={18} />
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="Full name"
                          onChange={() => clearFieldError("register", "name")}
                          className={inputClass(!!registerErrors.name)}
                        />
                      </div>
                      <FieldError message={registerErrors.name} />
                    </div>

                    <div>
                      <div className="relative">
                        <Mail className={iconWrapClass} size={18} />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="you@company.com"
                          onChange={() => clearFieldError("register", "email")}
                          className={inputClass(!!registerErrors.email)}
                        />
                      </div>
                      <FieldError message={registerErrors.email} />
                    </div>

                    {role === "ADMIN" && (
                      <div>
                        <div className="relative">
                          <Key className={iconWrapClass} size={18} />
                          <input
                            type="password"
                            placeholder="Admin secret key"
                            value={adminSecret}
                            onChange={(e) => setAdminSecret(e.target.value)}
                            required
                            className={inputClass()}
                          />
                        </div>
                      </div>
                    )}

                    {/* Country code + phone */}
                    <div>
                      <div className="flex">
                        <div
                          ref={countryDropdownRef}
                          className="relative shrink-0"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowCountryDropdown((v) => !v);
                              setCountrySearch("");
                            }}
                            className={`flex h-12 min-w-[104px] items-center justify-center gap-1.5 rounded-l-xl border border-r-0 bg-background/60 px-3 text-[13.5px] font-semibold text-foreground transition-colors hover:bg-muted ${
                              registerErrors.countryCode
                                ? "border-destructive/60"
                                : "border-border"
                            }`}
                          >
                            <span className="text-[17px] leading-none">
                              {selectedCountry.flag}
                            </span>
                            <span>{selectedCountry.dialCode}</span>
                            <ChevronDown
                              size={13}
                              className={`opacity-60 transition-transform ${
                                showCountryDropdown ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {showCountryDropdown && (
                            <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[260px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                              <div className="p-2.5">
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search country…"
                                  value={countrySearch}
                                  onChange={(e) =>
                                    setCountrySearch(e.target.value)
                                  }
                                  className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-[13px] text-foreground outline-none focus:border-accent"
                                />
                              </div>
                              <div className="max-h-[200px] overflow-y-auto">
                                {filteredCountries.map((c, i) => (
                                  <div
                                    key={`${c.name}-${i}`}
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      setShowCountryDropdown(false);
                                      setCountrySearch("");
                                      clearFieldError(
                                        "register",
                                        "countryCode",
                                      );
                                    }}
                                    className={`flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-muted ${
                                      selectedCountry.name === c.name
                                        ? "bg-accent/10 font-semibold text-foreground"
                                        : "text-foreground"
                                    }`}
                                  >
                                    <span className="text-[16px]">
                                      {c.flag}
                                    </span>
                                    <span className="flex-1">{c.name}</span>
                                    <span className="font-semibold text-accent">
                                      {c.dialCode}
                                    </span>
                                  </div>
                                ))}
                                {filteredCountries.length === 0 && (
                                  <div className="px-3.5 py-4 text-center text-[13px] text-muted-foreground">
                                    No countries found
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="relative flex-1">
                          <input
                            type="tel"
                            name="phone"
                            required
                            placeholder="Phone number"
                            maxLength={10}
                            pattern="[0-9]{10}"
                            inputMode="numeric"
                            onInput={(e) => {
                              (e.target as HTMLInputElement).value = (
                                e.target as HTMLInputElement
                              ).value
                                .replace(/\D/g, "")
                                .slice(0, 10);
                            }}
                            onChange={() =>
                              clearFieldError("register", "phone")
                            }
                            className={`h-12 w-full rounded-r-xl border bg-background/60 pl-3.5 pr-11 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:ring-4 ${
                              registerErrors.phone
                                ? "border-destructive/60 focus:border-destructive focus:ring-destructive/10"
                                : "border-border focus:border-accent focus:ring-accent/10"
                            }`}
                          />
                          <Phone
                            size={18}
                            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/55"
                          />
                        </div>
                      </div>
                      <FieldError message={registerErrors.phone} />
                    </div>

                    <div>
                      <div className="relative">
                        <Lock className={iconWrapClass} size={18} />
                        <input
                          type={showRegisterPassword ? "text" : "password"}
                          name="password"
                          required
                          placeholder="Password"
                          value={registerPassword}
                          onChange={(e) => {
                            setRegisterPassword(e.target.value);
                            clearFieldError("register", "password");
                          }}
                          className={inputClass(!!registerErrors.password)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-accent"
                        >
                          {showRegisterPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      <FieldError message={registerErrors.password} />
                      {registerPassword && <PasswordRules value={registerPassword} />}
                    </div>

                    <button
                      type="submit"
                      disabled={registerMutation?.isPending}
                      className={primaryBtnClass}
                    >
                      {registerMutation?.isPending
                        ? "Creating account…"
                        : "Create account"}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-[14px] text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterActive(false);
                        setRegisterErrors({});
                      }}
                      className="font-semibold text-foreground hover:text-accent"
                    >
                      Log in
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sign-in progress / success */}
      {signedIn ? (
        <AuthProgressOverlay phase="success" title={signedIn.title} subtitle={signedIn.subtitle} />
      ) : (
        loginMutation.isPending && (
          <AuthProgressOverlay phase="working" title="Logging you in…" subtitle="Checking your details" />
        )
      )}

      {/* ── Forgot password overlay ── */}
      {isForgotActive && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: "var(--color-overlay)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
            style={{
              backgroundColor: "var(--color-surface-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* ── Terracotta header ── */}
            <div
              className="relative px-7 pb-8 pt-7"
              style={{
                backgroundColor: "var(--color-primary)",
              }}
            >
              {/* decorative circles */}
              <div
                className="pointer-events-none absolute -right-10 -top-14 h-32 w-32 rounded-full"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)",
                }}
              />

              <div
                className="pointer-events-none absolute -bottom-12 right-16 h-24 w-24 rounded-full"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--color-primary-foreground) 6%, transparent)",
                }}
              />

              {/* Close */}
              <button
                type="button"
                onClick={closeForgot}
                className="absolute right-5 top-5 rounded-full p-2 transition-colors hover:bg-surface/10"
                style={{ color: "var(--color-primary-foreground)" }}
              >
                <X size={18} />
              </button>

              {/* Icon */}
              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--color-primary-foreground) 20%, transparent)",
                }}
              >
                {forgotStep === "request" && <Lock size={21} color="var(--color-primary-foreground)" />}

                {forgotStep === "verify" && (
                  <ShieldCheck size={21} color="var(--color-primary-foreground)" />
                )}

                {forgotStep === "reset" && <Key size={21} color="var(--color-primary-foreground)" />}
              </div>

              <h2
                className="font-display text-[24px] font-bold tracking-[-0.02em]"
                style={{ color: "var(--color-primary-foreground)" }}
              >
                {forgotStep === "request" && "Reset your password"}
                {forgotStep === "verify" && "Verify your identity"}
                {forgotStep === "reset" && "Create a new password"}
              </h2>

              <p className="mt-1.5 max-w-[330px] text-[13.5px] leading-5 !text-white">
                We will send you a secure one-time code to verify your account.
              </p>

              {/* Step indicator */}
              <div className="mt-6 flex items-center gap-2">
                {[1, 2, 3].map((step) => {
                  const activeStep =
                    forgotStep === "request"
                      ? 1
                      : forgotStep === "verify"
                        ? 2
                        : 3;

                  return (
                    <div
                      key={step}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: step === activeStep ? "28px" : "10px",
                        backgroundColor:
                          step <= activeStep
                            ? "var(--color-primary-foreground)"
                            : "color-mix(in oklab, var(--color-primary-foreground) 28%, transparent)",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* ── Modal body ── */}
            <div className="px-7 pb-7 pt-7">
              {/* STEP 1 */}
              {forgotStep === "request" && (
                <>
                  {/* Channel selector */}
                  <div
                    className="flex w-full rounded-2xl p-1"
                    style={{
                      backgroundColor: "var(--color-surface-active)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setChannel("email");
                        setEmailError("");
                      }}
                      className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all"
                      style={{
                        backgroundColor:
                          channel === "email" ? "var(--color-surface)" : "transparent",
                        color: channel === "email" ? "var(--color-primary-text)" : "var(--color-text-muted)",
                        boxShadow:
                          channel === "email"
                            ? "var(--elevation-sm)"
                            : "none",
                      }}
                    >
                      Email
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setChannel("whatsapp");
                        setEmailError("");
                      }}
                      className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all"
                      style={{
                        backgroundColor:
                          channel === "whatsapp" ? "var(--color-surface)" : "transparent",
                        color: channel === "whatsapp" ? "var(--color-primary-text)" : "var(--color-text-muted)",
                        boxShadow:
                          channel === "whatsapp"
                            ? "var(--elevation-sm)"
                            : "none",
                      }}
                    >
                      WhatsApp
                    </button>
                  </div>

                  {/* Details */}
                  <div className="mt-6 space-y-4">
                    <div>
                      <label
                        className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em]"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {channel === "whatsapp"
                          ? "Email address"
                          : "Email address"}
                      </label>

                      <div className="relative">
                        <Mail
                          size={17}
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />

                        <input
                          type="email"
                          placeholder="you@company.com"
                          value={isEditingDetails ? email : maskEmail(email)}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError("");
                          }}
                          disabled={!isEditingDetails}
                          className="h-12 w-full rounded-2xl pl-11 pr-4 text-[14px] outline-none transition-all"
                          style={{
                            backgroundColor: "var(--color-surface-active)",
                            border: emailError
                              ? "1px solid var(--color-error)"
                              : "1px solid var(--color-border-strong)",
                            color: "var(--color-text)",
                            caretColor: "var(--color-primary)",
                          }}
                        />
                      </div>

                      {emailError && (
                        <p
                          className="mt-1.5 ml-1 text-xs"
                          style={{ color: "var(--color-error)" }}
                        >
                          {emailError}
                        </p>
                      )}
                    </div>

                    {channel === "whatsapp" && (
                      <div>
                        <label
                          className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em]"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          WhatsApp number
                        </label>

                        <div className="relative">
                          <Phone
                            size={17}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />

                          <input
                            type="tel"
                            placeholder="+919876543210"
                            value={isEditingDetails ? phone : maskPhone(phone)}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={!isEditingDetails}
                            className="h-12 w-full rounded-2xl pl-11 pr-4 text-[14px] outline-none"
                            style={{
                              backgroundColor: "var(--color-surface-active)",
                              border: "1px solid var(--color-border-strong)",
                              color: "var(--color-text)",
                              caretColor: "var(--color-primary)",
                            }}
                          />
                        </div>

                        <p
                          className="mt-1.5 ml-1 text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Include your country code, e.g. +91.
                        </p>
                      </div>
                    )}

                    {!isEditingDetails && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingDetails(true);
                          setEmailError("");
                        }}
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--color-primary-text)" }}
                      >
                        Edit details
                      </button>
                    )}
                  </div>

                  {/* Primary action */}
                  <button
                    onClick={handleSendOtp}
                    disabled={sendOtpMutation.isPending}
                    className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                      boxShadow: "0 12px 24px -8px rgba(var(--color-error-rgb), 0.55)",
                    }}
                  >
                    {sendOtpMutation.isPending
                      ? "Sending…"
                      : "Send verification code"}
                  </button>

                  <button
                    type="button"
                    onClick={closeForgot}
                    className="mx-auto mt-5 flex items-center gap-1.5 text-[13px] font-medium"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <ArrowLeft size={14} />
                    Back to log in
                  </button>
                </>
              )}

              {/* STEP 2 */}
              {forgotStep === "verify" && (
                <>
                  <div
                    className="rounded-2xl px-4 py-3.5"
                    style={{
                      backgroundColor: "var(--color-surface-hover)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p
                      className="text-[13px] leading-5"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Verification code sent to{" "}
                      <span
                        style={{
                          color: "var(--color-text)",
                          fontWeight: 700,
                        }}
                      >
                        {channel === "email"
                          ? maskEmail(email)
                          : maskPhone(phone)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-6">
                    <label
                      className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.04em]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Verification code
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={otp}
                      maxLength={6}
                      onChange={(e) => {
                        setOtp(e.target.value.replace(/\D/g, ""));
                        setOtpError(false);
                      }}
                      className="h-16 w-full rounded-2xl text-center text-[24px] font-bold tracking-[0.55em] outline-none"
                      style={{
                        backgroundColor: "var(--color-surface-active)",
                        border: otpError
                          ? "1px solid var(--color-error)"
                          : "1px solid var(--color-border-strong)",
                        color: "var(--color-text)",
                        caretColor: "var(--color-primary)",
                      }}
                    />

                    {otpError && (
                      <p
                        className="mt-2 text-center text-xs"
                        style={{ color: "var(--color-error)" }}
                      >
                        Please enter a valid 6-digit code
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleVerifyOtp}
                    disabled={verifyOtpMutation.isPending}
                    className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                      boxShadow: "0 12px 24px -8px rgba(var(--color-error-rgb), 0.55)",
                    }}
                  >
                    {verifyOtpMutation.isPending ? "Verifying…" : "Verify code"}
                  </button>

                  <button
                    disabled={timer > 0 || sendOtpMutation.isPending}
                    onClick={handleResendOtp}
                    className="mt-3 h-11 w-full rounded-2xl text-[13px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor: "var(--color-surface-active)",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {timer > 0 ? `Resend code in ${timer}s` : "Resend code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("request");
                      setOtp("");
                      setOtpError(false);
                      setIsEditingDetails(true);
                    }}
                    className="mx-auto mt-5 flex items-center gap-1.5 text-[13px] font-medium"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                </>
              )}

              {/* STEP 3 */}
              {forgotStep === "reset" && (
                <>
                  <div
                    className="rounded-2xl px-4 py-3.5"
                    style={{
                      backgroundColor: "var(--color-surface-hover)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p
                      className="text-[13px] leading-5"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Create a new password for your account. Make sure it is
                      something secure and easy for you to remember.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3.5">
                    <div className="relative">
                      <Lock
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />

                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordError("");
                        }}
                        className="h-12 w-full rounded-2xl pl-11 pr-4 text-[14px] outline-none"
                        style={{
                          backgroundColor: "var(--color-surface-active)",
                          border: passwordError
                            ? "1px solid var(--color-error)"
                            : "1px solid var(--color-border-strong)",
                          color: "var(--color-text)",
                          caretColor: "var(--color-primary)",
                        }}
                      />
                    </div>

                    <div className="relative">
                      <Lock
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />

                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError("");
                        }}
                        className="h-12 w-full rounded-2xl pl-11 pr-4 text-[14px] outline-none"
                        style={{
                          backgroundColor: "var(--color-surface-active)",
                          border: passwordError
                            ? "1px solid var(--color-error)"
                            : "1px solid var(--color-border-strong)",
                          color: "var(--color-text)",
                          caretColor: "var(--color-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="mt-3 flex items-center gap-1.5 text-[13px] font-medium"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}

                    {showNewPassword ? "Hide passwords" : "Show passwords"}
                  </button>

                  {passwordError && (
                    <p className="mt-2 text-xs" style={{ color: "var(--color-error)" }}>
                      {passwordError}
                    </p>
                  )}

                  <p
                    className="mt-3 text-[11.5px] leading-5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Use 8+ characters with uppercase, lowercase and a special
                    character.
                  </p>

                  <button
                    onClick={handleResetPassword}
                    disabled={resetPasswordMutation.isPending}
                    className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                      boxShadow: "0 12px 24px -8px rgba(var(--color-error-rgb), 0.55)",
                    }}
                  >
                    {resetPasswordMutation.isPending
                      ? "Updating…"
                      : "Update password"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
