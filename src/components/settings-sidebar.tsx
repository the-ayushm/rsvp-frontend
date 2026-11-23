"use client";
import {
  Settings,
  User,
  Users,
  Building2,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { isTeamMemberUser } from "@/lib/permissions";

export default function SettingsIndex() {
  const [isDark, setIsDark] = useState(true);
  const [isTeam, setIsTeam] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkTheme();
    setIsTeam(isTeamMemberUser());
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const gradientStyle = "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))";

  const settingsSections = [
    {
      icon: User,
      title: "Profile",
      description: "Manage your personal information and account details",
      href: "/user/settings/profile",
    },
    {
      icon: Users,
      title: "Team",
      description: "Invite members and manage team permissions",
      href: "/user/settings/team",
    },
    {
      icon: Building2,
      title: "Organization",
      description: "Configure organization settings and preferences",
      href: "/user/settings/organization",
    },
    {
      icon: CreditCard,
      title: "Billing",
      description: "View invoices and manage payment methods",
      href: "/user/settings/billing",
    },
  ];

  const visibleSections = isTeam
    ? settingsSections.filter((s) => s.title === "Profile")
    : settingsSections;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2">
      {/* Header - Reduced top margin for seamless connection */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="p-3 rounded-xl shadow-lg"
            style={{
              background: gradientStyle,
            }}
          >
            <Settings className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            Settings
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-lg ml-1">
          Manage your account, team, and organization preferences
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleSections.map((section, index) => {
          const Icon = section.icon;

          return (
            <Link
              key={index}
              href={section.href}
              style={{
                backgroundColor: "transparent",
              }}
            >
              <div
                className={`group cursor-pointer rounded-2xl p-6 border backdrop-blur-sm
                transition-all duration-300
                hover:shadow-2xl hover:-translate-y-2`}
              style={{
                backgroundColor: isDark ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-primary-lighter)',
                borderColor: isDark ? 'rgba(var(--color-primary-rgb), 0.2)' : 'rgba(var(--color-primary-rgb), 0.3)',
              }}
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div
                    className="p-5 rounded-xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"
                    style={{ background: gradientStyle }}
                  >
                    <Icon className="w-10 h-10 text-white" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-center mb-2">
                      <h3
                        className={`text-xl font-semibold ${
                          isDark ? "text-white" : "text-gray-900"
                        } group-hover:translate-x-0.5 transition-all`}
                      >
                        {section.title}
                      </h3>

                      <ChevronRight
                        className="w-5 h-5 ml-2 transition-all group-hover:translate-x-2"
                        style={{ color: 'var(--color-primary)' }}
                      />
                    </div>

                    <p
                      className={`text-sm ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
