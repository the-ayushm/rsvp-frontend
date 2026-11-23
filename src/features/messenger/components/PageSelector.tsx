"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Dropdown, { DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/Dropdown";
import type { FacebookPageConnection } from "@/features/integrations/facebook/api";
// Same look as the WhatsApp number switcher.
import styles from "@/features/inbox/components/PhoneSelector/PhoneSelector.module.css";

/** Switch which connected Facebook Page the Messenger inbox shows. */
export function PageSelector({ pages, selectedId, onSelect, connectHref }: {
  pages: FacebookPageConnection[];
  selectedId: string;
  onSelect: (pageConnectionId: string) => void;
  connectHref: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = pages.find(p => p.id === selectedId);

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="w-full"
      menuClassName="w-full max-h-72 overflow-y-auto"
      trigger={
        <button type="button" className={styles.trigger} aria-label="Facebook Page">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/messenger-logo.svg" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
          <span className={styles.label}>{selected?.name ?? "Select a Facebook Page"}</span>
          <ChevronDown size={15} className={styles.chevron} />
        </button>
      }
    >
      <DropdownLabel>Facebook Pages</DropdownLabel>
      {pages.map(page => {
        const active = page.id === selectedId;
        return (
          <DropdownItem key={page.id} onSelect={() => onSelect(page.id)}
            className={cn(active && styles.optionSelected)} icon={<span className={styles.dot} />}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{page.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {page.status === "connected" ? `Page ID ${page.page_id}` : page.status.replace(/_/g, " ")}
              </span>
            </span>
            {active && <Check size={14} />}
          </DropdownItem>
        );
      })}
      <DropdownSeparator />
      <DropdownItem href={connectHref} icon={<Plus size={14} />}>Connect another Page</DropdownItem>
    </Dropdown>
  );
}
