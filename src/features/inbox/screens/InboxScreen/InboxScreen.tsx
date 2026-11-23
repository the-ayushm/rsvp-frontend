/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import {
  formatTemplateParameters,
  getTemplateVariables,
} from "@/lib/template-utils";

import { Contact, Message, MessageFormInputs } from "../../types/inbox.types";
import { isReminderActive } from "../../utils/contact.utils";

import { useInboxData } from "../../hooks/useInboxData";
import { useServiceWindow } from "../../hooks/useServiceWindow";
import { useVoiceRecording } from "../../hooks/useVoiceRecording";
import { useInboxSocket } from "../../hooks/useInboxSocket";
import { useInboxActions } from "../../hooks/useInboxActions";
import { useMarkConversationRead } from "../../hooks/useMarkConversationRead";

import { ConversationList } from "../../components/ConversationList";
import { ChatHeader } from "../../components/ChatHeader";
import { MessageList } from "../../components/MessageList";
import { Composer } from "../../components/Composer";
import { ContactProfileModal } from "../../components/ContactProfileModal";
import { ContactDetailsPanel } from "../../components/ContactDetailsPanel";
import FAQFlow from "@/features/inbox/components/FAQFlow/FAQFlow";
import { TemplateSelectorModal } from "@/features/templates/components/TemplateSelectorModal";
import { GalleryPickerModal } from "@/features/media/components/GalleryPickerModal";
import styles from "./InboxScreen.module.css";

