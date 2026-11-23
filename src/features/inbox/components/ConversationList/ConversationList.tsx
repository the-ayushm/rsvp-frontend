/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { MessagesSquare, Search, SearchX, Users, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import Spinner from "@/components/ui/Spinner";
import Tooltip from "@/components/ui/Tooltip";
import { Contact } from "../../types/inbox.types";
import { getBackendContactId } from "../../utils/contact.utils";
import { BulkAssignModal } from "../BulkAssignModal";
import { ConversationFilters } from "../ConversationFilters";
import { ConversationItem } from "../ConversationItem";
import { PhoneSelector } from "../PhoneSelector";
import styles from "./ConversationList.module.css";

interface ConversationListProps {
  selectedContact: Contact | null;
  selectedPipelineStage: string | null;
  setSelectedPipelineStage: (s: string | null) => void;
  pipelineStages: any[];
  selectedReadFilter: "all" | "unread" | "read";
  setSelectedReadFilter: (r: "all" | "unread" | "read") => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (a: string | null) => void;
  acceptedTeamMembers: any[];
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  contactTags: any[];
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  phoneNumbers: any[];
  selectedPhone: string;
  selectedPhoneMeta: any;
  showPhoneDropdown: boolean;
  setShowPhoneDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  handlePhoneSelect: (phoneId: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showFilterMenu: boolean;
  setShowFilterMenu: React.Dispatch<React.SetStateAction<boolean>>;
  paginatedContacts: Contact[];
  totalContacts: number;
  loadingContacts: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  handleContactSelect: (contact: Contact) => void;
  getContactReminders: (id: any) => any[];
  handleBulkAssign: (contactIds: string[], member: { userId: string; name: string }) => Promise<boolean>;
  isBulkAssigning: boolean;
}

export const ConversationList = ({
  selectedContact,
  selectedPipelineStage,
  setSelectedPipelineStage,
  pipelineStages,
  selectedReadFilter,
  setSelectedReadFilter,
  selectedAgentId,
  setSelectedAgentId,
  acceptedTeamMembers,
  selectedTag,
  setSelectedTag,
  contactTags,
  hasActiveFilters,
  clearAllFilters,
  phoneNumbers,
  selectedPhone,
  selectedPhoneMeta,
  showPhoneDropdown,
  setShowPhoneDropdown,
  handlePhoneSelect,
  searchQuery,
  setSearchQuery,
  showFilterMenu,
  setShowFilterMenu,
  paginatedContacts,
  totalContacts,
  loadingContacts,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  handleContactSelect,
  getContactReminders,
  handleBulkAssign,
  isBulkAssigning,
}: ConversationListProps) => {
  const isFiltered = hasActiveFilters || !!searchQuery.trim();
  const showSkeleton = loadingContacts && paginatedContacts.length === 0;

  // Keyed by backend contact id; survives infinite-scroll page loads, search and filter changes.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  // Checkboxes are hidden until the user turns on selection mode via the assign toggle.
  const [selectMode, setSelectMode] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setCheckedIds(new Set());
  }, []);

  useEffect(() => {
    setCheckedIds(new Set());
  }, [selectedPhone]);

  const toggleChecked = useCallback((id: string) => {
    if (isBulkAssigning) return;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [isBulkAssigning]);

  const loadedSelectableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of paginatedContacts) {
      const id = getBackendContactId(c);
      if (id) ids.add(id);
    }
    return [...ids];
  }, [paginatedContacts]);

  const loadedCheckedCount = loadedSelectableIds.filter((id) => checkedIds.has(id)).length;
  const allLoadedChecked = loadedSelectableIds.length > 0 && loadedCheckedCount === loadedSelectableIds.length;
  const checkedCount = checkedIds.size;

  const toggleAllLoaded = () => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allLoadedChecked) loadedSelectableIds.forEach((id) => next.delete(id));
      else loadedSelectableIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const assignChecked = async (member: { userId: string; name: string }) => {
    const submitted = [...checkedIds];
    const ok = await handleBulkAssign(submitted, member);
    if (ok) exitSelectMode();
    return ok;
  };

  const assignToggle = (
    <Tooltip side="left" content={selectMode ? "Cancel selection" : "Select chats to assign"}>
      <IconButton
        aria-label={selectMode ? "Cancel selection" : "Select chats to assign"}
        title=""
        active={selectMode}
        disabled={isBulkAssigning}
        icon={<Users size={17} />}
        onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
      />
    </Tooltip>
  );

  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, {
      root: el.parentElement,
      rootMargin: "200px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <section className={`${styles.list} contacts-sidebar`} aria-label="Conversations">
      <div className={styles.top}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Chats</h1>
          {totalContacts > 0 && (
            <span className={styles.total}>
              {totalContacts.toLocaleString()} conversation{totalContacts === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <PhoneSelector
          phoneNumbers={phoneNumbers}
          selectedPhone={selectedPhone}
          selectedPhoneMeta={selectedPhoneMeta}
          showPhoneDropdown={showPhoneDropdown}
          setShowPhoneDropdown={setShowPhoneDropdown}
          handlePhoneSelect={handlePhoneSelect}
        />

        <div className={styles.search}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search name or number"
            aria-label="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchQuery("")}
          />
          <span className={styles.searchEnd}>
            {loadingContacts && searchQuery ? (
              <span className="flex h-8 w-8 items-center justify-center">
                <Spinner size="sm" label="Searching" />
              </span>
            ) : searchQuery ? (
              <IconButton aria-label="Clear search" size="sm" icon={<X size={15} />} onClick={() => setSearchQuery("")} />
            ) : null}
          </span>
        </div>

        <ConversationFilters
          selectedReadFilter={selectedReadFilter}
          setSelectedReadFilter={setSelectedReadFilter}
          pipelineStages={pipelineStages}
          selectedPipelineStage={selectedPipelineStage}
          setSelectedPipelineStage={setSelectedPipelineStage}
          acceptedTeamMembers={acceptedTeamMembers}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          contactTags={contactTags}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          hasActiveFilters={hasActiveFilters}
          clearAllFilters={clearAllFilters}
          showFilterMenu={showFilterMenu}
          setShowFilterMenu={setShowFilterMenu}
          actions={assignToggle}
        />
      </div>

      {selectMode && (
        <div className={styles.selectionBar} data-active={checkedCount > 0 || undefined}>
          <Checkbox
            checked={allLoadedChecked}
            indeterminate={loadedCheckedCount > 0 && !allLoadedChecked}
            disabled={loadedSelectableIds.length === 0 || isBulkAssigning}
            onChange={toggleAllLoaded}
            aria-label={allLoadedChecked ? "Deselect all loaded chats" : "Select all loaded chats"}
            title={`Selects the ${loadedSelectableIds.length} chats loaded so far`}
          />
          <span className={styles.selectionText} aria-live="polite">
            {checkedCount > 0
              ? `${checkedCount} chat${checkedCount === 1 ? "" : "s"} selected`
              : `Select all (${loadedSelectableIds.length} loaded)`}
          </span>
          <Button
            size="sm"
            disabled={checkedCount === 0 || isBulkAssigning}
            isLoading={isBulkAssigning}
            onClick={() => setShowAssignModal(true)}
          >
            Assign to
          </Button>
          {checkedCount > 0 && (
            <Button size="sm" variant="ghost" disabled={isBulkAssigning} onClick={() => setCheckedIds(new Set())}>
              Clear
            </Button>
          )}
          <IconButton
            aria-label="Exit selection"
            size="sm"
            disabled={isBulkAssigning}
            icon={<X size={15} />}
            onClick={exitSelectMode}
          />
        </div>
      )}

      <BulkAssignModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        selectedCount={checkedCount}
        acceptedTeamMembers={acceptedTeamMembers}
        isAssigning={isBulkAssigning}
        onAssign={assignChecked}
      />

      <div className={styles.items}>
        {showSkeleton ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={styles.skeletonItem} aria-hidden>
              <Skeleton circle className="h-12 w-12 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))
        ) : paginatedContacts.length === 0 ? (
          isFiltered ? (
            <EmptyState
              compact
              icon={<SearchX size={20} />}
              title="No matching conversations"
              description={searchQuery ? `Nothing found for “${searchQuery}”.` : "Try adjusting your filters."}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    clearAllFilters();
                  }}
                >
                  Clear search & filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              compact
              icon={<MessagesSquare size={20} />}
              title="No conversations yet"
              description="When customers message your WhatsApp number, their chats appear here."
            />
          )
        ) : (
          paginatedContacts.map((c: Contact) => {
            const selectionId = getBackendContactId(c);
            return (
              <ConversationItem
                key={c.id}
                contact={c}
                isSelected={selectedContact?.id === c.id}
                onClick={() => handleContactSelect(c)}
                reminders={getContactReminders(c.id)}
                contactTags={contactTags}
                selectionId={selectionId}
                isChecked={!!selectionId && checkedIds.has(selectionId)}
                onToggleCheck={selectMode ? toggleChecked : undefined}
              />
            );
          })
        )}
        <div ref={sentinelRef} className={styles.sentinel} />
        {isFetchingNextPage && (
          <div className={styles.loadMore}>
            <Spinner size="sm" label="Loading more" />
          </div>
        )}
      </div>
    </section>
  );
};
