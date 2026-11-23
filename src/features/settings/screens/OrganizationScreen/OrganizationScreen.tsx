"use client";

import { useState } from "react";
import {
  Building2,
  Globe,
  Briefcase,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

export default function OrganisationPage() {
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleCancel = () => {
    setOrgName("");
    setIndustry("");
    setWebsite("");
    setDescription("");
  };

  const industries = [
    "Technology & Software",
    "Healthcare & Medical",
    "Finance & Banking",
    "Education & Training",
    "Retail & E-commerce",
    "Real Estate & Construction",
    "Media & Marketing",
    "Hospitality & Tourism",
    "Manufacturing",
    "Other",
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl bg-card border border-primary/40 text-foreground animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold">Organisation details saved successfully!</span>
        </div>
      )}

      {/* ── Header Card ── */}
      <div className="bg-card border border-border rounded-3xl p-7 sm:p-9 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shrink-0">
            <Building2 className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Organisation
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Configure and edit your organisation profile details
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Form Card ── */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted border border-border text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            Keep your organisation details up to date. This information will be visible across your platform.
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Organisation Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Organization Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter your organisation name"
                className="w-full px-3.5 py-2 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring h-10"
              />
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                Industry <span className="text-destructive">*</span>
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground h-10 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select industry</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Website <span className="text-[10px] text-muted-foreground font-normal lowercase">(optional)</span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
              className="w-full px-3.5 py-2 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring h-10"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Organisation Description <span className="text-[10px] text-muted-foreground font-normal lowercase">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your organisation..."
              rows={4}
              className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-lg text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Organisation Stats */}
          <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-muted/60 border border-border">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary">156</p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">Team Members</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-2xl sm:text-3xl font-bold text-primary">24</p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">Active Projects</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary">89%</p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">Completion Rate</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-5 border-t border-border">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-card hover:bg-muted border border-border text-foreground rounded-lg font-medium text-xs sm:text-sm transition h-10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg font-semibold text-xs sm:text-sm transition shadow-xs h-10"
          >
            <Save size={15} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
