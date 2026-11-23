/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { uploadMedia, getUploadedMediaUrl } from "@/lib/media-upload";
import toast from "react-hot-toast";
import { Contact, Message, MessagesPage } from "../types/inbox.types";
import { appendMessageToPages } from "../utils/message-pages.utils";
import { getConsoleToken } from "../utils/auth.utils";
import {
  normalizePhone,
  normalizeLeadNumber,
} from "../utils/phone.utils";
import { convertAudioBlobToMp3 } from "@/utils/audioConverter";
import { getBackendContactId } from "../utils/contact.utils";

const BULK_ASSIGN_CONCURRENCY = 5;

interface UseInboxActionsProps {
  selectedContact: Contact | null;
  setSelectedContact: (c: Contact | null) => void;
  selectedPhone: string;
  setSelectedPhone: (p: string) => void;
  phoneNumbers: any[];
  outboundPhoneNumberId: string;
  searchQuery: string;
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  setSelectedPipelineStage: (s: string | null) => void;
  setSelectedAgentId: (a: string | null) => void;
  setSelectedReadFilter: (r: "all" | "unread" | "read") => void;
  setActiveDropdown: (d: "Unread" | "Assigned" | "Unassigned" | null) => void;
  setShowPipelineMenu: (b: boolean) => void;
  setShowAgentMenu: (b: boolean) => void;
  setShowReadMenu: (b: boolean) => void;
  setShowTagMenu: (b: boolean) => void;
  setShowFilterMenu: (b: boolean) => void;
  setShowAssignDropdown: (b: boolean) => void;
  setAssignLoading: (b: boolean) => void;
  setSelectedAssignees: (a: string[]) => void;
  acceptedTeamMembers: any[];
  messageValue: string;
  reset: () => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  audioBlob: Blob | null;
  setAudioBlob: (b: Blob | null) => void;
  setRecordingTime: (t: number) => void;
  selectedGalleryMedia: any;
  setSelectedGalleryMedia: (m: any) => void;
  setIsSendingMedia: (b: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setShowAttachMenu: (b: boolean) => void;
  processedUrlRef: React.MutableRefObject<string | null>;
}

export function useInboxActions({
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
}: UseInboxActionsProps) {
  const queryClient = useQueryClient();
  const lastProcessedUrlKeyRef = React.useRef<string | null>(null);

  const handleContactSelect = (contact: Contact) => {
    processedUrlRef.current = "MANUALLY_SELECTED";
    lastProcessedUrlKeyRef.current = "MANUALLY_SELECTED";
    setSelectedContact(contact);
    setShowAssignDropdown(false);

    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const handleAssign = async (memberId: string, memberName: string) => {
    if (!selectedContact) return;
    try {
      setAssignLoading(true);
      await soft7AxiosInstance.patch(`/admin/contacts/assign`, {
        phone_number: selectedContact.phone,
        assigned_to: memberId,
      });
      setShowAssignDropdown(false);
      alert(`✅ Conversation assigned to ${memberName}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to assign contact");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignMultiple = async (memberIds: string[]) => {
    if (!selectedContact || memberIds.length === 0) return;
    try {
      setAssignLoading(true);
      await Promise.all(
        memberIds.map(async (memberId) => {
          try {
            await soft7AxiosInstance.patch(`/admin/contacts/assign`, {
              phone_number: selectedContact.phone,
              assigned_to: memberId,
            });
          } catch (e: any) {
            console.error(
              `Assign failed for ${memberId}:`,
              e?.response?.data?.message || e?.message,
            );
          }
          try {
            await soft7AxiosInstance.patch(
              `/admin/team/${memberId}/permissions`,
              {
                add: ["inbox"],
              },
            );
          } catch {
            // endpoint may not exist yet — ignore silently
          }
        }),
      );
      const names = (acceptedTeamMembers as any[])
        .filter((m: any) => memberIds.includes(m.id))
        .map((m: any) => m.name || m.email)
        .join(", ");
      setShowAssignDropdown(false);
      setSelectedAssignees([]);
      alert(`✅ Assigned to: ${names}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to assign");
    } finally {
      setAssignLoading(false);
    }
  };

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ contactIds, userId }: { contactIds: string[]; userId: string }) => {
      const succeeded: string[] = [];
      const failed: { id: string; message: string }[] = [];
      for (let i = 0; i < contactIds.length; i += BULK_ASSIGN_CONCURRENCY) {
        const batch = contactIds.slice(i, i + BULK_ASSIGN_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((id) =>
            soft7AxiosInstance.put(`/admin/contacts/${id}/assigned`, { assigned_to: userId }),
          ),
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") succeeded.push(batch[idx]);
          else {
            const err: any = r.reason;
            failed.push({ id: batch[idx], message: err?.response?.data?.message || err?.message || "Request failed" });
          }
        });
      }
      return { succeeded, failed };
    },
  });

  /** Assigns every given contact to one team member. Resolves true only if all succeeded. */
  const handleBulkAssign = async (contactIds: string[], member: { userId: string; name: string }): Promise<boolean> => {
    if (contactIds.length === 0 || bulkAssignMutation.isPending) return false;

    let result: { succeeded: string[]; failed: { id: string; message: string }[] };
    try {
      result = await bulkAssignMutation.mutateAsync({ contactIds, userId: member.userId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign chats");
      return false;
    }

    const done = new Set(result.succeeded);
    if (done.size > 0) {
      // Backend appends to assigned_to (deduped), so mirror that locally.
      const withAssignee = (c: Contact): Contact => {
        const backendId = getBackendContactId(c);
        if (!backendId || !done.has(backendId)) return c;
        const current = Array.isArray(c.assigned_to) ? c.assigned_to : [];
        return current.includes(member.userId) ? c : { ...c, assigned_to: [...current, member.userId] };
      };
      queryClient.setQueriesData({ queryKey: ["contacts", selectedPhone] }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({ ...page, contacts: page.contacts.map(withAssignee) })),
        };
      });
      if (selectedContact) {
        const updated = withAssignee(selectedContact);
        if (updated !== selectedContact) setSelectedContact(updated);
      }
      // Refresh backend results so assignment filters and counts stay accurate.
      void queryClient.invalidateQueries({ queryKey: ["contacts", selectedPhone] });
    }

    if (result.failed.length === 0) {
      toast.success(
        `${result.succeeded.length} chat${result.succeeded.length === 1 ? "" : "s"} assigned to ${member.name}`,
      );
      return true;
    }

    const firstMessage = result.failed[0].message;
    toast.error(
      result.succeeded.length > 0
        ? `Assigned ${result.succeeded.length} of ${contactIds.length} chats. ${result.failed.length} failed: ${firstMessage}`
        : `Failed to assign chats: ${firstMessage}`,
    );
    return false;
  };

  const handlePhoneSelect = (phoneId: string) => {
    const matched = (phoneNumbers as any[])?.find(
      (p: any) =>
        String(p.id) === String(phoneId) ||
        String(p.phoneNumberId) === String(phoneId) ||
        String(p.phone_number_id) === String(phoneId),
    );
    const resolvedId = String(matched?.id || phoneId);
    setSelectedPhone(resolvedId);
    if (typeof window !== "undefined") {
      localStorage.setItem("inbox_selected_phone", resolvedId);
    }
    setShowFilterMenu(false);
  };

  const clearAllFilters = () => {
    setSelectedPipelineStage(null);
    setSelectedAgentId(null);
    setSelectedTag(null);
    setSelectedReadFilter("all");
    setActiveDropdown(null);
    setShowPipelineMenu(false);
    setShowAgentMenu(false);
    setShowReadMenu(false);
    setShowTagMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setShowAttachMenu(false);
    }
  };

  // ✅ Send message mutation using ngrok API
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = getConsoleToken();

      if (!token) {
        throw new Error("Unauthorized");
      }

      const hasWhatsappShape =
        payload?.messaging_product === "whatsapp" &&
        !!payload?.phone_number_id &&
        !!payload?.to &&
        !!payload?.type;

      let apiPayload: any = payload;

      if (!hasWhatsappShape) {
        const recipient =
          payload?.recipient ||
          payload?.recipient_phone ||
          payload?.to ||
          payload?.leadNumber;
        const phoneNumberId =
          payload?.phone_number_id ||
          payload?.phoneNumberId ||
          payload?.phone_number ||
          payload?.phone;
        const messageType = payload?.message_type || payload?.type || "text";
        const text =
          typeof payload?.text === "string"
            ? payload.text
            : typeof payload?.message === "string"
              ? payload.message
              : typeof payload?.content === "string"
                ? payload.content
                : "";

        const recipientDigits = String(recipient ?? "").replace(/\D/g, "");

        if (!recipientDigits || !phoneNumberId || !messageType) {
          const error: any = new Error(
            "Phone number ID, recipient, and message type are required",
          );
          error.response = {
            data: {
              message:
                "Phone number ID, recipient, and message type are required",
            },
          };
          throw error;
        }

        apiPayload = {
          messaging_product: "whatsapp",
          phone_number_id: String(phoneNumberId),
          to: recipientDigits,
          recipient_type: "individual",
          type: String(messageType),
          ...(String(messageType) === "text"
            ? {
                text: {
                  body: text,
                },
              }
            : {
                text: {
                  body: text,
                },
              }),
        };
      }

      const response = await soft7AxiosInstance.post(
        "/admin/messages/send",
        apiPayload,
      );

      const data = response.data;

      if (!response.status.toString().startsWith("2")) {
        const error: any = new Error(
          data?.message || data?.error || "Failed to send message",
        );
        error.response = { data };
        throw error;
      }

      return data;
    },
    onSuccess: (response: any, variables: any) => {
      const outgoingText =
        typeof variables?.text === "string" ? variables.text.trim() : "";
      const possibleWamid =
        response?.wamid ||
        response?.id ||
        response?.messageId ||
        response?.data?.wamid ||
        response?.data?.id ||
        response?.data?.messageId ||
        null;

      if (selectedContact?.id && outgoingText) {
        queryClient.setQueriesData<InfiniteData<MessagesPage>>(
          { queryKey: ["messages", selectedContact.id, selectedPhone] },
          (oldData) => {
            const optimisticMessage: Message = {
              id: possibleWamid || `tmp-${Date.now()}`,
              contactId: selectedContact.id,
              text: outgoingText,
              direction: "outgoing",
              status: "sent",
              createdAt: new Date().toISOString(),
              whatsappMessageId: possibleWamid,
            };
            return appendMessageToPages(oldData, optimisticMessage);
          },
        );
      }

      queryClient.invalidateQueries({
        queryKey: ["messages", selectedContact?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      reset();
      setSelectedFile(null);
      setAudioBlob(null);
      setRecordingTime(0);
      toast.success("Message sent successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to send message:", error);
      const code =
        error?.response?.data?.code ||
        error?.response?.data?.details?.error?.code ||
        error?.response?.data?.error?.code;
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.details?.message ||
        error?.response?.data?.details?.error?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to send message";

      if (code === "131047") {
        toast.error("24h window closed. Send a template message to re-engage.");
      } else {
        toast.error(msg);
      }
    },
  });

  const handleSend = async () => {
    if (!selectedContact) return;
    if (
      !messageValue.trim() &&
      !selectedFile &&
      !audioBlob &&
      !selectedGalleryMedia
    )
      return;

    // Handle media sending
    if (selectedFile || audioBlob || selectedGalleryMedia) {
      setIsSendingMedia(true);
      try {
        const recipientPhone = normalizePhone(selectedContact.phone || "");
        let firebaseUrl = "";
        let payloadType: "image" | "video" | "audio" | "document" = "document";
        let fileName = selectedFile?.name || "document";

        if (audioBlob) {
          payloadType = "audio";
          let uploadBlob: Blob = audioBlob;
          let mime = "audio/mpeg";
          try {
            uploadBlob = await convertAudioBlobToMp3(audioBlob);
          } catch (convErr) {
            console.warn(
              "Could not convert audio to MP3, attempting original blob:",
              convErr,
            );
            if (
              audioBlob.type &&
              (audioBlob.type.includes("ogg") ||
                audioBlob.type.includes("mp4") ||
                audioBlob.type.includes("mpeg"))
            ) {
              mime = audioBlob.type;
            }
          }

          const audioFile = new File([uploadBlob], `voice_${Date.now()}.mp3`, {
            type: mime,
          });
          fileName = audioFile.name;

          const uploadForm = new FormData();
          uploadForm.append("file", audioFile);
          uploadForm.append("name", audioFile.name);

          const uploadData = await uploadMedia(uploadForm);
          firebaseUrl = getUploadedMediaUrl(uploadData);

          if (!firebaseUrl) {
            throw new Error(
              "Failed to upload audio to Firebase",
            );
          }
        } else if (selectedGalleryMedia) {
          firebaseUrl =
            selectedGalleryMedia.url ||
            selectedGalleryMedia.firebase_url ||
            selectedGalleryMedia.firebaseUrl ||
            selectedGalleryMedia.media_url ||
            "";

          const mediaType = String(
            selectedGalleryMedia.type || selectedGalleryMedia.mimetype || "",
          ).toLowerCase();

          if (mediaType.startsWith("image/") || mediaType === "image") {
            payloadType = "image";
          } else if (mediaType.startsWith("video/") || mediaType === "video") {
            payloadType = "video";
          } else if (mediaType.startsWith("audio/") || mediaType === "audio") {
            payloadType = "audio";
          } else {
            payloadType = "document";
          }

          fileName =
            selectedGalleryMedia.fileName ||
            selectedGalleryMedia.name ||
            "document";

          if (!firebaseUrl) {
            throw new Error("Selected gallery media has no valid URL");
          }
        } else if (selectedFile) {
          const fileType = String(selectedFile.type || "").toLowerCase();
          if (fileType.startsWith("image/")) {
            payloadType = "image";
          } else if (fileType.startsWith("video/")) {
            payloadType = "video";
          } else if (fileType.startsWith("audio/")) {
            payloadType = "audio";
          } else {
            payloadType = "document";
          }
          fileName = selectedFile.name;

          const uploadForm = new FormData();
          uploadForm.append("file", selectedFile);
          uploadForm.append("name", selectedFile.name);

          const uploadData = await uploadMedia(uploadForm);
          firebaseUrl = getUploadedMediaUrl(uploadData);

          if (!firebaseUrl) {
            throw new Error(
              `Failed to upload ${payloadType} file`,
            );
          }
        }

        const sendPayload: any = {
          messaging_product: "whatsapp",
          phone_number_id: outboundPhoneNumberId,
          to: recipientPhone,
          type: payloadType,
        };

        const captionText = messageValue.trim();

        if (payloadType === "image") {
          sendPayload.image = {
            link: firebaseUrl,
            ...(captionText ? { caption: captionText } : {}),
          };
        } else if (payloadType === "video") {
          sendPayload.video = {
            link: firebaseUrl,
            ...(captionText ? { caption: captionText } : {}),
          };
        } else if (payloadType === "audio") {
          sendPayload.audio = {
            link: firebaseUrl,
          };
        } else {
          sendPayload.document = {
            link: firebaseUrl,
            filename: fileName,
            ...(captionText ? { caption: captionText } : {}),
          };
        }

        const sendRes = await soft7AxiosInstance.post(
          "/admin/messages/send",
          sendPayload,
        );
        const sendData = sendRes.data;

        if (sendRes.status.toString().startsWith("2")) {
          const typeLabel =
            payloadType === "image"
              ? "Image"
              : payloadType === "video"
                ? "Video"
                : payloadType === "audio"
                  ? "Voice message"
                  : "Document";
          toast.success(`${typeLabel} sent successfully!`);

          const possibleWamid =
            sendData?.wamid ||
            sendData?.data?.wamid ||
            sendData?.data?.whatsapp_message_id ||
            sendData?.data?.id ||
            sendData?.id ||
            null;

          if (selectedContact?.id) {
            queryClient.setQueriesData<InfiniteData<MessagesPage>>(
              { queryKey: ["messages", selectedContact.id, selectedPhone] },
              (oldData) => {
                const optimisticMessage: any = {
                  id: possibleWamid || `tmp-${Date.now()}`,
                  contactId: selectedContact.id,
                  text: captionText || "",
                  mediaUrl: firebaseUrl,
                  mediaType:
                    payloadType === "image"
                      ? "image/png"
                      : payloadType === "video"
                        ? "video/mp4"
                        : payloadType === "audio"
                          ? "audio/mpeg"
                          : "application/pdf",
                  messageType: payloadType,
                  type: payloadType,
                  direction: "outgoing",
                  status: "sent",
                  createdAt: new Date().toISOString(),
                  whatsappMessageId: possibleWamid,
                  content: {
                    [payloadType]: {
                      link: firebaseUrl,
                      filename: fileName,
                      caption: captionText || undefined,
                    },
                  },
                };
                return appendMessageToPages(oldData, optimisticMessage);
              },
            );
          }

          queryClient.invalidateQueries({
            queryKey: ["messages", selectedContact.id],
          });
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          reset();
          setSelectedFile(null);
          setAudioBlob(null);
          setRecordingTime(0);
          setSelectedGalleryMedia(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } else {
          toast.error(sendData?.message || `Failed to send ${payloadType}`);
        }
      } catch (error: any) {
        console.error("Failed to send media:", error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "Failed to send media",
        );
      } finally {
        setIsSendingMedia(false);
      }
      return;
    }

    // Text-only message
    try {
      const outgoingText = messageValue.trim();
      await sendMessageMutation.mutateAsync({
        contactId: selectedContact.id,
        text: outgoingText,
        message: outgoingText,
        content: outgoingText,
        type: "text",
        message_type: "text",
        phone_number_id: outboundPhoneNumberId,
        recipient: normalizeLeadNumber(selectedContact.phone || ""),
      });
    } catch {
      // Error toast is already handled in mutation onError.
    }
  };

  return {
    sendMessageMutation,
    handleSend,
    handleContactSelect,
    handleAssign,
    handleAssignMultiple,
    handleBulkAssign,
    isBulkAssigning: bulkAssignMutation.isPending,
    handlePhoneSelect,
    clearAllFilters,
    handleFileSelect,
  };
}
