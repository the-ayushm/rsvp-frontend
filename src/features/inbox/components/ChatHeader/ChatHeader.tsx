/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { AlertTriangle, ArrowLeft, Clock3, PanelRight, User } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { Contact } from "../../types/inbox.types";
import { isPhoneNumberName } from "../../utils/contact.utils";
import { isSamePhoneValue, removePlusPrefix } from "../../utils/phone.utils";
import { AssignDropdown } from "../AssignDropdown";
import styles from "./ChatHeader.module.css";

interface ChatHeaderProps {
  selectedContact: Contact | null;
  setSelectedContact: (c: Contact | null) => void;
  showContactPanel: boolean;
  setShowContactPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showAssignDropdown: boolean;
  setShowAssignDropdown: (v: boolean | ((prev: boolean) => boolean)) => void;
  assignDropdownRef: React.RefObject<HTMLDivElement | null>;
  acceptedTeamMembers: any[];
  selectedAssignees: string[];
  setSelectedAssignees: React.Dispatch<React.SetStateAction<string[]>>;
  assignLoading: boolean;
  handleAssignMultiple: (memberIds: string[]) => void;
  isWindowOpenFromAPI: boolean;
  windowState: { isOpen: boolean; remainingText: string | null };
  onSendTemplate?: () => void;
}

export const ChatHeader = ({
  selectedContact,
  setSelectedContact,
  showContactPanel,
  setShowContactPanel,
  showAssignDropdown,
  setShowAssignDropdown,
  assignDropdownRef,
  acceptedTeamMembers,
  selectedAssignees,
  setSelectedAssignees,
  assignLoading,
  handleAssignMultiple,
  isWindowOpenFromAPI,
  windowState,
  onSendTemplate,
}: ChatHeaderProps) => {
  const name = selectedContact?.name || "Unknown";
  const phone = removePlusPrefix(selectedContact?.phone || "");
  const showPhone = !!phone && !isSamePhoneValue(name, phone);

  return (
    <>
      <div className={styles.header}>
        <IconButton
          aria-label="Back to conversations"
          className={styles.back}
          icon={<ArrowLeft size={19} />}
          onClick={() => setSelectedContact(null)}
        />

        <button
          type="button"
          className={styles.identity}
          onClick={() => setShowContactPanel((prev) => !prev)}
          aria-label="Toggle contact info"
        >
          <Avatar
            name={name}
            size="md"
            fallback={isPhoneNumberName(name) ? <User size={18} /> : undefined}
          />
          <span className="min-w-0">
            <span className={`${styles.name} block`}>{name}</span>
            <span className={`${styles.subtitle} block`}>
              {showPhone ? `+${phone}` : "Click for contact info"}
            </span>
          </span>
        </button>

        <div className={styles.actions}>
          <AssignDropdown
            showAssignDropdown={showAssignDropdown}
            setShowAssignDropdown={setShowAssignDropdown}
            assignDropdownRef={assignDropdownRef}
            acceptedTeamMembers={acceptedTeamMembers}
            selectedAssignees={selectedAssignees}
            setSelectedAssignees={setSelectedAssignees}
            assignLoading={assignLoading}
            handleAssignMultiple={handleAssignMultiple}
          />
          <IconButton
            aria-label={showContactPanel ? "Hide contact info" : "Show contact info"}
            active={showContactPanel}
            icon={<PanelRight size={18} />}
            onClick={() => setShowContactPanel((prev) => !prev)}
          />
        </div>
      </div>

      {selectedContact &&
        (isWindowOpenFromAPI ? (
          <div className={`${styles.window} ${styles.windowOpen}`} role="status">
            <Clock3 size={13} aria-hidden />
            <span>{windowState.remainingText ? `${windowState.remainingText} — you can send any message` : "Customer service window open"}</span>
          </div>
        ) : (
          <div className={`${styles.window} ${styles.windowClosed}`} role="status">
            <AlertTriangle size={13} aria-hidden />
            <span>24-hour window closed. Send an approved template to re-engage.</span>
            {onSendTemplate && (
              <Button size="sm" variant="secondary" onClick={onSendTemplate} className="ml-1 !h-7">
                Send template
              </Button>
            )}
          </div>
        ))}
    </>
  );
};
