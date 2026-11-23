"use client";
import {
  Settings,
  User,
  Users,
  Building2,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function SettingsIndex() {
  const settingsSections = [
    {
      icon: User,
      title: "Profile",
      description: "Manage your personal information and account details",
      href: "/user/settings/profile",
      badgeColor: "bg-primary text-white shadow-xs",
    },
    {
      icon: Users,
      title: "Team",
      description: "Invite members and manage team permissions",
      href: "/user/settings/team",
      badgeColor: "bg-[#7B8D75] text-white shadow-xs",
    },
    {
      icon: Building2,
      title: "Organization",
      description: "Configure organization settings and preferences",
      href: "/user/settings/organization",
      badgeColor: "bg-[#7D4563] text-white shadow-xs",
    },
    {
      icon: CreditCard,
      title: "Billing",
      description: "View invoices and manage payment methods",
      href: "/user/settings/billing",
      badgeColor: "bg-[#C69A33] text-white shadow-xs",
    },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-lg bg-primary/10 text-terracotta border border-terracotta/20 shadow-xs">
            <Settings className="w-5 h-5 stroke-[2]" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
        </div>

        <p className="text-xs text-muted-foreground ml-0.5">
          Manage your account, team, and organization preferences
        </p>
      </div>

      {/* Centered Grid Cards - Balanced Size & Subtle Hover */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {settingsSections.map((section, index) => {
          const Icon = section.icon;

          return (
            <Link key={index} href={section.href} className="block group">
              <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-terracotta/60 hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center text-center min-h-[175px]">
                {/* Themed Icon Badge */}
                <div
                  className={`p-3.5 rounded-xl ${section.badgeColor} group-hover:scale-105 transition-transform duration-200 mb-3.5`}
                >
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                </div>

                {/* Title & Chevron */}
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <h3 className="text-base font-bold text-foreground group-hover:text-terracotta transition-colors">
                    {section.title}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-terracotta group-hover:translate-x-0.5 transition-transform duration-200" />
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {section.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
