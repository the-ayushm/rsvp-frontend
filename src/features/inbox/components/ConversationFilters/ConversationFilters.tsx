/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { ListFilter, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import IconButton from "@/components/ui/IconButton";
import Select from "@/components/ui/Select";
import { getMemberUserId } from "../../utils/contact.utils";
import styles from "./ConversationFilters.module.css";

type ReadFilter = "all" | "unread" | "read";

interface ConversationFiltersProps {
  selectedReadFilter: ReadFilter;
  setSelectedReadFilter: (r: ReadFilter) => void;
  pipelineStages: any[];
  selectedPipelineStage: string | null;
  setSelectedPipelineStage: (s: string | null) => void;
  acceptedTeamMembers: any[];
  selectedAgentId: string | null;
  setSelectedAgentId: (a: string | null) => void;
  contactTags: any[];
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  showFilterMenu: boolean;
  setShowFilterMenu: React.Dispatch<React.SetStateAction<boolean>>;
  /** Extra icon actions rendered after the filter button. */
  actions?: React.ReactNode;
}

const READ_OPTIONS: { id: ReadFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
];

/** Quick read-status chips + one popover for pipeline / agent / tag filters. */
export const ConversationFilters = ({
  selectedReadFilter,
  setSelectedReadFilter,
  pipelineStages,
  selectedPipelineStage,
  setSelectedPipelineStage,
  acceptedTeamMembers,
  selectedAgentId,
  setSelectedAgentId,
  contactTags,
  selectedTag,
  setSelectedTag,
  hasActiveFilters,
  clearAllFilters,
  showFilterMenu,
  setShowFilterMenu,
  actions,
}: ConversationFiltersProps) => {
  const agentOptions = acceptedTeamMembers.flatMap((member: any) => {
    const userId = getMemberUserId(member);
    return userId ? [{ value: userId, label: member.name || member.email || "Agent" }] : [];
  });
  const stageName =
    selectedPipelineStage &&
    (pipelineStages.find(
      (s: any) => String(s.id) === String(selectedPipelineStage) || s.name === selectedPipelineStage,
    )?.name ||
      "Stage");
  const agentName =
    selectedAgentId &&
    (selectedAgentId === "unassigned"
      ? "Unassigned"
      : agentOptions.find((agent) => agent.value === selectedAgentId)?.label || "Agent");
  const tagName =
    selectedTag && (contactTags.find((t: any) => String(t.id) === String(selectedTag))?.name || "Tag");

  const activeChips = [
    stageName && { key: "stage", label: `Stage: ${stageName}`, clear: () => setSelectedPipelineStage(null) },
    agentName && { key: "agent", label: `Agent: ${agentName}`, clear: () => setSelectedAgentId(null) },
    tagName && { key: "tag", label: `Tag: ${tagName}`, clear: () => setSelectedTag(null) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div>
      <div className={styles.row}>
        <div className={styles.chips} role="group" aria-label="Read status">
          {READ_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.chip}
              aria-pressed={selectedReadFilter === option.id}
              onClick={() => setSelectedReadFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Dropdown
          open={showFilterMenu}
          onOpenChange={setShowFilterMenu}
          width="17rem"
          trigger={
            <span className={styles.filterButton}>
              <IconButton aria-label="Filter conversations" active={showFilterMenu} icon={<ListFilter size={17} />} />
              {activeChips.length > 0 && <span className={styles.count}>{activeChips.length}</span>}
            </span>
          }
        >
          <div className={`${styles.panel} filter-dropdown`}>
            <div className={styles.panelHeader}>
              <p className={styles.panelTitle}>Filter conversations</p>
            </div>
            <Select
              size="sm"
              label="Pipeline stage"
              value={selectedPipelineStage || ""}
              onChange={(e) => setSelectedPipelineStage(e.target.value || null)}
              options={[
                { value: "", label: "All stages" },
                ...pipelineStages.map((st: any) => ({ value: String(st.id), label: st.name })),
              ]}
            />
            <Select
              size="sm"
              label="Assigned agent"
              value={selectedAgentId || ""}
              onChange={(e) => setSelectedAgentId(e.target.value || null)}
              options={[
                { value: "", label: "All agents" },
                { value: "unassigned", label: "Unassigned only" },
                ...agentOptions,
              ]}
            />
            <Select
              size="sm"
              label="Tag"
              value={selectedTag || ""}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              options={[
                { value: "", label: "All tags" },
                ...contactTags.map((t: any) => ({ value: String(t.id), label: t.name })),
              ]}
            />
            <div className={styles.panelFooter}>
              <Button size="sm" variant="ghost" disabled={!hasActiveFilters} onClick={clearAllFilters}>
                Reset
              </Button>
              <Button size="sm" onClick={() => setShowFilterMenu(false)}>
                Done
              </Button>
            </div>
          </div>
        </Dropdown>
        {actions}
      </div>

      {activeChips.length > 0 && (
        <div className={styles.active}>
          {activeChips.map((chip) => (
            <span key={chip.key} className={styles.activeChip}>
              <span>{chip.label}</span>
              <button type="button" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button type="button" className={styles.clearAll} onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
