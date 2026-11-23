import Link from "next/link";
import { Bot, CalendarPlus, FileText, Inbox, Send, UserPlus, Zap } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "./QuickActions.module.css";

const ACTIONS = [
  { label: "Send campaign", hint: "Broadcast a template", href: "/user/campaigns/create", icon: <Send size={17} />, primary: true },
  { label: "Open inbox", hint: "Reply to customers", href: "/user/inbox", icon: <Inbox size={17} /> },
  { label: "Add contacts", hint: "Create or import", href: "/user/contacts", icon: <UserPlus size={17} /> },
  { label: "Create template", hint: "Submit to Meta", href: "/user/manage/templates", icon: <FileText size={17} /> },
  { label: "Build chatbot", hint: "Automate replies", href: "/user/chatbot/new", icon: <Bot size={17} /> },
  { label: "Schedule", hint: "Plan a send", href: "/user/reminder/create", icon: <CalendarPlus size={17} /> },
];

/** One-click entry points for the things people do every day. */
export function QuickActions() {
  return (
    <Card className={styles.card}>
      <CardHeader icon={Zap} title="Quick actions" />
      <nav className={styles.grid} aria-label="Quick actions">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className={a.primary ? `${styles.action} ${styles.primary}` : styles.action}>
            <span className={styles.icon} aria-hidden>
              {a.icon}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{a.label}</span>
              <span className={styles.hint}>{a.hint}</span>
            </span>
          </Link>
        ))}
      </nav>
    </Card>
  );
}
