'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Headset, LogIn, X } from 'lucide-react';
import ChatThread from '../live/components/ChatThread';
import ConversationList from '../live/components/ConversationList';
import NewChatForm from '../live/components/NewChatForm';
import { ConnectionIndicator } from '../live/components/ui';
import type { LiveSupport, SupportSession } from '../live/useLiveSupport';

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorPosition: { x: number; y: number };
  iconSize?: number;
  support: LiveSupport;
  session: SupportSession | null;
}

type View = 'home' | 'new' | 'chat';

export default function SupportChatModal({
  isOpen,
  onClose,
  anchorPosition,
  iconSize = 56,
  support,
  session,
}: SupportChatModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState(false);

  const GAP = 12;
  const PAD = 12;

  const [pos, setPos] = useState({ left: 0, top: 0 });

  const view: View = support.selectedId ? 'chat' : composing ? 'new' : 'home';

  const goHome = () => {
    setComposing(false);
    support.openTicket(null);
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    const el = modalRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    const x = anchorPosition.x;
    const y = anchorPosition.y;

    const openRight = vw - x >= rect.width + GAP + PAD;
    const openDown = vh - y >= rect.height + GAP + PAD;

    let left = openRight ? x + GAP : x - rect.width - GAP;
    let top = openDown ? y + GAP : y - rect.height - GAP;

    if (!openRight) left -= iconSize;

    left = Math.min(Math.max(left, PAD), vw - rect.width - PAD);
    top = Math.min(Math.max(top, PAD), vh - rect.height - PAD);

    setPos({ left, top });
  }, [isOpen, anchorPosition.x, anchorPosition.y, GAP, PAD, iconSize]);

  const title = view === 'new' ? 'New conversation' : 'Live Support';

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-label="Live support chat"
      aria-hidden={!isOpen}
      style={{
        left: pos.left,
        top: pos.top,
        height: `min(620px, calc(100vh - ${PAD * 2}px))`,
      }}
      className={`fixed z-50 w-[calc(100vw-24px)] sm:w-[400px] font-sans transition-all duration-200 ${
        isOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/15 bg-surface-muted shadow-2xl">
        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/10 bg-surface-active px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {view !== 'home' ? (
              <button
                type="button"
                onClick={goHome}
                aria-label="Back to conversations"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Headset size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-foreground">{title}</h3>
              {session ? (
                <ConnectionIndicator status={support.status} detail={support.statusDetail} />
              ) : (
                <p className="text-xs font-medium text-muted-foreground">We are here to help you</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
            aria-label="Close support chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Connection problems that need the user's attention */}
        {session && (support.status === 'expired' || support.status === 'denied') && (
          <div className="shrink-0 border-b border-error-border bg-error-bg px-4 py-2 text-xs font-semibold text-error">
            {support.statusDetail ?? 'Live updates are unavailable.'}
          </div>
        )}
        {support.notice && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-warning-border bg-warning-bg px-4 py-2 text-xs font-semibold text-warning">
            <span>{support.notice}</span>
            <button type="button" onClick={support.dismissNotice} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
        )}

        {/* BODY */}
        {!session ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <LogIn size={28} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Sign in to chat with support</p>
            <p className="text-xs text-muted-foreground">Live chat is available from your dashboard once you&apos;re signed in.</p>
          </div>
        ) : view === 'chat' ? (
          <ChatThread support={support} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === 'new' ? (
              <NewChatForm support={support} />
            ) : (
              <ConversationList support={support} userName={session.userName} onNewChat={() => setComposing(true)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
