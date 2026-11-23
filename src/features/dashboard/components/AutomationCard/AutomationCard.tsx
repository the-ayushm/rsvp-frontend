import { Bot, CalendarClock, FileCheck2, PlayCircle, Workflow } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import type { CampaignSummary, ChatbotSummary, TemplateSummary } from "../../types";
import { isRunning, isScheduled } from "../../utils/metrics";
import { MiniStat } from "../MiniStat";
import styles from "./AutomationCard.module.css";

interface Props {
  chatbots?: ChatbotSummary[];
  templates?: TemplateSummary[];
  campaigns?: CampaignSummary[];
}

/** "What is running on autopilot?" */
export function AutomationCard({ chatbots, templates, campaigns }: Props) {
  const live = chatbots?.filter((b) => b.published).length;
  const approved = templates?.filter((t) => t.status === "APPROVED").length;
  const pending = templates?.filter((t) => t.status === "PENDING" || t.status === "IN_APPEAL").length;
  const scheduled = campaigns?.filter((c) => isScheduled(c)).length;
  const running = campaigns?.filter(isRunning).length;

  return (
    <Card className={styles.card}>
      <CardHeader icon={Workflow} title="Automation" description="Bots, templates and scheduled sends" />
      <div className={styles.grid}>
        <MiniStat
          label="Live chatbots"
          icon={<Bot size={13} />}
          tone={live ? "success" : "neutral"}
          value={live}
          hint={chatbots ? `${chatbots.length} total · ${chatbots.length - (live ?? 0)} draft` : undefined}
          href="/user/chatbot"
        />
        <MiniStat
          label="Approved templates"
          icon={<FileCheck2 size={13} />}
          tone="primary"
          value={approved}
          hint={templates ? `${pending ?? 0} pending review` : undefined}
          href="/user/manage/templates"
        />
        <MiniStat
          label="Scheduled"
          icon={<CalendarClock size={13} />}
          tone={scheduled ? "primary" : "neutral"}
          value={scheduled}
          hint="Campaigns queued to send"
          href="/user/campaigns"
        />
        <MiniStat
          label="Running now"
          icon={<PlayCircle size={13} />}
          tone={running ? "success" : "neutral"}
          value={running}
          hint="Campaigns sending"
          href="/user/campaigns"
        />
      </div>
    </Card>
  );
}
