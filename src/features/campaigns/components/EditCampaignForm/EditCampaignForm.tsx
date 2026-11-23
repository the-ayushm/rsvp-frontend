"use client";

import { useState } from "react";

type CampaignType = {
  id: string;
  name: string;
  type: string;
  scheduled_at: string | null;
  startTime?: string | null;
};

type EditCampaignFormProps = {
  campaign: CampaignType;
  onSave: (updated: Partial<CampaignType>) => void;
  onCancel: () => void;
};

export function EditCampaignForm({
  campaign,
  onSave,
  onCancel,
}: EditCampaignFormProps) {
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState(campaign.type);

  const [startDate, setStartDate] = useState(
    campaign.scheduled_at ? campaign.scheduled_at.split("T")[0] : "",
  );

  const [startTime, setStartTime] = useState(
    campaign.scheduled_at
      ? new Date(campaign.scheduled_at).toISOString().slice(11, 16)
      : "09:00",
  );

  function handleSave() {
    onSave({
      name,
      type,
      scheduled_at: startDate, // send raw "YYYY-MM-DD"
      startTime, // send "HH:mm"
    });
  }

  return (
    <div className="w-full flex flex-col font-sans">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            Campaign Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter campaign name..."
            className="w-full bg-surface-muted border border-black/15 rounded-xl px-3.5 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            Campaign Type
          </label>
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. MARKETING, UTILITY"
            className="w-full bg-surface-muted border border-black/15 rounded-xl px-3.5 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-surface-muted border border-black/15 rounded-xl px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-surface-muted border border-black/15 rounded-xl px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-6 mt-6 border-t border-black/10">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs text-xs px-4 py-2 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground border border-primary hover:bg-primary-hover shadow-xs text-xs px-5 py-2 cursor-pointer shadow-xs"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
