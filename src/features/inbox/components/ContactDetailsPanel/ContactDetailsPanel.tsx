"use client";

import React, { useState, useEffect, useRef } from "react";
import { isAxiosError } from "axios";
import {
  X,
  User,
  Phone,
  Mail,
  Tag,
  Plus,
  Save,
  Trash2,
  Copy,
  ExternalLink,
  Check,
  RefreshCw,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Layers,
  UserCheck,
  Info,
  CheckCircle2,
  AlertCircle,
  Hash,
  Search,
  Pencil,
} from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import Textarea from "@/components/ui/Textarea";
import styles from "./ContactDetailsPanel.module.css";

export interface ContactItem {
  id?: string | number;
  name?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  email?: string | null;
  status?: string | null;
  stage?: string | null;
  rawContactId?: string | null;
  contactId?: string | number | null;
  assigned_to?: string[] | string | null;
  tags?: Array<string | { id?: string | number; name?: string }> | null;
  custom_fields?: Record<string, unknown> | null;
  attributes?: Record<string, unknown> | null;
  lastMessageTime?: string | null;
  is_opted_out?: boolean | null;
  opt_in?: boolean | null;
  is_opted_in?: boolean | null;
}

export interface ContactDetailsPanelProps {
  contact: ContactItem;
  onClose: () => void;
  onContactUpdated?: (updatedContact: Partial<ContactItem> | Record<string, unknown>) => void;
  availableTags?: Array<{ id: string | number; name: string }>;
  pipelineStages?: Array<{ id: string; name: string; color?: string }>;
  teamMembers?: Array<{ id: string; user_id?: string | null; name?: string; email?: string; role?: string }>;
  outboundPhoneNumberId?: string;
  wabaPhoneNumberRecordId?: string;
}

const isUUID = (str?: string | null): boolean =>
  typeof str === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

const isPhoneNumberName = (name?: string | null): boolean => {
  if (!name) return false;
  const cleaned = name.trim().replace(/[\s\-\(\)]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned);
};

const getOptOutStatus = (contact: ContactItem): boolean | null => {
  if (typeof contact.is_opted_out === "boolean") return contact.is_opted_out;
  if (typeof contact.opt_in === "boolean") return !contact.opt_in;
  if (typeof contact.is_opted_in === "boolean") return !contact.is_opted_in;
  return null;
};

