/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import {
  Save,
  Camera,
  X,
  Shield,
  User,
  Briefcase,
  Activity,
  Mail,
  Phone,
  CheckCircle2,
} from "lucide-react";
import SignInMethods from "@/features/settings/components/SignInMethods";

type Profile = {
  name: string;
  email: string;
  phone: string;
  image: string;
  status: string;
  school: string;
  grade: string;
  role: string;
  location: string;
  joinDate: string;
  department: string;
  bio: string;
  website: string;
};

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    phone: "",
    image: "",
    status: "",
    school: "",
    grade: "",
    role: "",
    location: "",
    joinDate: "",
    department: "",
    bio: "",
    website: "",
  });

  const [tempProfile, setTempProfile] = useState<Profile>(profile);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load from localStorage (same key as topbar: "user_data")
  useEffect(() => {
    const savedUser = localStorage.getItem("user_data");
    if (savedUser) {
      try {
        const payload = JSON.parse(savedUser);
        setProfile((prev) => ({ ...prev, ...payload }));
        setTempProfile((prev) => ({ ...prev, ...payload }));
      } catch (err) {
        console.error("Error parsing user_data from localStorage:", err);
      }
    }
    setLoading(false);
  }, []);

  const handleChange = (field: keyof Profile, value: string) => {
    setTempProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setProfile(tempProfile);
      const savedUser = localStorage.getItem("user_data");
      const existing = savedUser ? JSON.parse(savedUser) : {};
      localStorage.setItem(
        "user_data",
        JSON.stringify({ ...existing, ...tempProfile })
      );
      setIsEditing(false);
      setShowSuccess(true);
      setLoading(false);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 500);
  };

  const handleCancel = () => {
    setTempProfile(profile);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Toast Notification */}
      {showSuccess && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl bg-card border border-primary/40 text-foreground animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold">Profile updated successfully!</span>
        </div>
      )}

      {/* Hero Profile Card */}
      <div className="bg-card border border-border rounded-3xl p-7 sm:p-9 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-4xl sm:text-5xl shadow-sm shrink-0 overflow-hidden">
                {profile.image ? (
                  <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{profile.name?.charAt(0)?.toUpperCase() || "U"}</span>
                )}
              </div>

              {/* Status Dot */}
              <div className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[var(--color-primary)] border-2 border-card" />

              {/* Camera Trigger */}
              <button
                type="button"
                className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-primary hover:bg-muted shadow-xs transition"
                title="Change Photo"
              >
                <Camera size={15} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {profile.name || "User"}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <Shield size={12} />
                  {profile.role ? String(profile.role).toUpperCase() : "USER"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2.5">
                  <Mail size={15} className="text-primary shrink-0" />
                  <span>{profile.email || "No email added"}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone size={15} className="text-primary shrink-0" />
                  <span>{profile.phone || "No contact number added"}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Full Name */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-2.5">
            <User size={15} className="stroke-[2.2]" />
            <span>Full Name</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={tempProfile.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Enter full name"
              className="w-full px-3.5 py-2 bg-muted border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:border-border focus:ring-1 focus:ring-ring h-10"
            />
          ) : (
            <p className="text-base sm:text-lg font-bold text-foreground">{profile.name || "-"}</p>
          )}
        </div>

        {/* Email */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-2.5">
            <Mail size={15} className="stroke-[2.2]" />
            <span>Email</span>
          </div>
          {isEditing ? (
            <input
              type="email"
              value={tempProfile.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Enter email"
              className="w-full px-3.5 py-2 bg-muted border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:border-border focus:ring-1 focus:ring-ring h-10"
            />
          ) : (
            <p className="text-base sm:text-lg font-bold text-foreground">{profile.email || "-"}</p>
          )}
        </div>

        {/* Contact Number */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-2.5">
            <Phone size={15} className="stroke-[2.2]" />
            <span>Contact Number</span>
          </div>
          {isEditing ? (
            <input
              type="tel"
              value={tempProfile.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="Enter contact number"
              className="w-full px-3.5 py-2 bg-muted border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:border-border focus:ring-1 focus:ring-ring h-10"
            />
          ) : (
            <p className="text-base sm:text-lg font-bold text-foreground">{profile.phone || "-"}</p>
          )}
        </div>

        {/* Role */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-2.5">
            <Briefcase size={15} className="stroke-[2.2]" />
            <span>Role</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground capitalize">{profile.role || "-"}</p>
        </div>

        {/* Status */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs sm:col-span-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-2.5">
            <Activity size={15} className="stroke-[2.2]" />
            <span>Status</span>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-[var(--color-primary-dark)] dark:text-[var(--color-primary)] border border-[var(--color-primary)]/20">
            {profile.status
              ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1)
              : "Active"}
          </span>
        </div>
      </div>

      <SignInMethods />
    </div>
  );
}