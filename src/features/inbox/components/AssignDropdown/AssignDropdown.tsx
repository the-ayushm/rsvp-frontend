/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Dropdown from "@/components/ui/Dropdown";
import IconButton from "@/components/ui/IconButton";
import styles from "./AssignDropdown.module.css";

interface AssignDropdownProps {
  showAssignDropdown: boolean;
  setShowAssignDropdown: (v: boolean | ((prev: boolean) => boolean)) => void;
  assignDropdownRef: React.RefObject<HTMLDivElement | null>;
  acceptedTeamMembers: any[];
  selectedAssignees: string[];
  setSelectedAssignees: React.Dispatch<React.SetStateAction<string[]>>;
  assignLoading: boolean;
  handleAssignMultiple: (memberIds: string[]) => void;
}

/** Assign the conversation to one or more team members. */
export const AssignDropdown = ({
  showAssignDropdown,
  setShowAssignDropdown,
  assignDropdownRef,
  acceptedTeamMembers,
  selectedAssignees,
  setSelectedAssignees,
  assignLoading,
  handleAssignMultiple,
}: AssignDropdownProps) => {
  const toggle = (id: string) =>
    setSelectedAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div ref={assignDropdownRef}>
      <Dropdown
        open={showAssignDropdown}
        onOpenChange={(open) => setShowAssignDropdown(open)}
        width="18rem"
        trigger={<IconButton aria-label="Assign to team members" active={showAssignDropdown} icon={<UserCheck size={18} />} />}
      >
        <p className={styles.header}>Assign to</p>
        {acceptedTeamMembers.length === 0 ? (
          <p className={styles.empty}>No team members have accepted their invite yet.</p>
        ) : (
          <>
            <div className={styles.list}>
              {acceptedTeamMembers.map((member: any) => {
                const isSelected = selectedAssignees.includes(member.id);
                return (
                  <label key={member.id} className={cn(styles.member, isSelected && styles.memberSelected)}>
                    <Checkbox checked={isSelected} onChange={() => toggle(member.id)} aria-label={member.name || member.email} />
                    <Avatar size="sm" name={member.name || member.email} />
                    <span className="min-w-0 flex-1">
                      <span className={cn(styles.memberName, "block truncate")}>{member.name || "—"}</span>
                      <span className={cn(styles.memberEmail, "block truncate")}>{member.email}</span>
                    </span>
                    {member.role && <span className={styles.role}>{String(member.role).toLowerCase()}</span>}
                  </label>
                );
              })}
            </div>
            <div className={styles.footer}>
              <Button
                size="sm"
                fullWidth
                isLoading={assignLoading}
                disabled={selectedAssignees.length === 0}
                onClick={() => handleAssignMultiple(selectedAssignees)}
              >
                {selectedAssignees.length === 0
                  ? "Select members"
                  : `Assign ${selectedAssignees.length} member${selectedAssignees.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </>
        )}
      </Dropdown>
    </div>
  );
};
