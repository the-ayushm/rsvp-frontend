/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react"; // optional, only if you want a settings icon
import { useTheme } from "next-themes";

import {
  ChevronDown,
  ChevronUp,
  Home,
  User,
  BarChart2,
  Settings,
  Inbox,
  Blocks,
  Cog,
  Image as ImageIcon,
  Bot,
  Cable,
  BookOpenText,
  FolderCode,
  Zap,
  Moon,
  Sun,
  Bell,
} from "lucide-react";
import ProfileCard from "@/components/ProfileCard";
import router from "next/router";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface UserData {
  id?: number;
  name: string;
  email: string;
  image?: string;
}

interface SidebarItemProps {
  expanded: boolean;
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  children?: React.ReactNode;
}

function SidebarItem({
  expanded,
  icon,
  label,
  href,
  onClick,
  className,
  children,
}: SidebarItemProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = href && pathname === href;
  const baseClasses =
    "relative flex items-center gap-3 p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group sidebar-item";
  const activeClasses =
    "bg-[var(--color-success-light)] dark:bg-green-800 text-[var(--color-primary-dark)] dark:text-green-200 shadow-sm";
  const inactiveClasses = "text-gray-700 dark:text-gray-200";

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    else if (href) router.push(href);
  };

  return (
    <li
      onClick={handleClick}
      className={`${baseClasses} ${
        isActive ? activeClasses : inactiveClasses
      } ${className || ""}`}
    >
      {children ? (
        children
      ) : (
        <>
          {/* Icon */}
          <div
            className={`transition-colors duration-300 ${
              isActive
                ? "text-[var(--color-primary)] dark:text-green-300"
                : "text-gray-500 dark:text-gray-400 group-hover:text-[var(--color-primary)] dark:group-hover:text-green-300"
            }`}
          >
            {icon}
          </div>

          {/* Label */}
          <span
            className={`overflow-hidden whitespace-nowrap ${
              expanded ? "block" : "hidden"
            }`}
          >
            {label}
          </span>

          {/* Tooltip when collapsed */}
          {!expanded && (
            <div
              className={`absolute left-full rounded-md px-2 py-1 ml-6
                bg-green-700 dark:bg-green-800 text-white text-sm
                invisible opacity-0 translate-x-3 transition-all duration-300
                group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50`}
            >
              {label}
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [expanded, setExpanded] = useState(true);
  const [manageOpen, setManageOpen] = useState(pathname?.startsWith("/user/manage") || false);
  const [contactsOpen, setContactsOpen] = useState(pathname?.startsWith("/user/contacts") || false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    if (pathname?.startsWith("/user/contacts")) {
      setContactsOpen(true);
    }
    if (pathname?.startsWith("/user/manage")) {
      setManageOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user_data");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Error parsing user_data from localStorage:", err);
      }
    }
  }, []);

  // ⬇️ No darkMode useEffect here anymore   

  return (
    <>5
    
      <aside
        className={`${
          expanded ? "w-64" : "w-20"
        }  h-screen transition-all duration-300 ease-in-out`}
      >
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-full flex flex-col border-r border-gray-100 dark:border-gray-800 shadow-lg">
          {/* ✅ Logo Section (Replaced Text with Image) */}
          <div
  className=" flex items-center justify-center border-b border-gray-100 dark:border-gray-800 h-16 cursor-pointer hover:bg-[var(--color-success-light)] dark:hover:bg-gray-800 transition duration-150"
            onClick={() => setExpanded(!expanded)}
          >
            {/* Expanded View Logo */}
            {expanded && (
              <div className="flex items-center transition-opacity duration-300 opacity-100">
                <Image
                  src={isDark ? "/logo-dark.png" : "/logo-light.png"}
                  alt="SOFT7 Logo"
                  width={100}
                  height={100}
                  className="object-contain transition-all"
                />
              </div>
            )}
 
            {/* Collapsed View Logo */}
            {!expanded && (
              <div className="p-1 flex justify-center block">
                <Image
                  src={isDark ? "/logo-dark.png" : "/logo-light.png"}
                  alt="SOFT7 Logo Small"
                  width={40}
                  height={40}
                  className="object-contain transition-all"
                />
              </div>
            )}
          </div>
          {/* Navigation Section */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            <ul>
              <SidebarItem
                expanded={expanded}
                icon={<Home size={20} />}
                label="Dashboard"
                  href="/user/dashboard"
              />
              <SidebarItem
                expanded={expanded}
                icon={<Inbox size={20} />}
                label="Inbox"
                href="/user/inbox"
              />
              {/* Contacts Dropdown */}
              <li
                className={`p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group ${
                  contactsOpen
                    ? "dark:bg-gray-800 text-gray-700 dark:text-white"
                    : "text-gray-600 dark:text-gray-200"
                }`}
              >
                <div
                  className="flex items-center justify-between"
                  onClick={() => setContactsOpen(!contactsOpen)}
                >
                  <div className="flex items-center gap-3">
                    <User
                      size={20}
                      className="text-[var(--color-primary)] dark:text-green-300"
                    />
                    {expanded && (
                      <span className="text-gray-700 dark:text-gray-200">
                        Contacts
                      </span>
                    )}
                    {!expanded && (
                      <div className="absolute left-full rounded-md px-2 py-1 ml-6 bg-green-700 text-white text-sm invisible opacity-0 translate-x-3 transition-all duration-300 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50">
                        Contacts
                      </div>
                    )}
                  </div>
                  {expanded && (
                    <div className="text-gray-500 dark:text-gray-400">
                      {contactsOpen ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    contactsOpen && expanded ? "max-h-96 mt-2" : "max-h-0"
                  }`}
                >
                  <ul className="ml-5 mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300 border-l-2 border-indigo-200 dark:border-indigo-800">
                    <LinkItem
                      href="/user/contacts"
                      label="Contact List"
                    />
                    <LinkItem
                      href="/user/contacts/sales-pipeline"
                      label="Sales Pipeline"
                    />
                  </ul>
                </div>
              </li>
              <SidebarItem
                expanded={expanded}
                icon={<BarChart2 size={20} />}
                label="Campaigns"
                href="/user/campaigns"
              />

              <SidebarItem
                expanded={expanded}
                icon={<Blocks size={20} />}
                label="Integrations"
                href="/user/integrations"
              />

              {/* Manage Dropdown */}
              <li
                className={`p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group ${
                  manageOpen
                    ? "dark:bg-gray-800 text-gray-700 dark:text-white" // DARK MODE OPEN STYLE
                    : "text-gray-600 dark:text-gray-200"
                }`}
              >
                <div
                  className="flex items-center justify-between"
                  onClick={() => setManageOpen(!manageOpen)}
                >
                  <div className="flex items-center gap-3">
                    <Cog
                      size={20}
                      className="text-[var(--color-primary)] dark:text-green-300"
                    />
                    {expanded && (
                      <span className="text-gray-700 dark:text-gray-200">
                        Manage
                      </span>
                    )}
                    {!expanded && (
                      <div className="absolute left-full rounded-md px-2 py-1 ml-6 bg-green-700 text-white text-sm invisible opacity-0 translate-x-3 transition-all duration-300 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50">
                        Manage
                      </div>
                    )}
                  </div>
                  {expanded && (
                    <div className="text-gray-500 dark:text-gray-400">
                      {manageOpen ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    manageOpen && expanded ? "max-h-96 mt-2" : "max-h-0"
                  }`}
                >
                  <ul className="ml-5 mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300 border-l-2 border-indigo-200 dark:border-indigo-800">
                    <LinkItem
                      href="/user/manage/templates"
                      label="WhatsApp Templates"
                    />
                    <LinkItem
                      href="/user/manage/whatsapp-flows"
                      label="Flow Builder"
                    />
                    <LinkItem href="/user/manage/tags" label="Tags" />
                    <LinkItem href="/user/manage/columns" label="Columns" />
                    <LinkItem href="/user/manage/stages" label="Pipeline Stages" />
                    <LinkItem
                      href="/user/manage/opts-management"
                      label="Opts Management"
                    />
                    {/* <LinkItem
                      href="/user/manage/webhooks"
                      label="Webhook Events"
                    /> */}
                    <LinkItem
                      href="/user/manage/upload-image"
                      label="Upload Media"
                    />
                  </ul>
                </div>
              </li>

              {/* Other Items */}
              <SidebarItem
                expanded={expanded}
                icon={<ImageIcon size={20} />}
                label="Gallery"
                href="/user/gallery"
              />
              <SidebarItem
                expanded={expanded}
                icon={<Bot size={20} />}
                label="Chatbot"
                href="/user/chatbot"
              />

              <SidebarItem
                expanded={expanded}
                icon={<Bot size={20} />}
                label="AI Assistant"
                href="/user/ai-assistant"
              />

              {false && (
                <SidebarItem
                  expanded={expanded}
                  icon={<BookOpenText size={20} />}
                  label="Knowledge Base"
                  href="/user/knowledge-base"
                />
              )}
              <SidebarItem
                expanded={expanded}
                icon={<FolderCode size={20} />}
                label="Developers"
                href="/user/developers"
              />
            </ul>
          </nav>

          {/* Bottom Section */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 mt-auto space-y-2">
            <ul>
              <SidebarItem
                expanded={expanded}
                icon={<Bell size={20} />}
                label="Schedules"
                href="/user/reminder"
              />
              <SidebarItem
                expanded={expanded}
                icon={<SettingsIcon size={20} />}
                label="Settings"
                onClick={() => (window.location.href = "/user/settings")}
                className="relative flex items-center gap-3 p-3 my-1 font-medium rounded-xl cursor-pointer transition-all duration-300 group
           text-gray-700 dark:text-gray-200
           hover:bg-[var(--color-success-light)] hover:text-[var(--color-primary-dark)]
           dark:hover:bg-black! dark:hover:text-white"
              >
                {/* Show Icon and Label when expanded */}
                {expanded && (
                  <>
                    <SettingsIcon
                      size={20}
                      className="text-gray-500 dark:text-gray-400 group-hover:text-[var(--color-primary)] dark:group-hover:text-green-300 transition-colors"
                    />
                    <span className="overflow-hidden whitespace-nowrap">
                      Settings
                    </span>
                  </>
                )}

                {/* Show Avatar/icon when collapsed */}
                {!expanded && (
                  <>
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-gray-300 dark:border-gray-600">
                      {user?.image ? (
                        <img
                          src={user.image}
                          alt="User Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[(--theme-color)]/10">
                          <SettingsIcon
                            size={12}
                            className="text-[(--theme-color)]"
                          />
                        </div>
                      )}
                    </div>

                    {/* Tooltip when collapsed */}
                    <div className="absolute left-full rounded-md px-2 py-1 ml-6 bg-green-700 dark:bg-green-800 text-white text-sm invisible opacity-0 translate-x-3 transition-all duration-300 group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50">
                      Settings
                    </div>
                  </>
                )}
              </SidebarItem>
            </ul>
          </div>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #d1d5db;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #9ca3af;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background-color: transparent;
          }

          /* 🟣 Sidebar hover behaviour */
          .sidebar-item {
            transition:
              background-color 150ms ease,
              color 150ms ease;
          }

          /* 🌞 Light mode hover (green) */
          .sidebar-item:hover {
            background-color: #ecfdf5; /* like bg-[var(--color-success-light)] */
            color: #047857; /* like text-[var(--color-primary-dark)] */
          }

          /* 🌙 Dark mode hover: PURE BLACK + WHITE */
          html.dark .sidebar-item:hover,
          html.dark li .sidebar-item:hover,
          html.dark a.sidebar-item:hover {
            background-color: #000000 !important;
            color: #ffffff !important;
          }
        `}</style>
      </aside>

      {showProfile && <ProfileCard onClose={() => setShowProfile(false)} />}
    </>
  );
}

interface LinkItemProps {
  href: string;
  label: string;
}

function LinkItem({ href, label }: LinkItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <li className="relative">
      <Link
        href={href}
        className={`sidebar-item block px-3 py-1.5 rounded-lg transition duration-150 border-l-2 ${
          isActive 
            ? "border-green-500 bg-[var(--color-success-light)]/50 dark:bg-green-900/20 text-[var(--color-primary-dark)] dark:text-green-300 font-semibold" 
            : "border-transparent text-gray-600 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
