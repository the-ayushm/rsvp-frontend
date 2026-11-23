/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { Users, Tag, Phone, Send, MessageSquare, Type, X, ChevronLeft, Filter, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { getTemplateVariables } from "@/lib/template-utils";
import { MediaPickerModal } from "@/features/media/components/MediaPickerModal";
import "@/features/schedules/create-schedule.css";


interface Contact {
  id: string;
  name: string;
  number: string;
  email?: string;
}


export default function CreateReminderStep1() {
  const router = useRouter();

  const [showTagFilter, setShowTagFilter] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [contactPage, setContactPage] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string | number;
    name: string;
    language: string;
    components?: any[];
    headerMode?: "fixed" | "dynamic" | null;
  } | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>("");
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string>("");

  const { data: phoneNumbersData, isLoading: loadingPhones } = useQuery<any>({
    queryKey: ["waba-phone-numbers"],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
      return data;
    }
  });
  const phoneNumbersList = phoneNumbersData?.data || [];
  
  const selectedWabaId = phoneNumbersList.find((p: any) => String(p.id) === String(selectedPhoneNumberId))?.waba_id;

  const { data: templatesData, isFetching: loadingTemplates } = useQuery<any>({
    queryKey: ["waba-templates", selectedWabaId],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get(`/admin/templates?wabaId=${selectedWabaId}`);
      return data;
    },
    enabled: !!selectedWabaId,
  });
  const templatesList = templatesData?.data || [];

  // Fetch tags list
  const { data: tagsData } = useQuery<any>({
    queryKey: ["contact-tags"],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get("/admin/contacts/tags");
      return data;
    },
  });

  const tags: { id: string; name: string; contact_count?: number }[] =
    tagsData?.data || tagsData?.tags || [];

  // Fetch contacts list (re-fetches when tag filter or page changes)
  const { data: contactsData, isFetching: loading } = useQuery<any>({
    queryKey: ["reminder-contacts", contactPage, selectedTagIds],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: contactPage,
        limit: 10,
        sortBy: "created_at",
        sortOrder: "desc",
      };
      if (selectedTagIds.length > 0) {
        params.tag_ids = selectedTagIds.join(",");
        params.tags = selectedTagIds.join(",");
      }
      const { data } = await soft7AxiosInstance.get("/admin/contacts", { params });
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const allContacts: Contact[] = (contactsData?.data?.items || contactsData?.data?.contacts || contactsData?.contacts || []).map((c: any) => ({
    id: c.id,
    name: c.name || c.contact_name || "Unknown",
    number: c.phone_number || c.number || c.phone || "",
    email: c.email || "",
  }));
  const contactsTotal = contactsData?.data?.pagination?.total ?? contactsData?.data?.total ?? contactsData?.total ?? (allContacts.length === 10 ? contactPage * 10 + 1 : (contactPage - 1) * 10 + allContacts.length);

  // Load Draft From LocalStorage
  useEffect(() => {
    const raw = localStorage.getItem("draftReminder");
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.recipients) setSelected(d.recipients);
        if (d.phoneNumberId) setSelectedPhoneNumberId(d.phoneNumberId);
        if (d.templateName) {
          setSelectedTemplate({
            id: d.selectedTemplateId ?? d.templateName,
            name: d.templateName,
            language: d.language || "en",
            components: d.components,
            headerMode: d.headerMode,
          });
        }
        if (d.variables) setTemplateVariables(d.variables);
        if (d.headerPreviewUrl) setHeaderPreviewUrl(d.headerPreviewUrl);
      } catch {
        // ignore parse error
      }
    }
  }, []);

  // Save Draft to LocalStorage
  useEffect(() => {
    const draft = {
      recipients: selected,
      phoneNumberId: selectedPhoneNumberId,
      templateName: selectedTemplate?.name,
      selectedTemplateId: selectedTemplate?.id,
      language: selectedTemplate?.language || "en",
      components: selectedTemplate?.components,
      headerMode: selectedTemplate?.headerMode,
      variables: templateVariables,
      headerPreviewUrl,
    };
    localStorage.setItem("draftReminder", JSON.stringify(draft));
  }, [selected, selectedPhoneNumberId, selectedTemplate, templateVariables, headerPreviewUrl]);

  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(event.target as Node)) {
        setPhoneDropdownOpen(false);
      }
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSelect = (item: any) => {
    setSelected((prev) => {
      if (prev.find((x) => x.id === item.id && x.type === item.type)) {
        return prev.filter((x) => !(x.id === item.id && x.type === item.type));
      }
      return [...prev, item];
    });
  };

  const removeSelected = (item: any) => {
    setSelected((prev) =>
      prev.filter((x) => !(x.id === item.id && x.type === item.type))
    );
  };

  const hasDynamicMediaHeader =
    selectedTemplate?.components?.some(
      (c: any) =>
        c.type === "HEADER" &&
        ["IMAGE", "VIDEO", "DOCUMENT"].includes((c.format || "").toUpperCase())
    );
    
  const headerFormat = selectedTemplate?.components?.find((c: any) => c.type === "HEADER")?.format;
  const headerKey =
    headerFormat === "IMAGE"
      ? "headerImageUrl"
      : headerFormat === "VIDEO"
      ? "headerVideoUrl"
      : "headerDocumentUrl";

  const handleMediaUpload = async (file: File) => {
    try {
      setUploadingMedia(true);

      const isLocalFile = file.name ? true : false;
      const isGoogleDriveLink = !isLocalFile;

      if (!selectedPhoneNumberId) {
        alert("Please select a Sender Phone Number first to upload media.");
        return;
      }
      
      const phoneNumberId = selectedPhoneNumberId;

      if (isGoogleDriveLink) {
          const urlStr = file as unknown as string;
          setTemplateVariables((prev) => ({
            ...prev,
            [headerKey]: urlStr,
          }));
          setHeaderPreviewUrl(urlStr);
          alert("Google Drive link attached successfully 🚀");
          return;
      }

      const formData = new FormData();
      formData.append("file", file);
      
      let wabaId = selectedWabaId;
      if (wabaId) {
        formData.append("wabaId", wabaId);
      }

      const res = await soft7AxiosInstance.post("/admin/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const mediaId = res.data?.data?.media_id || res.data?.data?.id || res.data?.id;

      if (!mediaId) throw new Error("No media ID returned from server");

      setTemplateVariables((prev) => ({
        ...prev,
        [headerKey]: mediaId,
      }));
      
      if (file.type?.startsWith('image/')) {
         const localUrl = URL.createObjectURL(file);
         setHeaderPreviewUrl(localUrl);
      } else {
         setHeaderPreviewUrl("");
      }
      
      alert(`${headerFormat} uploaded successfully 🚀`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleNext = () => {
    if (selected.length === 0) {
      alert("Select at least one recipient.");
      return;
    }
    if (!selectedTemplate) {
      alert("Please select a WhatsApp template. Meta requires template messages for automation reminders.");
      return;
    }
    
    if (hasDynamicMediaHeader && !templateVariables[headerKey]?.trim()) {
      alert(`Please provide a ${headerFormat} URL for the dynamic template header.`);
      return;
    }
    router.push("/user/reminder/create/next");
  };

  const vars = selectedTemplate ? getTemplateVariables(selectedTemplate.components || []) : [];

  // Search Filtering
  const filteredContacts = allContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.number.includes(search)
  );
  const filteredTags = tags.filter((t: any) =>
    (t.name || "").toLowerCase().includes(search.toLowerCase())
  );

  // ✅ SELECT ALL CONTACTS LOGIC
  // ✅ SELECT ALL CONTACTS LOGIC
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  // Check if ALL contacts are selected (not just visible ones). 
  // We'll consider it "all selected" if selected contacts count is >= contactsTotal
  const allContactsSelected = selected.filter((s) => s.type === "contact").length > 0 && selected.filter((s) => s.type === "contact").length >= contactsTotal;

  const toggleSelectAllContacts = async () => {
    if (allContactsSelected) {
      // 🔴 Deselect all contacts
      setSelected((prev) => prev.filter((s) => s.type !== "contact"));
    } else {
      // 🟢 Fetch and select all contacts from all pages
      setIsSelectingAll(true);
      try {
        const params: Record<string, any> = {
          limit: 99999, // Large number to fetch all
          sortBy: "created_at",
          sortOrder: "desc",
        };
        if (selectedTagIds.length > 0) {
          params.tag_ids = selectedTagIds.join(",");
          params.tags = selectedTagIds.join(",");
        }
        const { data } = await soft7AxiosInstance.get("/admin/contacts", { params });
        const fetchedItems = data?.data?.items || data?.data?.contacts || data?.contacts || [];
        
        const allFetchedContacts = fetchedItems.map((c: any) => ({
          id: c.id,
          label: c.name || c.contact_name || "Unknown",
          type: "contact" as const,
        }));
        
        setSelected((prev) => {
          // keep non-contact selections, and replace contact selections with allFetchedContacts
          const nonContacts = prev.filter(s => s.type !== "contact");
          return [...nonContacts, ...allFetchedContacts];
        });
      } catch (error) {
        console.error("Failed to select all contacts", error);
        alert("Failed to fetch all contacts. Please try again.");
      } finally {
        setIsSelectingAll(false);
      }
    }
  };
  return (
    <div className="min-h-screen reminder-create-container bg-background">
      <div className="max-w-[1600px] mx-auto p-6">
        {/* HEADER */}
        <div className="mb-8">
          <div className="mb-4">
            <button
              onClick={() => router.push("/user/reminder")}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-xl font-semibold shadow-md hover:opacity-90 hover:shadow-lg transition-all"
              style={{ color: "var(--color-primary-foreground)" }}
            >
              <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-primary-foreground)" }} />
              <span style={{ color: "var(--color-primary-foreground)" }}>Back to Reminders</span>
            </button>
          </div>
          <div
            className="flex items-center gap-2 text-sm mb-3"
            style={{ color: "var(--color-text)" }}
          ></div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Create Reminder
          </h1>
          <p className="text-lg text-muted-foreground">
            Compose your message and select recipients to send reminders
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT SIDEBAR */}
          <div className="lg:col-span-1 rounded-xl border border-border overflow-visible h-fit bg-card shadow-sm">
            {/* HEADER */}
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Select Recipients
              </h2>
              <p className="text-xs mt-0.5 text-muted-foreground">
                Choose contacts to send reminders
              </p>
            </div>

            <div className="p-3 bg-card">
              {/* TOOLBAR — Search + Filter Button */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    placeholder="Search contacts..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border outline-none bg-card text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowTagFilter((v) => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      showTagFilter || selectedTagIds.length > 0
                        ? "bg-primary border-primary text-primary-foreground shadow-md"
                        : "bg-primary/70 border-primary/70 text-primary-foreground hover:bg-primary hover:border-primary shadow-sm"
                    }`}
                  >
                    <Filter size={13} className="text-primary-foreground" />
                    {selectedTagIds.length > 0 && (
                      <span className="flex items-center justify-center text-[10px] font-bold bg-surface text-primary-text rounded-full min-w-[16px] h-4 px-1 leading-none shadow-sm">
                        {selectedTagIds.length}
                      </span>
                    )}
                    {showTagFilter ? <ChevronUp size={11} className="text-primary-foreground" /> : <ChevronDown size={11} className="text-primary-foreground" />}
                  </button>

                  {/* FLOATING TAG FILTER PANEL */}
                  {showTagFilter && (
                    <div className="absolute top-full right-0 mt-1.5 w-64 z-50 rounded-lg border border-border bg-card shadow-xl">
                      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Filter by Tags</span>
                        {selectedTagIds.length > 0 && (
                          <button
                            onClick={() => { setSelectedTagIds([]); setContactPage(1); setShowTagFilter(false); }}
                            className="text-[10px] text-error hover:opacity-80 font-medium"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-0.5">
                        {filteredTags.length > 0 ? (
                          filteredTags.map((t: any) => {
                            const isActive = selectedTagIds.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setSelectedTagIds((prev) =>
                                    isActive
                                      ? prev.filter((id) => id !== t.id)
                                      : [...prev, t.id]
                                  );
                                  setContactPage(1);
                                  setShowTagFilter(false);
                                }}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all ${
                                  isActive
                                    ? "bg-primary/10 text-primary-text font-medium"
                                    : "text-foreground hover:bg-surface-muted dark:hover:bg-surface-active/50"
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <Tag size={11} className={isActive ? "text-[var(--color-primary)]" : "text-muted-foreground"} />
                                  <span className="font-medium">{t.name}</span>
                                  {t.contact_count != null && (
                                    <span className="text-[10px] text-muted-foreground">({t.contact_count})</span>
                                  )}
                                </span>
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                                  isActive ? "bg-[var(--color-primary)] border-primary" : "border-border-strong"
                                }`}>
                                  {isActive && (
                                    <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-center text-[11px] text-muted-foreground py-3">No tags found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIVE TAG PILLS */}
              {selectedTagIds.length > 0 && (
                <div className="mb-2.5 flex flex-wrap items-center gap-1">
                  {selectedTagIds.map((tagId) => {
                    const tag = tags.find((t: any) => t.id === tagId);
                    return (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-md bg-primary-lighter dark:bg-primary-light/30 text-primary-text dark:text-primary-text border border-primary-soft dark:border-primary-soft"
                      >
                        <Tag size={8} />
                        {tag?.name || tagId}
                        <button
                          onClick={() => { setSelectedTagIds((prev) => prev.filter((id) => id !== tagId)); setContactPage(1); }}
                          className="ml-0.5 hover:text-primary-dark dark:hover:text-primary-text"
                        >
                          <X size={9} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* SELECT ALL BAR */}
              {filteredContacts.length > 0 && (
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    {selected.filter((s) => s.type === "contact").length} of {contactsTotal} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAllContacts}
                    disabled={isSelectingAll}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary-text hover:underline transition disabled:opacity-50 disabled:no-underline"
                  >
                    {isSelectingAll ? (
                      <>
                        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Selecting...</span>
                      </>
                    ) : allContactsSelected ? (
                      "Deselect All"
                    ) : (
                      "Select All"
                    )}
                  </button>
                </div>
              )}

              {/* CONTACT LIST — always visible */}
              <div className="max-h-[360px] overflow-y-auto space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                  </div>
                ) : filteredContacts.length > 0 ? (
                  filteredContacts.map((c) => {
                    const isChecked = selected.find((x) => x.id === c.id && x.type === "contact");
                    return (
                      <div
                        key={c.id}
                        onClick={() =>
                          toggleSelect({ id: c.id, label: c.name, type: "contact" })
                        }
                        className={`px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 flex items-center gap-2.5 ${
                          isChecked
                            ? "bg-primary/8 border border-primary/20"
                            : "hover:bg-surface-muted dark:hover:bg-surface-active/40 border border-transparent"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? "bg-primary border-primary" : "border-border-strong"
                        }`}>
                          {isChecked && (
                            <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 bg-primary/10 text-primary-text">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate leading-tight">
                            {c.name}
                          </div>
                          {c.number && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone size={9} />
                              {c.number}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <Users size={20} className="mx-auto text-muted-foreground mb-1.5 opacity-40" />
                    <p className="text-xs text-muted-foreground">
                      {selectedTagIds.length > 0
                        ? "No contacts match the selected tags"
                        : search
                        ? "No contacts match your search"
                        : "No contacts found"}
                    </p>
                  </div>
                )}
              </div>

              {/* PAGINATION */}
              {contactsTotal > 0 && (() => {
                const totalPages = Math.ceil(contactsTotal / 10);
                const maxVisible = 5;
                let startPage = Math.max(1, contactPage - Math.floor(maxVisible / 2));
                let endPage = startPage + maxVisible - 1;
                if (endPage > totalPages) {
                  endPage = totalPages;
                  startPage = Math.max(1, endPage - maxVisible + 1);
                }
                const pages = [];
                for (let i = startPage; i <= endPage; i++) pages.push(i);
                return (
                  <div className="pt-2.5 mt-2 border-t border-border">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                      <span>Page {contactPage}/{totalPages}</span>
                      <span>{contactsTotal} total</span>
                    </div>
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => setContactPage((p) => Math.max(1, p - 1))}
                        disabled={contactPage === 1}
                        className="px-1.5 py-1 text-[11px] rounded border border-border bg-card text-foreground disabled:opacity-30 hover:bg-surface-hover dark:hover:bg-surface-active transition"
                      >
                        ‹
                      </button>
                      {startPage > 1 && (
                        <>
                          <button
                            onClick={() => setContactPage(1)}
                            className="w-6 h-6 text-[11px] rounded border border-border bg-card text-foreground hover:bg-surface-hover dark:hover:bg-surface-active transition"
                          >1</button>
                          {startPage > 2 && <span className="text-[10px] text-muted-foreground">…</span>}
                        </>
                      )}
                      {pages.map((p) => (
                        <button
                          key={p}
                          onClick={() => setContactPage(p)}
                          className={`w-6 h-6 text-[11px] rounded border transition ${
                            p === contactPage
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-card text-foreground hover:bg-surface-hover dark:hover:bg-surface-active"
                          }`}
                        >{p}</button>
                      ))}
                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && <span className="text-[10px] text-muted-foreground">…</span>}
                          <button
                            onClick={() => setContactPage(totalPages)}
                            className="w-6 h-6 text-[11px] rounded border border-border bg-card text-foreground hover:bg-surface-hover dark:hover:bg-surface-active transition"
                          >{totalPages}</button>
                        </>
                      )}
                      <button
                        onClick={() => setContactPage((p) => Math.min(totalPages, p + 1))}
                        disabled={contactPage === totalPages}
                        className="px-1.5 py-1 text-[11px] rounded border border-border bg-card text-foreground disabled:opacity-30 hover:bg-surface-hover dark:hover:bg-surface-active transition"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-2 space-y-6">
            {/* Select Template Card */}
            <div className="rounded-2xl shadow-xl border border-border bg-card">
              <div className="bg-primary/10 dark:bg-surface-active/50 p-4 border-b border-border rounded-t-2xl">
                <h2 className="text-base font-semibold text-foreground">
                  Select Message Template
                </h2>
                <p className="text-xs mt-0.5 text-secondary-foreground dark:text-muted-foreground">
                  Meta requires approved WhatsApp templates for automation
                  reminders. Free-form messages are not allowed.
                </p>
              </div>

              <div className="p-4 bg-card rounded-b-2xl">
                <div className="mb-6 space-y-4">
                  {/* PHONE NUMBER CUSTOM DROPDOWN */}
                  <div className="relative" ref={phoneDropdownRef}>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Phone Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-input/50 hover:bg-input text-sm flex items-center justify-between transition-all text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-muted-foreground" />
                        <span className={selectedPhoneNumberId ? "font-medium" : "text-muted-foreground"}>
                          {selectedPhoneNumberId
                            ? (phoneNumbersList.find((p: any) => p.id === selectedPhoneNumberId)?.display_phone_number + " (" + phoneNumbersList.find((p: any) => p.id === selectedPhoneNumberId)?.verified_name + ")")
                            : "Select phone number..."}
                        </span>
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform ${phoneDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {phoneDropdownOpen && (
                      <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                        {phoneNumbersList.map((p: any) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPhoneNumberId(p.id);
                              setSelectedTemplate(null);
                              setTemplateVariables({});
                              setPhoneDropdownOpen(false);
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between hover:bg-muted ${
                              selectedPhoneNumberId === p.id ? "bg-primary/10 text-primary-text" : "text-foreground"
                            }`}
                          >
                            <div>
                              <div className="font-semibold">{p.display_phone_number}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">Verified: {p.verified_name || "Unknown"}</div>
                            </div>
                            {selectedPhoneNumberId === p.id && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedPhoneNumberId && (
                    <div className="relative mt-4" ref={templateDropdownRef}>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        WhatsApp Template
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!loadingTemplates) setTemplateDropdownOpen(!templateDropdownOpen);
                        }}
                        disabled={loadingTemplates}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-input/50 hover:bg-input text-sm flex items-center justify-between transition-all text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare size={16} className="text-muted-foreground" />
                          <span className={selectedTemplate ? "font-medium" : "text-muted-foreground"}>
                            {loadingTemplates 
                              ? "Loading templates..." 
                              : selectedTemplate 
                                ? `${selectedTemplate.name} (${selectedTemplate.language})` 
                                : "Select a template..."}
                          </span>
                        </div>
                        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${templateDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {templateDropdownOpen && (
                        <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-80">
                          <div className="p-2 border-b border-border bg-muted/30">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Search templates..."
                                value={templateSearch}
                                onChange={(e) => setTemplateSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto">
                            {templatesList
                              .filter((t: any) => t.status === "APPROVED")
                              .filter((t: any) => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                              .map((t: any) => (
                              <div
                                key={t.id}
                                onClick={() => {
                                  setSelectedTemplate({
                                    id: t.id,
                                    name: t.name,
                                    language: t.language,
                                    components: t.components,
                                    headerMode: t.headerMode,
                                  });
                                  const vs = getTemplateVariables(t.components || []);
                                  const init: Record<string, string> = {};
                                  vs.forEach((v) => {
                                    init[v.name] = v.name === "1" ? "" : (templateVariables[v.name] ?? "");
                                  });
                                  setTemplateVariables(init);
                                  setTemplateDropdownOpen(false);
                                  setTemplateSearch("");
                                }}
                                className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between hover:bg-muted ${
                                  selectedTemplate?.id === t.id ? "bg-primary/10 border-l-2 border-primary" : "border-l-2 border-transparent"
                                }`}
                              >
                                <div>
                                  <div className={`font-medium ${selectedTemplate?.id === t.id ? "text-primary-text" : "text-foreground"}`}>
                                    {t.name}
                                  </div>
                                  <div className="flex gap-2 mt-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                                      {t.language}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-success-bg text-success border border-success-border">
                                      {t.category || "APPROVED"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {templatesList.filter((t: any) => t.status === "APPROVED").filter((t: any) => t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 && (
                              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                No approved templates found.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  {selectedTemplate && (vars.length > 0 || hasDynamicMediaHeader) && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-primary/10">
                        <MessageSquare size={16} className="text-primary-text" />
                        <span className="font-semibold text-foreground text-sm">
                          Template Variables
                        </span>
                      </div>
                      <div className="space-y-3">
                        {/* Dynamic Media Header Input */}
                        {hasDynamicMediaHeader && (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-secondary-foreground dark:text-muted-foreground capitalize">
                              Header {headerFormat?.toLowerCase()}:
                            </label>
                            
                            <div className="flex flex-col gap-3">
                              {templateVariables[headerKey] ? (
                                <div className="flex-col gap-3 p-3 bg-surface dark:bg-surface-raised border border-border rounded-lg flex">
                                  {headerFormat === "IMAGE" && (headerPreviewUrl || templateVariables[headerKey].startsWith("http")) ? (
                                    <div className="rounded-md overflow-hidden bg-surface-hover dark:bg-surface-muted border border-border flex items-center justify-center w-fit self-center">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img 
                                        src={headerPreviewUrl || templateVariables[headerKey]} 
                                        alt="Header preview" 
                                        className="max-w-full max-h-48 object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 p-2 bg-surface-muted dark:bg-surface-muted rounded-md text-sm truncate text-foreground border border-border">
                                      Media attached: {templateVariables[headerKey]}
                                    </div>
                                  )}
                                  
                                  <button
                                    type="button"
                                    onClick={() => setMediaPickerOpen(true)}
                                    className="w-full py-1.5 text-xs text-primary-text hover:bg-primary/10 border border-primary/30 rounded-md font-medium cursor-pointer transition-colors"
                                  >
                                    Change {headerFormat}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setMediaPickerOpen(true)}
                                  className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary-text rounded-lg transition-colors text-sm font-medium cursor-pointer"
                                >
                                  Upload / Select {headerFormat}
                                </button>
                              )}
                            </div>
                            
                            <p className="text-[10px] text-muted-foreground mt-1">
                              This template requires a media file in the header.
                            </p>

                            <MediaPickerModal
                              isOpen={mediaPickerOpen}
                              onClose={() => setMediaPickerOpen(false)}
                              onSelect={(url, filename) => {
                                setTemplateVariables((prev) => ({
                                  ...prev,
                                  [headerKey]: url,
                                }));
                                setHeaderPreviewUrl(url);
                              }}
                              onUploadNew={async (file) => {
                                await handleMediaUpload(file);
                                setMediaPickerOpen(false);
                              }}
                              uploadingMedia={uploadingMedia}
                              mediaType={headerFormat as any}
                            />
                          </div>
                        )}

                        {/* Text Variables */}
                        {vars.map((v) => (
                          <div
                            key={v.name}
                            className="flex flex-col gap-1.5"
                          >
                            <label className="text-xs font-medium text-secondary-foreground dark:text-muted-foreground">
                              {`{{${v.name}}}`}:
                            </label>
                            <input
                              type="text"
                              value={templateVariables[v.name] ?? ""}
                              onChange={(e) =>
                                setTemplateVariables((prev) => ({
                                  ...prev,
                                  [v.name]: e.target.value,
                                }))
                              }
                              placeholder={
                                v.name === "1"
                                  ? "e.g. Contact name"
                                  : "Enter value"
                              }
                              className="w-full px-3 py-1.5 rounded-lg border border-border bg-surface dark:bg-surface-raised text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => {
                        localStorage.removeItem("draftReminder");
                        router.push("/user/reminder");
                      }}
                      className="px-5 py-2.5 rounded-lg border border-border-strong bg-surface dark:bg-surface-raised text-secondary-foreground dark:text-secondary-foreground hover:bg-surface-muted dark:hover:bg-surface-active transition-all font-medium text-sm"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleNext}
                      className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 rounded-lg hover:shadow-lg hover:shadow-primary/25 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                      disabled={!selectedTemplate || !selectedPhoneNumberId}
                    >
                      Next <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Recipients Card */}
            <div className="rounded-xl shadow-xl border border-border p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">
                    Selected Recipients
                  </h3>
                  <p className="text-xs mt-0.5 text-secondary-foreground dark:text-muted-foreground">
                    {selected.length}{" "}
                    {selected.length === 1 ? "recipient" : "recipients"}{" "}
                    selected
                  </p>
                </div>
                {selected.length > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    className="text-xs text-primary-text hover:text-primary-text dark:text-500 dark:hover:text-primary/30 font-medium transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selected.length === 0 ? (
                <div className="text-center py-6">
                  <Users
                    size={32}
                    className="mx-auto mb-2 text-muted-foreground dark:text-muted-foreground"
                  />
                  <p className="text-sm text-secondary-foreground dark:text-muted-foreground">
                    No recipients selected
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground dark:text-muted-foreground">
                    Choose contacts from the left panel
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selected.map((s) => (
                    <div
                      key={String(s.id)}
                      className="group relative px-2 py-1 pr-6 rounded-lg bg-primary/10 dark:bg-primary/10 border border-primary/20 dark:border-primary-soft text-primary-text dark:text-primary/30 text-xs transition-all hover:shadow-sm"
                    >
                      {s.label}
                      <button
                        onClick={() => removeSelected(s)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-primary/20 dark:bg-primary-hover text-primary-text dark:text-primary/30 opacity-0 group-hover:opacity-100 hover:bg-primary/30 dark:hover:bg-primary transition-all"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}