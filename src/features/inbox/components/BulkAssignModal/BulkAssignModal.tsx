/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { ArrowLeftRight, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { getMemberUserId } from "../../utils/contact.utils";

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  acceptedTeamMembers: any[];
  isAssigning: boolean;
  onAssign: (member: { userId: string; name: string }) => Promise<boolean>;
}

export const BulkAssignModal = ({
  isOpen,
  onClose,
  selectedCount,
  acceptedTeamMembers,
  isAssigning,
  onAssign,
}: BulkAssignModalProps) => {
  const [chosenId, setChosenId] = useState("");

  // Only members with a real user account can be assignees.
  const members = useMemo(
    () =>
      acceptedTeamMembers
        .map((m: any) => ({ userId: getMemberUserId(m), name: m.name || m.email || "Member" }))
        .filter((m): m is { userId: string; name: string } => !!m.userId),
    [acceptedTeamMembers],
  );
  const chosen = members.find((m) => m.userId === chosenId) || null;
  const label = `${selectedCount} chat${selectedCount === 1 ? "" : "s"}`;

  const close = () => {
    if (isAssigning) return;
    setChosenId("");
    onClose();
  };

  const confirm = async () => {
    if (!chosen || selectedCount === 0 || isAssigning) return;
    const ok = await onAssign(chosen);
    if (ok) {
      setChosenId("");
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <Users size={18} aria-hidden />
          Assign {label}
        </span>
      }
      description={`Choose an agent for ${label}.`}
    >
      <div className="flex flex-col gap-3">
        {members.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No team members have accepted their invite yet.</p>
        ) : (
          <Select
            aria-label="Select agent"
            placeholder="Select agent"
            value={chosenId}
            disabled={isAssigning}
            onChange={(e) => setChosenId(e.target.value)}
            options={members.map((m) => ({ value: m.userId, label: m.name }))}
          />
        )}
        <Button
          fullWidth
          leftIcon={<ArrowLeftRight size={16} />}
          isLoading={isAssigning}
          disabled={!chosen || selectedCount === 0 || isAssigning}
          onClick={confirm}
        >
          Assign
        </Button>
      </div>
    </Modal>
  );
};
