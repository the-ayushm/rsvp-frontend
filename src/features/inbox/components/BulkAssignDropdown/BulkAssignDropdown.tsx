/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import { getMemberUserId } from "../../utils/contact.utils";
import styles from "./BulkAssignDropdown.module.css";

const SEARCH_THRESHOLD = 5;

interface BulkAssignDropdownProps {
  selectedCount: number;
  acceptedTeamMembers: any[];
  isAssigning: boolean;
  onAssign: (member: { userId: string; name: string }) => Promise<boolean>;
}

export const BulkAssignDropdown = ({
  selectedCount,
  acceptedTeamMembers,
  isAssigning,
  onAssign,
}: BulkAssignDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Only members with a real user account can be assignees.
  const members = useMemo(
    () =>
      acceptedTeamMembers
        .map((m: any) => ({ userId: getMemberUserId(m), name: m.name || m.email || "Member", email: m.email, role: m.role }))
        .filter((m): m is { userId: string; name: string; email: any; role: any } => !!m.userId),
    [acceptedTeamMembers],
  );

  const q = query.trim().toLowerCase();
  const visible = q
    ? members.filter((m) => m.name.toLowerCase().includes(q) || String(m.email || "").toLowerCase().includes(q))
    : members;
  const chosen = members.find((m) => m.userId === chosenId) || null;

  const handleOpenChange = (next: boolean) => {
    if (!next && isAssigning) return;
    setOpen(next);
    if (!next) {
      setChosenId(null);
      setQuery("");
    }
  };

  const confirm = async () => {
    if (!chosen || isAssigning) return;
    const ok = await onAssign({ userId: chosen.userId, name: chosen.name });
    if (ok) handleOpenChange(false);
  };

  return (
    <Dropdown
      open={open}
      onOpenChange={handleOpenChange}
      width="18rem"
      trigger={
        <Button size="sm" disabled={selectedCount === 0} leftIcon={<UserPlus size={15} />}>
          Assign chats
        </Button>
      }
    >
      <p className={styles.header}>
        Assign {selectedCount} chat{selectedCount === 1 ? "" : "s"} to
      </p>

      {members.length === 0 ? (
        <p className={styles.empty}>No team members have accepted their invite yet.</p>
      ) : (
        <>
          {members.length > SEARCH_THRESHOLD && (
            <div className={styles.search}>
              <Search size={14} className={styles.searchIcon} aria-hidden />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search team members"
                aria-label="Search team members"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className={styles.list} role="listbox" aria-label="Team members">
            {visible.length === 0 ? (
              <p className={styles.empty}>No members match “{query}”.</p>
            ) : (
              visible.map((m) => {
                const isChosen = m.userId === chosenId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    role="option"
                    aria-selected={isChosen}
                    disabled={isAssigning}
                    className={cn(styles.member, isChosen && styles.memberChosen)}
                    onClick={() => setChosenId(m.userId)}
                  >
                    <Avatar size="sm" name={m.name} />
                    <span className="min-w-0 flex-1">
                      <span className={cn(styles.memberName, "block truncate")}>{m.name}</span>
                      {m.email && <span className={cn(styles.memberEmail, "block truncate")}>{m.email}</span>}
                    </span>
                    {isChosen ? (
                      <Check size={16} className={styles.check} aria-hidden />
                    ) : (
                      m.role && <span className={styles.role}>{String(m.role).toLowerCase()}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className={styles.footer}>
            <Button size="sm" fullWidth isLoading={isAssigning} disabled={!chosen || isAssigning} onClick={confirm}>
              {chosen ? `Assign to ${chosen.name}` : "Select a member"}
            </Button>
          </div>
        </>
      )}
    </Dropdown>
  );
};
