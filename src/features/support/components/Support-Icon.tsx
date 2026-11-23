// components/CustomerSupport/SupportIcon.tsx
'use client';

import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SupportChatModal from "./SupportChatModal";
import { readSupportSession, useLiveSupport, type SupportSession } from "../live/useLiveSupport";
import { motion } from "framer-motion";
export default function SupportIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [anchorPosition, setAnchorPosition] = useState({ x: 0, y: 0 });

  const iconRef = useRef<HTMLDivElement>(null);
  const dragThreshold = 5;
  const pointerDown = useRef(false);
  const wasDragged = useRef(false);
  const pathname = usePathname() || "";
  // The inbox has its own composer + side panel in that corner; support is
  // reachable from the account menu there (and on every page) instead.
  const hideLauncher = pathname.startsWith("/user/inbox");

  // Live chat needs a signed-in dashboard user. Re-read on navigation (logout
  // navigates to /auth) and on storage changes from other tabs, so the stream
  // is closed and account state cleared when the user signs out.
  const [session, setSession] = useState<SupportSession | null>(null);
  // Support lives in the signed-in user dashboard only — never on the login /
  // sign-up pages (served at "/" and "/auth") or the admin portal.
  const onDashboard = pathname === "/user" || pathname.startsWith("/user/");
  useEffect(() => {
    const sync = () => {
      const next = onDashboard ? readSupportSession() : null;
      setSession((prev) => (prev?.userId === next?.userId && prev?.userName === next?.userName ? prev : next));
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [pathname, onDashboard]);

  // Support chat makes no requests until the user first opens it, so other
  // pages (e.g. Contacts) only call their own APIs.
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (isOpen) setActivated(true);
  }, [isOpen]);
  useEffect(() => {
    if (!session) setActivated(false);
  }, [session]);
  const support = useLiveSupport(activated ? session : null, isOpen);

  // Signed out: close the panel so it doesn't reappear open after the next login.
  useEffect(() => {
    if (!session) setIsOpen(false);
  }, [session]);

  useEffect(() => {
    const open = () => {
      setAnchorPosition({ x: window.innerWidth - 24, y: 72 });
      setIsOpen(true);
    };
    window.addEventListener("soft7:open-support", open);
    return () => window.removeEventListener("soft7:open-support", open);
  }, []);

  if (!session) return null;

  return (
    <>
      {!hideLauncher && (
      <motion.div
        ref={iconRef}
        drag
        dragMomentum={false}
        style={{ x: position.x, y: position.y }}
        onPointerDown={() => {
          pointerDown.current = true;
          wasDragged.current = false;
        }}
        onDragEnd={(_, info) => {
          const distance = Math.hypot(info.offset.x, info.offset.y);

          if (distance > dragThreshold) {
            wasDragged.current = true;
            setPosition((prev) => ({
              x: prev.x + info.offset.x,
              y: prev.y + info.offset.y,
            }));
          }
        }}
        onPointerUp={() => {
          if (!pointerDown.current) return;

          pointerDown.current = false;

          if (!wasDragged.current) {
            const rect = iconRef.current?.getBoundingClientRect();

            if (rect) {
              setAnchorPosition({
                x: rect.right,
                y: rect.top,
              });
            }

            setIsOpen((v) => !v);
          }
        }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          suppressHydrationWarning
          className="group relative cursor-pointer flex h-13 w-13 items-center justify-center rounded-full bg-accent shadow-lg shadow-accent/25 transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          aria-label={isOpen ? 'Close support' : support.totalUnread > 0 ? `Open support (${support.totalUnread} unread)` : 'Open support'}
        >
          {/* Icon */}
          <div className="relative h-6 w-6">
            <MessageCircle
              className={`absolute inset-0 transition-all duration-300 ${
                isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
              }`}
              size={24}
              strokeWidth={2}
            />

            <X
              className={`absolute inset-0 transition-all duration-300 ${
                isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
              }`}
              size={24}
              strokeWidth={2}
            />
          </div>

          {/* Unread replies */}
          {!isOpen && support.totalUnread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-error px-1 text-[10px] font-bold text-white">
              {support.totalUnread > 9 ? "9+" : support.totalUnread}
            </span>
          )}

          {/* Ripple effect */}
          <span className="absolute inset-0 rounded-full bg-accent opacity-0 group-hover:animate-ping" />
        </button>

        {/* Tooltip */}
        {!isOpen && (
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-xl bg-foreground px-3 py-1.5 text-xs font-semibold text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            Need help?
            <div className="absolute -bottom-1 right-5 h-2 w-2 rotate-45 bg-foreground" />
          </div>
        )}
      </motion.div>
      )}

      {/* Chat Modal */}
      <SupportChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorPosition={anchorPosition}
        iconSize={56}
        support={support}
        session={session}
      />
    </>
  );
}
