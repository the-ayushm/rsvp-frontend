"use client";

import { Check, CheckCheck } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

type NotificationItemProps = {
  id?: string;
  action: string;
  datetime: string | null | undefined;
  description: string;
  read?: boolean;
};

const getActionBadge = (action: string) => {
  const actionUpper = action?.toUpperCase() || "";
  switch (actionUpper) {
    case "CREATE":
      return "bg-primary/10 text-[var(--color-primary)] dark:text-[var(--color-primary)] border border-[var(--color-primary)]/20";
    case "UPDATE":
      return "bg-warning/10 text-warning dark:text-warning border border-warning/20";
    case "DELETE":
      return "bg-error/10 text-error dark:text-error border border-error/20";
    default:
      return "bg-accent/10 text-accent border border-accent/20";
  }
};

export default function NotificationsItem({
  action,
  datetime,
  description,
  read: initialRead = false,
}: NotificationItemProps) {
  const [read, setRead] = useState(initialRead);

  const date = datetime ? new Date(datetime) : null;
  const isValidDate = date && !isNaN(date.getTime());
  const timeString = isValidDate ? format(date, "MMM d, yyyy h:mm a") : "";

  return (
    <div
      className={`px-4 py-3 transition-colors flex flex-col gap-1.5 ${
        read
          ? "bg-transparent opacity-75 hover:opacity-100 hover:bg-muted/30"
          : "bg-muted/30 hover:bg-muted/70"
      }`}
    >
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase ${getActionBadge(
              action
            )}`}
          >
            {action || "INFO"}
          </span>
          {isValidDate && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {timeString}
            </span>
          )}
        </div>

        <button
          onClick={() => setRead(!read)}
          title={read ? "Marked as read" : "Mark as read"}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition cursor-pointer"
        >
          {read ? (
            <CheckCheck className="h-4 w-4 text-accent" />
          ) : (
            <Check className="h-4 w-4 hover:text-accent transition-colors" />
          )}
        </button>
      </div>

      <div className="text-xs md:text-sm font-medium text-foreground leading-snug">
        {description}
      </div>
    </div>
  );
}