export function ContactDetailsPanel({
  contact,
  onClose,
  onContactUpdated,
  availableTags = [],
  pipelineStages = [],
  teamMembers = [],
  outboundPhoneNumberId,
  wabaPhoneNumberRecordId,
}: ContactDetailsPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Real database contact ID (UUID)
  const [dbContactId, setDbContactId] = useState<string | null>(null);
  const [optStatus, setOptStatus] = useState<{
    value: boolean | null;
    savedValue: boolean | null;
  }>({ value: null, savedValue: null });

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    email: "",
    status: "",
    assigned_to: [] as string[],
    notes: "",
  });

  // Selected tag IDs
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [allTags, setAllTags] = useState<Array<{ id: string | number; name: string }>>(availableTags);

  // Custom attributes & columns
  const [customColumns, setCustomColumns] = useState<
    Array<{ id: string; label: string; type?: string; visible?: boolean }>
  >([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, any>>({});

  // Metadata
  const [metadata, setMetadata] = useState<{
    createdAt?: string | null;
    updatedAt?: string | null;
    lastContactedAt?: string | null;
    messageCount?: number;
    failedCount?: number;
    isValid?: boolean | null;
    invalidReason?: string | null;
  }>({});

  // Accordion section collapse states
  const [sectionsOpen, setSectionsOpen] = useState({
    optIn: true,
    tags: true,
    basic: true,
    attributes: true,
    notes: true,
    metadata: false,
  });

  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (availableTags && availableTags.length > 0) {
      setAllTags(availableTags);
    } else {
      soft7AxiosInstance
        .get("/admin/contacts/tags")
        .then((res) => {
          const payload = res.data;
          const rawList = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.data)
            ? payload.data.data
            : Array.isArray(payload?.results)
            ? payload.results
            : [];
          if (rawList.length > 0) {
            setAllTags(
              rawList.map((t: any) => ({
                id: String(t?.id ?? t),
                name: t?.name ?? t?.label ?? String(t),
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [availableTags]);

  // Fetch custom columns defined for contacts
  useEffect(() => {
    let isMounted = true;
    const fetchColumns = async () => {
      setIsLoadingColumns(true);
      try {
        const res = await soft7AxiosInstance.get("/admin/columns/");
        const rawData: any[] =
          res.data?.data ||
          res.data?.results ||
          res.data?.columns ||
          (Array.isArray(res.data) ? res.data : []);

        const systemLabels = new Set([
          "created", "created at", "created_at", "created date",
          "name", "full name", "fullname",
          "phone", "phone number", "phone_number",
          "status", "stage", "pipeline stage",
          "tags", "tag",
          "email", "email address",
          "opt in", "opt_in", "optin",
          "assigned to", "assigned_to", "assigned",
        ]);

        const validCols: Array<{ id: string; label: string; type?: string; visible?: boolean }> = [];
        for (const col of rawData) {
          const label = String(col.label || col.name || "").trim();
          if (!label) continue;
          if (systemLabels.has(label.toLowerCase())) continue;

          const isVisible =
            col.visible === true ||
            String(col.visible).toLowerCase() === "true" ||
            col.visible === 1;
          if (!isVisible) continue;

          if (!validCols.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
            validCols.push({
              id: String(col.id || col._id || label),
              label,
              type: String(col.type || "text").toLowerCase(),
              visible: true,
            });
          }
        }
        if (isMounted) {
          setCustomColumns(validCols);
        }
      } catch (err) {
        console.error("Failed to fetch custom columns for contact details:", err);
      } finally {
        if (isMounted) {
          setIsLoadingColumns(false);
        }
      }
    };

    fetchColumns();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync initial attributes and data when contact prop changes
  useEffect(() => {
    if (contact) {
      const initialCustom = {
        ...(typeof contact.custom_fields === "object" && contact.custom_fields ? contact.custom_fields : {}),
        ...(typeof contact.attributes === "object" && contact.attributes ? contact.attributes : {}),
      };
      if (Object.keys(initialCustom).length > 0) {
        setAttributes(initialCustom);
      }
      if (contact.email) {
        setFormData((prev) => ({ ...prev, email: contact.email || prev.email }));
      }
      if (contact.rawContactId) {
        setDbContactId(contact.rawContactId);
      }
    }
  }, [contact]);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch full contact record from Contact API
  const fetchContactDetails = async () => {
    if (!contact) return;
    setIsLoading(true);

    const contactPhone = String(contact.phone || contact.phone_number || "").replace(/\D/g, "");
    const cleanPhone = contactPhone.slice(-10);

    try {
      let foundRecord: any = null;

      // 1. Try finding by rawContactId / database id if it's a UUID string
      const potentialId = contact.rawContactId || contact.contactId || (typeof contact.id === "string" && contact.id.length > 20 ? contact.id : null);
      if (potentialId) {
        try {
          const res = await soft7AxiosInstance.get(`/admin/contacts/${potentialId}`);
          if (res.data?.success && res.data?.data) {
            foundRecord = res.data.data;
          }
        } catch {
          // ignore, fall back to phone search
        }
      }

      // 2. If not found yet, query contacts API with search by phone number
      if (!foundRecord && cleanPhone) {
        const searchRes = await soft7AxiosInstance.get("/admin/contacts", {
          params: { search: cleanPhone, limit: 10 },
        });
        const contactsList =
          searchRes.data?.data?.contacts ||
          searchRes.data?.contacts ||
          searchRes.data?.data ||
          [];

        if (Array.isArray(contactsList) && contactsList.length > 0) {
          foundRecord = contactsList.find((c: any) => {
            const p = String(c.phone_number || c.phone || "").replace(/\D/g, "");
            return p.endsWith(cleanPhone) || cleanPhone.endsWith(p.slice(-10));
          }) || null;
        }
      }

      // 3. Populate form fields
      if (foundRecord) {
        setDbContactId(foundRecord.id);
        const isOptedOut = getOptOutStatus(foundRecord);
        setOptStatus({ value: isOptedOut, savedValue: isOptedOut });

        const initialAssigned: string[] = Array.isArray(foundRecord.assigned_to)
          ? foundRecord.assigned_to
          : foundRecord.assigned_to
          ? [foundRecord.assigned_to]
          : Array.isArray(contact.assigned_to)
          ? contact.assigned_to
          : contact.assigned_to
          ? [contact.assigned_to]
          : [];

        setFormData({
          name: foundRecord.name || contact.name || "",
          phone_number: foundRecord.phone_number || contact.phone || "",
          email: foundRecord.email || contact.email || "",
          status: foundRecord.status || contact.status || (pipelineStages[0]?.id || ""),
          assigned_to: initialAssigned,
          notes: foundRecord.notes || "",
        });

        // Tags
        let tagsArr: string[] = [];
        if (Array.isArray(foundRecord.tags)) {
          tagsArr = foundRecord.tags.map((t: any) =>
            typeof t === "object" && t !== null ? String(t.id ?? t.name) : String(t)
          );
        } else if (Array.isArray(foundRecord.tag_ids)) {
          tagsArr = foundRecord.tag_ids.map(String);
        } else if (Array.isArray(contact.tags)) {
          tagsArr = contact.tags.map(String);
        }
        setSelectedTagIds(tagsArr);

        // Attributes & Column Fields: merge all sources
        const mergedAttrs = {
          ...(typeof contact.custom_fields === "object" && contact.custom_fields ? contact.custom_fields : {}),
          ...(typeof contact.attributes === "object" && contact.attributes ? contact.attributes : {}),
          ...(typeof foundRecord.custom_fields === "object" && foundRecord.custom_fields ? foundRecord.custom_fields : {}),
          ...(typeof foundRecord.attributes === "object" && foundRecord.attributes ? foundRecord.attributes : {}),
        };
        setAttributes(mergedAttrs);

        // Metadata
        setMetadata({
          createdAt: foundRecord.created_at || foundRecord.createdAt,
          updatedAt: foundRecord.updated_at || foundRecord.updatedAt,
          lastContactedAt: foundRecord.last_contacted_at || foundRecord.lastContactedAt,
          messageCount: foundRecord.message_count ?? 0,
          failedCount: foundRecord.failed_count ?? 0,
          isValid: foundRecord.is_valid !== undefined ? foundRecord.is_valid : true,
          invalidReason: foundRecord.invalid_reason || null,
        });
      } else {
        // Unsaved or conversation-only contact
        setDbContactId(contact.rawContactId || null);
        const isOptedOut = getOptOutStatus(contact);
        setOptStatus({ value: isOptedOut, savedValue: isOptedOut });
        const initialAssigned: string[] = Array.isArray(contact.assigned_to)
          ? contact.assigned_to
          : contact.assigned_to
          ? [contact.assigned_to]
          : [];

        setFormData({
          name: contact.name || "",
          phone_number: contact.phone || "",
          email: contact.email || "",
          status: contact.status || (pipelineStages[0]?.id || ""),
          assigned_to: initialAssigned,
          notes: "",
        });
        setSelectedTagIds(
          Array.isArray(contact.tags) ? contact.tags.map((t: any) => String(t?.id ?? t)) : []
        );
        const fallbackAttrs = {
          ...(typeof contact.custom_fields === "object" && contact.custom_fields ? contact.custom_fields : {}),
          ...(typeof contact.attributes === "object" && contact.attributes ? contact.attributes : {}),
        };
        setAttributes(fallbackAttrs);
        setMetadata({
          createdAt: null,
          updatedAt: null,
          lastContactedAt: contact.lastMessageTime || null,
          messageCount: 0,
          failedCount: 0,
          isValid: true,
          invalidReason: null,
        });
      }
    } catch (err: any) {
      console.error("Error fetching contact details:", err);
      // Fallback to props
      const isOptedOut = getOptOutStatus(contact);
      setOptStatus({ value: isOptedOut, savedValue: isOptedOut });
      const initialAssigned: string[] = Array.isArray(contact.assigned_to)
        ? contact.assigned_to
        : contact.assigned_to
        ? [contact.assigned_to]
        : [];

      setFormData({
        name: contact.name || "",
        phone_number: contact.phone || "",
        email: contact.email || "",
        status: contact.status || "",
        assigned_to: initialAssigned,
        notes: "",
      });
      setSelectedTagIds(Array.isArray(contact.tags) ? contact.tags.map(String) : []);
      const fallbackAttrs = {
        ...(typeof contact.custom_fields === "object" && contact.custom_fields ? contact.custom_fields : {}),
        ...(typeof contact.attributes === "object" && contact.attributes ? contact.attributes : {}),
      };
      setAttributes(fallbackAttrs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContactDetails();
  }, [contact?.id, contact?.phone]);

  // Handle Save
  const handleSaveContact = async () => {
    if (!formData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    if (!formData.phone_number.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setIsSaving(true);
    let savingOptStatus = false;
    try {
      const cleanPhone = formData.phone_number.trim().replace(/[^\d+]/g, "");
      let formattedPhone: string;
      if (cleanPhone.startsWith("+")) {
        formattedPhone = cleanPhone;
      } else {
        const digitsOnly = cleanPhone.replace(/\D/g, "");
        // 10-digit number without country code — assume India (+91)
        if (digitsOnly.length === 10) {
          formattedPhone = `+91${digitsOnly}`;
        } else if (digitsOnly.length > 10) {
          // Already includes country code
          formattedPhone = `+${digitsOnly}`;
        } else {
          // Short number, just prepend +
          formattedPhone = `+${digitsOnly}`;
        }
      }

      // Build the full payload for updates
      const fullPayload: any = {
        name: formData.name.trim(),
        phone_number: formattedPhone,
        email: formData.email.trim() || null,
        status: formData.status || undefined,
        assigned_to: Array.isArray(formData.assigned_to)
          ? formData.assigned_to
          : formData.assigned_to
          ? [formData.assigned_to]
          : [],
        tag_ids: selectedTagIds,
        attributes: attributes,
        notes: formData.notes.trim() || null,
      };

      let resultContact: any = null;

      if (dbContactId) {
        // Update existing contact
        const res = await soft7AxiosInstance.put(`/admin/contacts/${dbContactId}`, fullPayload);
        resultContact = res.data?.data || res.data?.contact || { id: dbContactId, ...fullPayload };
      } else {
        // Create new contact — match the format used by the working Create Contact page
        const phoneDigitsOnly = formattedPhone.replace(/\D/g, "");
        // Extract country code: for numbers starting with +91 (India), country code is "91"
        const countryCode = phoneDigitsOnly.length > 10
          ? phoneDigitsOnly.slice(0, phoneDigitsOnly.length - 10)
          : "91"; // default to India

        // Resolve a valid UUID for phone_number_id (foreign key in PostgreSQL)
        let resolvedWabaUuid: string | null = null;
        if (isUUID(wabaPhoneNumberRecordId)) {
          resolvedWabaUuid = wabaPhoneNumberRecordId!.trim();
        } else if (isUUID(outboundPhoneNumberId)) {
          resolvedWabaUuid = outboundPhoneNumberId!.trim();
        } else {
          try {
            const wabaRes = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
            const numbers = wabaRes.data?.data || wabaRes.data || [];
            if (Array.isArray(numbers) && numbers.length > 0) {
              const matched = numbers.find((n: any) =>
                String(n.phone_number_id) === String(outboundPhoneNumberId) ||
                String(n.id) === String(outboundPhoneNumberId) ||
                (n.display_phone_number && String(n.display_phone_number).replace(/\D/g, "") === String(outboundPhoneNumberId).replace(/\D/g, ""))
              ) || numbers[0];
              if (matched?.id && isUUID(matched.id)) {
                resolvedWabaUuid = matched.id;
              }
            }
          } catch {
            // Non-critical
          }
        }

        const createPayload: any = {
          name: formData.name.trim(),
          phone_number: formattedPhone,
          email: formData.email.trim() || "",
          country_code: countryCode,
          custom_fields: attributes && Object.keys(attributes).length > 0 ? attributes : {},
        };
        if (selectedTagIds.length > 0) createPayload.tag_ids = selectedTagIds;
        if (formData.notes.trim()) createPayload.notes = formData.notes.trim();
        // IMPORTANT: PostgreSQL contacts table requires phone_number_id to be a valid UUID.
        // Passing non-UUID strings (such as Meta's numeric phone_number_id) causes PostgreSQL to throw 500 error.
        if (resolvedWabaUuid && isUUID(resolvedWabaUuid)) {
          createPayload.phone_number_id = resolvedWabaUuid;
        }

        try {
          const res = await soft7AxiosInstance.post("/admin/contacts", createPayload);
          resultContact = res.data?.data || res.data?.contact || createPayload;
          if (resultContact?.id) {
            setDbContactId(resultContact.id);
          }

          // If status or assigned_to need to be set, update the newly created contact
          const hasAssigned = Array.isArray(formData.assigned_to) ? formData.assigned_to.length > 0 : Boolean(formData.assigned_to);
          if (resultContact?.id && (formData.status || hasAssigned)) {
            try {
              const updateFields: any = {};
              if (formData.status) updateFields.status = formData.status;
              if (hasAssigned) {
                updateFields.assigned_to = Array.isArray(formData.assigned_to) ? formData.assigned_to : [formData.assigned_to];
              }
              await soft7AxiosInstance.put(`/admin/contacts/${resultContact.id}`, updateFields);
            } catch {
              // Non-critical, contact was created successfully
            }
          }
        } catch (createErr: any) {
          // If create fails (e.g. phone already exists), try to find existing contact and update
          console.warn("Create contact failed, attempting to find existing contact:", createErr?.response?.data?.message);
          const phoneDigits = formattedPhone.replace(/\D/g, "").slice(-10);
          const searchRes = await soft7AxiosInstance.get("/admin/contacts", {
            params: { search: phoneDigits, limit: 10 },
          });
          const contactsList =
            searchRes.data?.data?.contacts ||
            searchRes.data?.contacts ||
            searchRes.data?.data ||
            [];

          const existingContact = Array.isArray(contactsList)
            ? contactsList.find((c: any) => {
                const p = String(c.phone_number || c.phone || "").replace(/\D/g, "");
                return p.endsWith(phoneDigits) || phoneDigits.endsWith(p.slice(-10));
              })
            : null;

          if (existingContact?.id) {
            // Found existing contact, update it instead
            const updateRes = await soft7AxiosInstance.put(`/admin/contacts/${existingContact.id}`, fullPayload);
            resultContact = updateRes.data?.data || updateRes.data?.contact || { id: existingContact.id, ...fullPayload };
            setDbContactId(existingContact.id);
          } else {
            // Could not find existing contact either, propagate original error
            throw createErr;
          }
        }
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });

      if (optStatus.value !== null && optStatus.value !== optStatus.savedValue) {
        const savedContactId = resultContact?.id || dbContactId;
        savingOptStatus = true;
        if (!savedContactId) {
          throw new Error("The contact API did not return a contact ID. Refresh and try again.");
        }
        const optPayload = { is_opted_out: optStatus.value };
        try {
          await soft7AxiosInstance.put(`/admin/contacts/${savedContactId}/opt-in-out`, optPayload);
        } catch (optError) {
          // Older deployments expose this route without the admin prefix.
          if (!isAxiosError(optError) || ![404, 405].includes(optError.response?.status ?? 0)) throw optError;
          await soft7AxiosInstance.put(`/contacts/${savedContactId}/opt-in-out`, optPayload);
        }
        setOptStatus({ value: optStatus.value, savedValue: optStatus.value });
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      }

      if (onContactUpdated) {
        onContactUpdated({
          ...contact,
          name: formData.name,
          phone: formattedPhone,
          status: formData.status,
          assigned_to: formData.assigned_to,
          tags: selectedTagIds,
          attributes: attributes,
          rawContactId: dbContactId || resultContact?.id,
          ...(optStatus.value !== null ? {
            is_opted_out: optStatus.value,
            opt_in: !optStatus.value,
            is_opted_in: !optStatus.value,
          } : {}),
        });
      }
      toast.success(dbContactId ? "Contact updated successfully" : "Contact saved to CRM successfully");
    } catch (err: any) {
      console.error("Failed to save contact:", err);
      const backendError =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.response?.data?.error;
      const msg = backendError || err.message || "Failed to update contact";
      const statusSuffix = err.response?.status ? ` (${err.response.status})` : "";
      toast.error(`${savingOptStatus ? "Contact details saved, but opt-in status could not be updated: " : ""}${msg}${statusSuffix}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Add / Remove tag helpers
  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  };

  // Create new tag inline
  const handleCreateTag = async () => {
    if (!tagSearch.trim()) return;
    setIsCreatingTag(true);
    try {
      const res = await soft7AxiosInstance.post("/admin/contacts/tags", {
        name: tagSearch.trim(),
      });
      const createdTag = res.data?.data || res.data;
      const newTagObj = {
        id: String(createdTag?.id ?? Date.now()),
        name: createdTag?.name ?? tagSearch.trim(),
      };
      setAllTags((prev) => [...prev, newTagObj]);
      setSelectedTagIds((prev) => [...prev, String(newTagObj.id)]);
      setTagSearch("");
      toast.success(`Tag "${newTagObj.name}" created`);
      queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create tag");
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Helper to extract the value for a custom column from attributes
  const getColumnValue = (col: { id: string; label: string }) => {
    if (!attributes || typeof attributes !== "object") return "";

    // 1. Direct match on col.label or col.id
    if (attributes[col.label] !== undefined && attributes[col.label] !== null) {
      return String(attributes[col.label]);
    }
    if (attributes[col.id] !== undefined && attributes[col.id] !== null) {
      return String(attributes[col.id]);
    }

    // 2. Case-insensitive match on label
    const labelLower = col.label.toLowerCase().trim();
    for (const [k, v] of Object.entries(attributes)) {
      if (v !== undefined && v !== null && k.toLowerCase().trim() === labelLower) {
        return String(v);
      }
    }

    // 3. Normalized match (ignoring symbols and spaces)
    const normLabel = labelLower.replace(/[^a-z0-9]/g, "");
    if (normLabel) {
      for (const [k, v] of Object.entries(attributes)) {
        if (v !== undefined && v !== null && k.toLowerCase().replace(/[^a-z0-9]/g, "") === normLabel) {
          return String(v);
        }
      }
    }

    return "";
  };

  // Update custom column attribute value for this contact
  const handleColumnValueChange = (col: { id: string; label: string }, val: any) => {
    setAttributes((prev) => {
      const copy = { ...(prev || {}) };
      const labelLower = col.label.toLowerCase().trim();
      let targetKey = col.label;

      if (copy[col.label] !== undefined) {
        targetKey = col.label;
      } else if (copy[col.id] !== undefined) {
        targetKey = col.id;
      } else {
        for (const k of Object.keys(copy)) {
          if (k.toLowerCase().trim() === labelLower) {
            targetKey = k;
            break;
          }
        }
        if (targetKey === col.label) {
          const normLabel = labelLower.replace(/[^a-z0-9]/g, "");
          if (normLabel) {
            for (const k of Object.keys(copy)) {
              if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === normLabel) {
                targetKey = k;
                break;
              }
            }
          }
        }
      }

      copy[targetKey] = val;
      return copy;
    });
  };

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!contact) return null;

  const displayPhone = formData.phone_number || contact.phone || "";
  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const contactName = formData.name || contact.name || "Unknown";
  const assignedValue = Array.isArray(formData.assigned_to)
    ? formData.assigned_to[0] || ""
    : formData.assigned_to || "";

  return (
    <aside className={styles.panel} aria-label="Contact details">
      <div className={styles.header}>
        <h2 className={styles.headerTitle}>Contact info</h2>
        <div className={styles.headerActions}>
          <IconButton
            aria-label="Refresh contact details"
            size="sm"
            disabled={isLoading || isSaving}
            onClick={fetchContactDetails}
            icon={<RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />}
          />
          {dbContactId && (
            <IconButton
              aria-label="Open in contacts"
              size="sm"
              onClick={() =>
                router.push(`/user/contacts?search=${encodeURIComponent(formData.name || displayPhone)}`)
              }
              icon={<ExternalLink size={15} />}
            />
          )}
          <IconButton aria-label="Close panel" size="sm" onClick={onClose} icon={<X size={17} />} />
        </div>
      </div>

      <div className={styles.scroll}>
        {isLoading ? (
          <div className={styles.loading}>
            <Spinner size="md" />
            Loading contact…
          </div>
        ) : (
          <>
            {/* Profile */}
            <div className={styles.hero}>
              <Avatar
                size="xl"
                name={contactName}
                fallback={isPhoneNumberName(contactName) ? <User size={26} /> : undefined}
              />
              <p className={styles.heroName}>
                <span>{contactName}</span>
                {metadata.isValid === true && (
                  <CheckCircle2 size={15} className={styles.verified} aria-label="Valid WhatsApp contact" />
                )}
              </p>
              <span className={styles.heroPhone}>
                {displayPhone}
                <button
                  type="button"
                  className={styles.copy}
                  aria-label="Copy phone number"
                  onClick={() => {
                    navigator.clipboard.writeText(displayPhone);
                    setCopiedPhone(true);
                    toast.success("Phone number copied!");
                    setTimeout(() => setCopiedPhone(false), 2000);
                  }}
                >
                  {copiedPhone ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </span>
              <Badge className={styles.heroBadge} variant={dbContactId ? "primary" : "neutral"} size="sm">
                {dbContactId ? "CRM contact" : "Unsaved lead"}
              </Badge>
            </div>

            <PanelSection open={sectionsOpen.optIn} onToggle={() => toggleSection("optIn")} icon={<UserCheck size={15} />} title="Opt-in management">
              <Select
                size="sm"
                label="Opt-in status"
                value={optStatus.value === null ? "" : optStatus.value ? "opted_out" : "opted_in"}
                disabled={isSaving}
                onChange={(e) => setOptStatus((prev) => ({ ...prev, value: e.target.value === "opted_out" }))}
                placeholder="Not set"
                options={[
                  { value: "opted_in", label: "Opted in" },
                  { value: "opted_out", label: "Opted out" },
                ]}
                helperText="Choose the contact's messaging preference, then save changes."
              />
            </PanelSection>

            {/* Tags */}
            <PanelSection open={sectionsOpen.tags} onToggle={() => toggleSection("tags")} icon={<Tag size={15} />} title="Tags" count={selectedTagIds.length}>
              <div className={styles.tags}>
                {selectedTagIds.length === 0 ? (
                  <span className={styles.muted}>No tags yet</span>
                ) : (
                  selectedTagIds.map((tagId) => {
                    const tagObj = allTags.find((t) => String(t.id) === String(tagId) || t.name === tagId);
                    const tagName = tagObj ? tagObj.name : tagId;
                    return (
                      <span key={tagId} className={styles.tag}>
                        {tagName}
                        <button
                          type="button"
                          className={styles.tagRemove}
                          onClick={() => handleRemoveTag(tagId)}
                          aria-label={`Remove tag ${tagName}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              <div ref={tagDropdownRef} className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                  aria-expanded={tagDropdownOpen}
                >
                  {tagDropdownOpen ? "Done" : "Add tags"}
                </Button>

                {tagDropdownOpen && (
                  <div className={styles.picker}>
                    <Input
                      size="sm"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Search or create a tag…"
                      leftIcon={<Search size={14} />}
                      aria-label="Search tags"
                      autoFocus
                    />
                    <div className={styles.pickerList} role="listbox" aria-multiselectable>
                      {filteredTags.map((tag) => {
                        const isSelected =
                          selectedTagIds.includes(String(tag.id)) || selectedTagIds.includes(tag.name);
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            key={tag.id}
                            onClick={() => handleToggleTag(String(tag.id))}
                            className={cn(styles.pickerItem, isSelected && styles.pickerItemSelected)}
                          >
                            <span className="truncate">{tag.name}</span>
                            {isSelected && <Check size={14} />}
                          </button>
                        );
                      })}
                      {filteredTags.length === 0 && (
                        <p className={cn(styles.muted, "px-2 py-1.5")}>No matching tags</p>
                      )}
                    </div>
                    {tagSearch.trim() &&
                      !allTags.some((t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                        <Button
                          size="sm"
                          fullWidth
                          isLoading={isCreatingTag}
                          leftIcon={<Plus size={14} />}
                          onClick={handleCreateTag}
                        >
                          Create “{tagSearch.trim()}”
                        </Button>
                      )}
                  </div>
                )}
              </div>
            </PanelSection>

            {/* Contact fields */}
            <PanelSection open={sectionsOpen.basic} onToggle={() => toggleSection("basic")} icon={<User size={15} />} title="Contact fields">
              <Input
                size="sm"
                label="Full name"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. John Doe"
              />
              <Input
                size="sm"
                label="Phone number"
                required
                className="tabular-nums"
                value={formData.phone_number}
                onChange={(e) => setFormData((p) => ({ ...p, phone_number: e.target.value }))}
                placeholder="+919876543210"
              />
              <Input
                size="sm"
                type="email"
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="john@example.com"
              />
              <Select
                size="sm"
                label="Pipeline stage"
                value={formData.status}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                options={[
                  { value: "", label: "No stage assigned" },
                  ...pipelineStages.map((stage) => ({ value: String(stage.id), label: stage.name })),
                ]}
              />
              <Select
                size="sm"
                label="Assigned agent"
                value={assignedValue}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, assigned_to: e.target.value ? [e.target.value] : [] }))
                }
                options={[
                  { value: "", label: "Unassigned" },
                  ...teamMembers.map((member) => ({
                    value: String(member.user_id ?? member.id),
                    label: member.name || member.email || `Member ${String(member.id).slice(0, 6)}`,
                  })),
                ]}
              />
            </PanelSection>

            {/* Custom columns */}
            <PanelSection open={sectionsOpen.attributes} onToggle={() => toggleSection("attributes")}
              icon={isLoadingColumns ? <Spinner size="sm" /> : <SlidersHorizontal size={15} />}
              title="Custom fields"
              count={customColumns.length}
            >
              {customColumns.map((col) => {
                const colVal = getColumnValue(col);
                const type = col.type?.toLowerCase();
                const label = (
                  <span className={styles.columnLabel}>
                    <span className="truncate" title={col.label}>
                      {col.label}
                    </span>
                    {col.type && <span className={styles.typeBadge}>{col.type}</span>}
                  </span>
                );
                return type === "boolean" ? (
                  <Select
                    key={col.id}
                    id={`col-input-${col.id}`}
                    size="sm"
                    label={label}
                    value={colVal}
                    onChange={(e) => handleColumnValueChange(col, e.target.value)}
                    options={[
                      { value: "", label: "— Select —" },
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                  />
                ) : (
                  <Input
                    key={col.id}
                    id={`col-input-${col.id}`}
                    size="sm"
                    label={label}
                    type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                    value={colVal}
                    onChange={(e) => handleColumnValueChange(col, e.target.value)}
                    placeholder={`Enter ${col.label.toLowerCase()}…`}
                  />
                );
              })}
              {customColumns.length === 0 && !isLoadingColumns && (
                <p className={styles.muted}>No custom fields configured.</p>
              )}
            </PanelSection>

            {/* Notes */}
            <PanelSection open={sectionsOpen.notes} onToggle={() => toggleSection("notes")} icon={<FileText size={15} />} title="Notes">
              <Textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Add internal notes about this contact…"
                aria-label="Notes"
              />
            </PanelSection>

            {/* Activity */}
            <PanelSection open={sectionsOpen.metadata} onToggle={() => toggleSection("metadata")} icon={<Info size={15} />} title="Activity">
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <p className={styles.statValue}>{metadata.messageCount ?? 0}</p>
                  <p className={styles.statLabel}>Messages</p>
                </div>
                <div className={styles.stat}>
                  <p className={styles.statValue}>{metadata.failedCount ?? 0}</p>
                  <p className={styles.statLabel}>Failed deliveries</p>
                </div>
              </div>
              {metadata.createdAt && (
                <p className={styles.meta}>
                  Created <strong>{new Date(metadata.createdAt).toLocaleDateString()}</strong>
                </p>
              )}
              {metadata.lastContactedAt && (
                <p className={styles.meta}>
                  Last activity <strong>{new Date(metadata.lastContactedAt).toLocaleDateString()}</strong>
                </p>
              )}
              {dbContactId && (
                <p className={styles.meta}>
                  Record ID <strong title={dbContactId}>{dbContactId}</strong>
                </p>
              )}
            </PanelSection>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Button
          fullWidth
          onClick={handleSaveContact}
          disabled={isLoading}
          isLoading={isSaving}
          leftIcon={<Save size={15} />}
        >
          Save changes
        </Button>
      </div>
    </aside>
  );
}

/** Collapsible panel section (module scope so its subtree keeps state/focus). */
function PanelSection({
  open,
  onToggle,
  icon,
  title,
  count,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(styles.section, open && styles.sectionOpen)}>
      <button type="button" className={styles.sectionToggle} onClick={onToggle} aria-expanded={open}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>
          {title} {typeof count === "number" && <span className={styles.sectionCount}>· {count}</span>}
        </span>
        <ChevronDown size={15} className={styles.chevron} aria-hidden />
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}