export function InboxScreen() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const urlPhone = searchParams.get("phone");
  const urlName = searchParams.get("name");
  const urlContactId = searchParams.get("contactId");
  const urlPhoneNumberId = searchParams.get("phoneNumberId");
  const urlMessageId = searchParams.get("messageId");
  const urlWamid = searchParams.get("wamid");

  const [activeFilter] = useState("All");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // Close assign dropdown on outside click
  useEffect(() => {
    if (!showAssignDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        assignDropdownRef.current &&
        !assignDropdownRef.current.contains(e.target as Node)
      ) {
        setShowAssignDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssignDropdown]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [, setActiveDropdown] = useState<
    "Unread" | "Assigned" | "Unassigned" | null
  >(null);

  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // FAQ Flow state
  const [showFAQFlow, setShowFAQFlow] = useState(false);
  const [selectedBotForFAQ] = useState<string | undefined>(undefined);

  // Contact Profile Modal state
  const [showContactDetailsModal, setShowContactDetailsModal] = useState(false);
  // Right-side contact panel: open by default only where it fits as a column
  const [showContactPanel, setShowContactPanel] = useState(true);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1280px)").matches) setShowContactPanel(false);
  }, []);

  // Template Selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Gallery Picker Modal state
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [selectedGalleryMedia, setSelectedGalleryMedia] = useState<any>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);

  const [selectedPipelineStage, setSelectedPipelineStage] = useState<
    string | null
  >(null);
  const [selectedReadFilter, setSelectedReadFilter] = useState<
    "all" | "unread" | "read"
  >("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const [showPipelineMenu, setShowPipelineMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showReadMenu, setShowReadMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);

  const hasActiveFilters = Boolean(
    selectedPipelineStage ||
      selectedAgentId ||
      selectedTag ||
      selectedReadFilter !== "all",
  );

  const reminders: any[] = [];
  const getContactReminders = (contactId: number) =>
    reminders.filter(
      (r: any) => r.contactId === contactId && isReminderActive(r),
    );

  const { register, watch, reset, setValue } = useForm<MessageFormInputs>({
    defaultValues: { message: "" },
  });
  const messageValue = watch("message");

  // Custom Hooks
  const {
    phoneNumbers,
    selectedPhone,
    setSelectedPhone,
    selectedPhoneMeta,
    outboundPhoneNumberId,
    contactTags,
    acceptedTeamMembers,
    pipelineStages,
    totalContacts,
    paginatedContacts,
    loadingContacts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    messages,
    loadingMessages,
    messagesError,
    refetchMessages,
    fetchOlderMessages,
    hasOlderMessages,
    isFetchingOlderMessages,
    isWindowOpenFromAPI,
    processedUrlRef,
    messageTarget,
    setMessageTarget,
  } = useInboxData({
    selectedContact,
    setSelectedContact,
    searchQuery,
    selectedTag,
    selectedPipelineStage,
    selectedAgentId,
    selectedReadFilter,
    urlPhone,
    urlName,
    urlContactId,
    urlPhoneNumberId,
    urlMessageId,
    urlWamid,
  });

  const { windowState } = useServiceWindow(selectedContact);

  // Last incoming message the user actually saw, per open conversation.
  const conversationKey = `${selectedPhone}:${selectedContact?.id ?? ""}`;
  const [viewed, setViewed] = useState<{ key: string; message: Message } | null>(null);
  const handleIncomingViewed = useCallback(
    (message: Message) => setViewed({ key: conversationKey, message }),
    [conversationKey],
  );
  const handleTargetSettled = useCallback((found: boolean) => {
    if (!found) toast("That message is no longer in this conversation's history.");
  }, []);

  useMarkConversationRead({
    selectedContact,
    selectedPhone,
    viewedMessage: viewed?.key === conversationKey ? viewed.message : null,
  });

  const handleReadFilterChange = (filter: "all" | "unread" | "read") => {
    if (filter === "all" && selectedPhone) {
      // Reset All to page 1, including when its chip is already selected.
      void queryClient.resetQueries({
        queryKey: [
          "contacts",
          selectedPhone,
          searchQuery,
          selectedTag,
          selectedPipelineStage,
          selectedAgentId,
          "all",
        ],
        exact: true,
      });
    }
    setSelectedReadFilter(filter);
  };

  const {
    isRecording,
    audioBlob,
    setAudioBlob,
    recordingTime,
    setRecordingTime,
    finalRecordingTimeRef,
    startRecording,
    stopRecording,
    cancelRecording,
    formatTime,
  } = useVoiceRecording();

  useInboxSocket({
    selectedContact,
    selectedPhone,
    senderIds: [selectedPhone, outboundPhoneNumberId, String(selectedPhoneMeta?.id ?? "")],
  });

  const {
    sendMessageMutation,
    handleSend,
    handleContactSelect,
    handleAssignMultiple,
    handleBulkAssign,
    isBulkAssigning,
    handlePhoneSelect,
    clearAllFilters,
    handleFileSelect,
  } = useInboxActions({
    selectedContact,
    setSelectedContact,
    selectedPhone,
    setSelectedPhone,
    phoneNumbers,
    outboundPhoneNumberId,
    searchQuery,
    selectedTag,
    setSelectedTag,
    setSelectedPipelineStage,
    setSelectedAgentId,
    setSelectedReadFilter,
    setActiveDropdown,
    setShowPipelineMenu,
    setShowAgentMenu,
    setShowReadMenu,
    setShowTagMenu,
    setShowFilterMenu,
    setShowAssignDropdown,
    setAssignLoading,
    setSelectedAssignees,
    acceptedTeamMembers,
    messageValue,
    reset,
    selectedFile,
    setSelectedFile,
    audioBlob,
    setAudioBlob,
    setRecordingTime,
    selectedGalleryMedia,
    setSelectedGalleryMedia,
    setIsSendingMedia,
    fileInputRef,
    setShowAttachMenu,
    processedUrlRef,
  });

  // A notification target must not be hidden by filters, search or stale pages.
  useEffect(() => {
    if (!urlContactId) return;
    clearAllFilters();
    setSearchQuery("");
    void queryClient.resetQueries({ queryKey: ["contacts"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlContactId, urlPhoneNumberId, urlMessageId, urlWamid]);

  /* Close attach menu when clicking outside */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (showAttachMenu) {
        const attachMenu = document.querySelector(".attach-menu");
        const attachButton = document.querySelector(".attach-button");
        if (
          attachMenu &&
          !attachMenu.contains(target) &&
          !attachButton?.contains(target)
        ) {
          setShowAttachMenu(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachMenu]);

  return (
    <div
      className={cn(
        styles.screen,
        selectedContact && styles.hasSelection,
        selectedContact && showContactPanel && styles.withPanel,
      )}
    >
      {/* Conversation list */}
      <div className={styles.listPane}>
        <ConversationList
          selectedContact={selectedContact}
          selectedPipelineStage={selectedPipelineStage}
          setSelectedPipelineStage={setSelectedPipelineStage}
          pipelineStages={pipelineStages}
          selectedReadFilter={selectedReadFilter}
          setSelectedReadFilter={handleReadFilterChange}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          acceptedTeamMembers={acceptedTeamMembers}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          contactTags={contactTags}
          hasActiveFilters={hasActiveFilters}
          clearAllFilters={clearAllFilters}
          phoneNumbers={phoneNumbers}
          selectedPhone={selectedPhone}
          selectedPhoneMeta={selectedPhoneMeta}
          showPhoneDropdown={showPhoneDropdown}
          setShowPhoneDropdown={setShowPhoneDropdown}
          handlePhoneSelect={(phoneId: string) => {
            setMessageTarget(null);
            handlePhoneSelect(phoneId);
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showFilterMenu={showFilterMenu}
          setShowFilterMenu={setShowFilterMenu}
          paginatedContacts={paginatedContacts}
          totalContacts={totalContacts}
          loadingContacts={loadingContacts}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          handleContactSelect={(contact: Contact) => {
            setMessageTarget(null);
            handleContactSelect(contact);
          }}
          getContactReminders={getContactReminders}
          handleBulkAssign={handleBulkAssign}
          isBulkAssigning={isBulkAssigning}
        />
      </div>

      {/* Active conversation */}
      <div className={styles.chatPane}>
        {!selectedContact ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <MessagesSquare size={30} />
            </span>
            <h2 className={styles.emptyTitle}>Select a conversation</h2>
            <p className={styles.emptyText}>
              Choose a contact from the list to start viewing messages.
            </p>
          </div>
        ) : (
          <>
            <ChatHeader
              selectedContact={selectedContact}
              setSelectedContact={setSelectedContact}
              showContactPanel={showContactPanel}
              setShowContactPanel={setShowContactPanel}
              showAssignDropdown={showAssignDropdown}
              setShowAssignDropdown={setShowAssignDropdown}
              assignDropdownRef={assignDropdownRef}
              acceptedTeamMembers={acceptedTeamMembers}
              selectedAssignees={selectedAssignees}
              setSelectedAssignees={setSelectedAssignees}
              assignLoading={assignLoading}
              handleAssignMultiple={handleAssignMultiple}
              isWindowOpenFromAPI={isWindowOpenFromAPI}
              windowState={windowState}
              onSendTemplate={() => setShowTemplateSelector(true)}
            />

            <MessageList
              key={`${selectedPhone}:${selectedContact.id}`}
              messages={messages}
              outboundPhoneNumberId={outboundPhoneNumberId}
              messagesEndRef={messagesEndRef}
              loadingMessages={loadingMessages}
              messagesError={messagesError}
              hasOlderMessages={hasOlderMessages}
              isFetchingOlderMessages={isFetchingOlderMessages}
              fetchOlderMessages={fetchOlderMessages}
              refetchMessages={refetchMessages}
              target={messageTarget}
              onTargetSettled={handleTargetSettled}
              onIncomingViewed={handleIncomingViewed}
            />

            <Composer
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              fileInputRef={fileInputRef}
              selectedGalleryMedia={selectedGalleryMedia}
              setSelectedGalleryMedia={setSelectedGalleryMedia}
              audioBlob={audioBlob}
              setAudioBlob={setAudioBlob}
              recordingTime={recordingTime}
              setRecordingTime={setRecordingTime}
              finalRecordingTimeRef={finalRecordingTimeRef}
              formatTime={formatTime}
              isRecording={isRecording}
              cancelRecording={cancelRecording}
              stopRecording={stopRecording}
              startRecording={startRecording}
              isWindowOpenFromAPI={isWindowOpenFromAPI}
              showAttachMenu={showAttachMenu}
              setShowAttachMenu={setShowAttachMenu}
              handleFileSelect={handleFileSelect}
              setShowGalleryPicker={setShowGalleryPicker}
              setShowTemplateSelector={setShowTemplateSelector}
              register={register}
              setValue={(name, value) => setValue(name, value, { shouldDirty: true })}
              handleSend={handleSend}
              messageValue={messageValue}
              sendMessageMutation={sendMessageMutation}
              isSendingMedia={isSendingMedia}
            />
          </>
        )}
      </div>

      {/* Contact info */}
      {selectedContact && showContactPanel && (
        <div className={styles.panelPane}>
          <ContactDetailsPanel
            contact={selectedContact}
            onClose={() => setShowContactPanel(false)}
            onContactUpdated={(updated) => {
              setSelectedContact((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  ...updated,
                  id: prev.id,
                  name: typeof updated.name === "string" ? updated.name : prev.name,
                  tags: Array.isArray(updated.tags)
                    ? updated.tags.map((t) => (typeof t === "string" ? t : String(t?.name || t?.id || "")))
                    : prev.tags,
                  assigned_to: Array.isArray(updated.assigned_to)
                    ? (updated.assigned_to as string[])
                    : typeof updated.assigned_to === "string"
                      ? [updated.assigned_to]
                      : prev.assigned_to,
                } as Contact;
              });
            }}
            availableTags={contactTags}
            pipelineStages={pipelineStages}
            teamMembers={acceptedTeamMembers}
            outboundPhoneNumberId={outboundPhoneNumberId}
            wabaPhoneNumberRecordId={selectedPhoneMeta?.id}
          />
        </div>
      )}

      {/* FAQ Flow */}
      {showFAQFlow && selectedContact && (
        <FAQFlow
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          onClose={() => setShowFAQFlow(false)}
          botId={selectedBotForFAQ}
        />
      )}

      {/* Template selector */}
      {showTemplateSelector && selectedContact && (
        <TemplateSelectorModal
          isOpen={showTemplateSelector}
          onClose={() => setShowTemplateSelector(false)}
          contactPhone={selectedContact.phone || ""}
          contactName={selectedContact.name}
          phoneNumberId={outboundPhoneNumberId}
          onSend={async (
            templateId: string | number,
            variables: Record<string, string>,
            templateData?: any,
          ): Promise<void> => {
            try {
              const token = localStorage.getItem("console_access_token");

              if (!token) {
                toast.error("Console token required");
                return;
              }

              if (!selectedContact?.phone) {
                toast.error("Contact phone is required");
                return;
              }

              const resolvedPhoneNumberId = String(
                selectedPhoneMeta?.id || outboundPhoneNumberId || "",
              ).trim();
              if (!resolvedPhoneNumberId) {
                toast.error("Phone number ID is required");
                return;
              }

              const templateComponents = Array.isArray(templateData?.components)
                ? templateData.components
                : [];
              const templateVars = getTemplateVariables(templateComponents);
              const formattedParams = formatTemplateParameters(
                templateVars,
                variables || {},
                templateComponents,
              );

              const components: any[] = [];
              if (formattedParams.header.length > 0) {
                components.push({
                  type: "header",
                  parameters: formattedParams.header,
                });
              }
              if (formattedParams.body.length > 0) {
                components.push({
                  type: "body",
                  parameters: formattedParams.body,
                });
              }
              if (formattedParams.buttons.length > 0) {
                components.push(...formattedParams.buttons);
              }

              // Build final payload
              const payload = {
                phone_number_id: resolvedPhoneNumberId,
                to: selectedContact.phone.replace(/\D/g, ""),
                type: "template",
                template: {
                  name: templateData?.name,
                  language: templateData?.language || "en",
                  components: components,
                },
              };

              console.log(
                "📤 Sending template payload:",
                JSON.stringify(payload, null, 2),
              );

              // Call EXTERNAL API via soft7AxiosInstance
              const response = await soft7AxiosInstance.post(
                "/admin/messages/send",
                payload,
              );

              const data = response.data;

              console.log("📥 API Response:", {
                status: response.status,
                ok: response.status.toString().startsWith("2"),
                data,
              });

              if (!response.status.toString().startsWith("2")) {
                const errorMsg =
                  data?.error ||
                  data?.message ||
                  `Failed to send template (${response.status})`;
                console.error("❌ Template error:", errorMsg);
                toast.error(errorMsg);
                return;
              }

              queryClient.invalidateQueries({
                queryKey: ["messages", selectedContact.id],
              });
              queryClient.invalidateQueries({ queryKey: ["contacts"] });
              toast.success("Template sent successfully!");
            } catch (error: any) {
              console.error("Error sending template:", error);
              toast.error(error?.message || "Failed to send template");
            }
          }}
        />
      )}

      {/* Contact profile */}
      <ContactProfileModal
        isOpen={showContactDetailsModal}
        onClose={() => setShowContactDetailsModal(false)}
        selectedContact={selectedContact}
      />

      {/* Gallery picker */}
      <GalleryPickerModal
        isOpen={showGalleryPicker}
        onClose={() => setShowGalleryPicker(false)}
        onSelect={(media) => {
          setSelectedGalleryMedia(media);
          setShowGalleryPicker(false);
        }}
      />
    </div>
  );
}
