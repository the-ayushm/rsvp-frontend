"use client";

import { Bell, Inbox, LayoutDashboard, Megaphone, Search, Users } from "lucide-react";
import styles from "./ThemeDrawer.module.css";

/**
 * Miniature of the real application, built only from theme tokens — so it
 * shows exactly what a color change will do before it is saved.
 *
 * Purely decorative: inert controls, hidden from assistive tech.
 */
export default function ThemePreview() {
  return (
    <div className={styles.preview} aria-hidden>
      <div className={styles.previewApp}>
        <div className={styles.previewSidebar}>
          <div className={styles.previewBrand}>
            <span className={styles.previewLogo}>S</span>
            <span className={styles.previewBrandName}>Workspace</span>
          </div>
          <span className={`${styles.previewNavItem} ${styles.previewNavActive}`}>
            <LayoutDashboard size={12} /> Dashboard
          </span>
          <span className={styles.previewNavItem}>
            <Inbox size={12} /> Inbox
          </span>
          <span className={styles.previewNavItem}>
            <Users size={12} /> Contacts
          </span>
          <span className={styles.previewNavItem}>
            <Megaphone size={12} /> Campaigns
          </span>
        </div>

        <div className={styles.previewMain}>
          <div className={styles.previewHeader}>
            <span className={styles.previewSearch}>
              <Search size={11} /> Search…
            </span>
            <Bell size={13} className={styles.previewHeaderIcon} />
            <span className={styles.previewAvatar}>AA</span>
          </div>

          <div className={styles.previewBody}>
            <div className={styles.previewCards}>
              <div className={styles.previewCard}>
                <span className={styles.previewCardLabel}>Sent</span>
                <strong className={styles.previewCardValue}>8,965</strong>
                <span className={styles.previewTrack}>
                  <span className={styles.previewFill} style={{ width: "72%" }} />
                </span>
              </div>
              <div className={styles.previewCard}>
                <span className={styles.previewCardLabel}>Delivered</span>
                <strong className={styles.previewCardValue}>98.7%</strong>
                <span className={styles.previewTrack}>
                  <span className={styles.previewFill} style={{ width: "94%" }} />
                </span>
              </div>
            </div>

            <div className={styles.previewChat}>
              <span className={`${styles.bubble} ${styles.bubbleIn}`}>Is my order on the way?</span>
              <span className={`${styles.bubble} ${styles.bubbleOut}`}>Yes — it ships today</span>
            </div>

            <div className={styles.previewActions}>
              <span className={styles.previewBtnPrimary}>Primary</span>
              <span className={styles.previewBtnOutline}>Secondary</span>
              <span className={styles.previewBadge}>Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
