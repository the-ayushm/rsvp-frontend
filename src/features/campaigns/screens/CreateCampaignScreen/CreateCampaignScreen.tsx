/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Mail,
  MessageSquare,
  FileText,
  Users,
  Tag as TagIcon,
  X,
  Upload,
  Clipboard,
  Keyboard,
  UserPlus,
  Phone,
  FileSpreadsheet,
  CheckCircle,
  Check,
  CreditCard,
  Target,
  Layout,
  Settings,
  Plus,
  Trash2,
  Search,
  User,
  Image as ImageIcon,
  Clock,
  Pencil,
  Filter,
} from "lucide-react";
import TemplateSelectionModal from "@/features/templates/components/TemplateSelectionModal";
import { MediaPickerModal } from "@/features/media/components/MediaPickerModal";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { toast as toastify, ToastContainer } from "react-toastify";
import { validateTemplateMappings } from "@/lib/template-mapping-validation";
import { useBroadcastStore } from "@/lib/broadcastStore";
import { CAMPAIGN_CONTACT_GUIDANCE, getCampaignErrorMessage, getPreviewRecipientCount, mergeContactSelection } from "../../utils/campaign-validation";
import { getCreatedCampaignId } from "../../utils/campaign-response";
import { parsePhoneNumber, getCountries, getCountryCallingCode } from 'libphonenumber-js';

function checkCampaignResponse(data: any) {
  const failure = data?.success === false ? data : data?.data?.success === false ? data.data : null;
  if (failure) {
    throw Object.assign(new Error(getCampaignErrorMessage({ response: { data: failure } })), {
      response: { data: failure },
    });
  }
  return data;
}

// ── Inline country-code helpers (replaces countryCodeUtils) ──
const _dialCodeToIso: Record<string, string> = {};
for (const c of getCountries()) {
  const dc = String(getCountryCallingCode(c));
  if (!_dialCodeToIso[dc]) _dialCodeToIso[dc] = c;
}
const _intlNames = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
function _isoToFlag(iso: string): string {
  return iso.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}
function extractCountryCode(phone: string): string {
  try {
    const num = phone.startsWith('+') ? phone : '+' + phone;
    const parsed = parsePhoneNumber(num);
    return parsed?.countryCallingCode?.toString() || 'unknown';
  } catch { return 'unknown'; }
}
function groupByCountryCode(phones: string[]): Record<string, string[]> {
  return phones.reduce<Record<string, string[]>>((groups, phone) => {
    const countryCode = extractCountryCode(phone);
    (groups[countryCode] ??= []).push(phone);
    return groups;
  }, {});
}
function getCountryInfo(dialCode: string): { name: string; flag: string; iso2: string } | null {
  const iso = _dialCodeToIso[dialCode];
  if (!iso) return null;
  return { name: _intlNames?.of(iso) || iso, flag: _isoToFlag(iso), iso2: iso };
}
const countryFilterOptions = Object.keys(_dialCodeToIso)
  .map(dialCode => ({ dialCode, info: getCountryInfo(dialCode)! }))
  .sort((a, b) => a.info.name.localeCompare(b.info.name));
function getCountryCodeLabel(code: string): string {
  const info = getCountryInfo(code);
  if (!info) return `+${code}`;
  return `${info.flag} +${code} ${info.name}`;
}
function getUniqueCountryCodes(phones: string[]): string[] {
  const codes = new Set<string>();
  for (const p of phones) codes.add(extractCountryCode(p));
  return Array.from(codes).sort((a, b) => {
    if (a === '91') return -1;
    if (b === '91') return 1;
    const na = getCountryInfo(a)?.name ?? '';
    const nb = getCountryInfo(b)?.name ?? '';
    return na.localeCompare(nb);
  });
}


type TemplateField = {
  key: string;
  value: string;
  label?: string;
  source?: "manual" | "contact";
  contactField?: string;
  fallbackValue?: string;
};

function buildParameterMapping(fields: TemplateField[]) {
  return Object.fromEntries(fields.map(field => [field.key,
    field.source === "contact"
      ? { field: field.contactField, ...(field.fallbackValue?.trim() ? { fallbackValue: field.fallbackValue } : {}) }
      : field.value,
  ]));
}

type Step = 1 | 2 | 3 | 4 | 5;

type Contact = {
  id: number;
  name: string;
  phone: string;
  tags: string;
};

type Tag = {
  id: number;
  name: string;
};




type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  status?: string;
  components: any;
  headerMode?: "fixed" | "dynamic" | null;
};





function CustomCombobox({ value, onChange, placeholder, options }: { value: string, onChange: (val: string) => void, placeholder: string, options?: string[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!options) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s{2,}/g, ' '))}
        placeholder={placeholder}
        className="w-full h-10 px-3.5 border border-black/15 rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 bg-surface text-foreground placeholder:text-muted-foreground transition shadow-2xs"
      />
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.replace(/\s{2,}/g, ' '));
            setOpen(false);
          }}
          onClick={() => setOpen(!open)}
          placeholder={placeholder}
          className="w-full h-10 pl-3.5 pr-10 border border-black/15 rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 bg-surface text-foreground placeholder:text-muted-foreground transition shadow-2xs cursor-pointer"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-3 flex items-center text-muted-foreground hover:text-accent transition-colors focus:outline-none cursor-pointer"
        >
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <ul className="max-h-48 overflow-y-auto py-1 divide-y divide-border">
            {options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-primary-light hover:text-primary-text transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>{opt}</span>
                  {value === opt && <span className="text-[11px] font-bold text-primary-text">Selected</span>}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-xs text-primary-text hover:bg-primary-light transition-colors font-bold flex items-center gap-2 cursor-pointer border-t border-border"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Input Manually
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}


type RecipientContact = { id: string; name: string; phone_number: string; [key: string]: any };
function extractRecipientContacts(response: any): RecipientContact[] {
  const data = response?.data ?? response;
  const rows = Array.isArray(data) ? data : data?.contacts ?? data?.recipients ?? data?.preview ?? [];
  if (!Array.isArray(rows)) throw new Error("Unsupported recipient response from the API.");
  return rows.map((contact: any) => {
    const phone = String(typeof contact === "string" ? contact : contact.phone_number ?? contact.contactNumber ?? contact.phone ?? "");
    return { ...(typeof contact === "object" && contact ? contact : {}), id: String(contact.id ?? contact.contact_id ?? phone), name: String(contact.name ?? contact.full_name ?? phone), phone_number: phone };
  });
}
function ContactListRecipientPreview({ listId, listName, phoneNumberId }: {
  listId: string; listName: string; phoneNumberId?: string;
}) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["campaign-list-recipient-preview", phoneNumberId, listId],
    enabled: Boolean(phoneNumberId),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const response = await soft7AxiosInstance.post("/admin/campaigns/preview-recipients", {
        phone_number_id: phoneNumberId, contact_filters: { list_ids: [listId] },
      }, { signal });
      checkCampaignResponse(response.data);
      const contacts = extractRecipientContacts(response.data);
      const payload = response.data?.data ?? response.data;
      return { contacts, total: payload?.total_recipients ?? payload?.total_contacts ?? payload?.total ?? payload?.count ?? contacts.length };
    },
  });
  return <div className="p-3 border-t border-border text-xs">
    <p className="font-semibold text-foreground mb-2">{listName} - Recipient preview</p>
    {!phoneNumberId ? <p>Select a sender phone number to preview this list.</p>
      : isPending ? <p role="status">Loading recipients...</p>
      : isError ? <div role="alert"><p>{getCampaignErrorMessage(error)}</p>
        <button type="button" className="text-accent underline" onClick={() => refetch()}>Retry preview</button></div>
      : <><p className="text-muted-foreground mb-2">{data.total} eligible recipients</p>
        {data.contacts.length ? <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {data.contacts.map((contact, index) => <div key={`${contact.id}-${index}`} className="px-3 py-2">
            <span className="font-semibold">{contact.name}</span><span className="ml-2 font-mono">{contact.phone_number}</span>
          </div>)}
        </div> : <p>No eligible recipients in this list.</p>}</>}
  </div>;
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromImport = searchParams.get('fromImport') === '1';
  const [step, setStep] = useState<Step>(1);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "WhatsApp",
    messageTemplate: "",
    selectedTemplate: "",
    templateCategory: "",
    whatsappAccountId: undefined as number | undefined,
    headerMediaUrl: "" as string,
    headerDocumentFilename: "" as string,
    parameterMapping: {} as Record<string, { type: "field" | "static", value: string }>,
    schedulingMode: "later" as "now" | "later",
    audience: {
      selectAll: false,
      contacts: [] as number[],
      groups: [] as string[],
      tags: [] as string[],
      contactLists: [] as string[],
    },
    selectedPhoneNumbers: [] as string[],
    startDate: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })(),
    startTime: "",
    startTimePeriod: "AM" as "AM" | "PM",
  });




  useEffect(() => {
    if (form.schedulingMode === "now") {
      setForm((prev) => ({
        ...prev,
        startDate: "",
      }));
    } else if (form.schedulingMode === "later" && !form.startDate) {
      const d = new Date();
      setForm((prev) => ({
        ...prev,
        startDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      }));
    }
  }, [form.schedulingMode, form.startDate]);


  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const { data: customContactColumns = [], isLoading: columnsLoading, isError: columnsError, refetch: refetchColumns } = useQuery<{ label: string; field: string }[]>({
    queryKey: ["campaign-contact-columns"],
    enabled: step === 2,
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get("/admin/columns/");
      if (data?.success === false) throw new Error("Unable to load contact columns");
      const columns = Array.isArray(data?.data) ? data.data : [];
      return columns.filter((column: any) => column.label).map((column: any) => ({
        label: column.label,
        field: `contact.custom_fields.${column.label}`,
      }));
    },
  });
  const contactColumnOptions = [
    { label: "Name", field: "contact.name" },
    { label: "Phone number", field: "contact.phone_number" },
    { label: "Email", field: "contact.email" },
    { label: "Source", field: "contact.source" },
    { label: "Status", field: "contact.status" },
    ...customContactColumns.filter(column => !["name", "phone", "phone number", "phone_number", "email", "source", "status"].includes(column.label.toLowerCase().trim())),
  ];
  const updateTemplateField = (index: number, patch: Partial<TemplateField>) => {
    setTemplateFields(fields => fields.map((field, idx) => idx === index ? { ...field, ...patch } : field));
  };

  const [selectedTemplateObj, setSelectedTemplateObj] = useState<Template | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string>(""); // local blob URL for image preview

  // Revoke object URLs when the preview changes to prevent memory leaks
  useEffect(() => {
    return () => {
      if (headerPreviewUrl && headerPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(headerPreviewUrl);
      }
    };
  }, [headerPreviewUrl]);

  const [submitting, setSubmitting] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAudience, setCheckingAudience] = useState(false);
  const [audienceValidationError, setAudienceValidationError] = useState<string | null>(null);
  const [campaignRedirectError, setCampaignRedirectError] = useState<string | null>(null);
  const [campaignNameError, setCampaignNameError] = useState<string | null>(null);
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);


  // Broadcast contact list state — sourced from Zustand store (set by the Contacts page Broadcast button)
  const broadcastContacts = useBroadcastStore((s) => s.selectedContacts);
  const importedContacts  = useBroadcastStore((s) => s.importedContacts);
  const importedListName  = useBroadcastStore((s) => s.importedListName);
  const clearImportedContacts = useBroadcastStore((s) => s.clearImportedContacts);
  const clearSelectedContacts = useBroadcastStore((s) => s.clearSelectedContacts);
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([]);
  const [broadcastDropdownOpen, setBroadcastDropdownOpen] = useState(false);
  const [broadcastSearch, setBroadcastSearch] = useState("");




  useEffect(() => {
    if (broadcastContacts.length > 0) {
      setSelectedBroadcastIds(broadcastContacts.map((c) => c.id));
    }
  }, [broadcastContacts]);

  // Pre-populate manual contacts from the contacts import flow.
  useEffect(() => {
    if (fromImport && importedContacts.length > 0) {
      setManualContacts(
        importedContacts.map((c) => ({ name: c.name, phone: c.phone }))
      );
    }
  }, [fromImport, importedContacts]);

  // Select Contact List panel (expanded inline)
  const [contactPanelSearch, setContactPanelSearch] = useState("");
  const [myListOpen, setMyListOpen] = useState(false);
  const [allContactsOpen, setAllContactsOpen] = useState(false);
  const [allContactsList, setAllContactsList] = useState<RecipientContact[]>([]);
  const [loadingAllContacts, setLoadingAllContacts] = useState(false);
  const [selectedDirectContactIds, setSelectedDirectContactIds] = useState<string[]>([]);

  // ── Manually Added Contacts state ──
  const [manualContacts, setManualContacts] = useState<{ name: string; phone: string }[]>([]);
  const [addContactMode, setAddContactMode] = useState<"none" | "manual" | "paste" | "excel" | "contactlist">("none");
  const [addContactDropdownOpen, setAddContactDropdownOpen] = useState(false);
  const addContactDropdownRef = useRef<HTMLDivElement>(null);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Add Contact dropdown closes only when the button is clicked again (toggle)
  // No outside-click handler — the dropdown stays open until explicitly closed.

  // Country code filter for the Contacts sub-section
  const [contactCountryCodeFilter, setContactCountryCodeFilter] = useState<string>("all");

  const [campaignFilterCountryCodes, setCampaignFilterCountryCodes] = useState<string[]>([]);
  const [campaignFilterCountrySearch, setCampaignFilterCountrySearch] = useState("");
  const [campaignFilterCountryDropdownOpen, setCampaignFilterCountryDropdownOpen] = useState(false);
  const campaignFilterCountryRef = useRef<HTMLDivElement>(null);

  const [campaignFilterTagIds, setCampaignFilterTagIds] = useState<string[]>([]);
  const [campaignFilterTagSearch, setCampaignFilterTagSearch] = useState("");
  const [campaignFilterTagDropdownOpen, setCampaignFilterTagDropdownOpen] = useState(false);
  const campaignFilterTagRef = useRef<HTMLDivElement>(null);

  // Tag & Country Code dropdowns close only when clicked again or another dropdown opens.
  // No outside-click handler — same behaviour as the Add Contact dropdown.


  // API states
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [loadingContactLists, setLoadingContactLists] = useState(false);
  const [contactListsLoadError, setContactListsLoadError] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [approvedTemplates, setApprovedTemplates] = useState<any[]>([]);
  const [wabaAccounts, setWabaAccounts] = useState<any[]>([]);

  const [headerMedia, setHeaderMedia] = useState<{
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
  } | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [phonesRes, wabaRes] = await Promise.all([
          soft7AxiosInstance.get('/admin/waba/phone-numbers'),
          soft7AxiosInstance.get('/admin/waba'),
        ]);

        setPhoneNumbers(phonesRes.data?.data || phonesRes.data || []);
        setWabaAccounts(wabaRes.data?.data || wabaRes.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchInitialData();
  }, []);

  const recipientPhoneNumberId = phoneNumbers.find((p: any) => form.selectedPhoneNumbers.includes(p.id))?.phone_number_id;
  const [contactsLoadError, setContactsLoadError] = useState<string | null>(null);
  useEffect(() => {
    setSelectedDirectContactIds([]);
    setAllContactsList([]);
    setForm(prev => ({ ...prev, audience: { ...prev.audience, contactLists: [] } }));
  }, [recipientPhoneNumberId]);

  useEffect(() => {
    const controller = new AbortController();
    setContactLists([]);
    setContactListsLoadError(null);
    if (!recipientPhoneNumberId) {
      setLoadingContactLists(false);
      return () => controller.abort();
    }

    setLoadingContactLists(true);
    soft7AxiosInstance.get(`/admin/contacts/phone-number/${encodeURIComponent(recipientPhoneNumberId)}/lists`, {
      signal: controller.signal,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (data?.success === false) throw new Error("Failed to load contact lists.");
      const lists = Array.isArray(data) ? data : (data?.data ?? data?.lists ?? []);
      setContactLists(Array.isArray(lists) ? lists : []);
    }).catch(err => {
      if (controller.signal.aborted) return;
      setContactListsLoadError(err?.response?.data?.message || err?.message || "Failed to load contact lists.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingContactLists(false);
    });

    return () => controller.abort();
  }, [recipientPhoneNumberId]);

  useEffect(() => {
    const controller = new AbortController();
    setContactsLoadError(null);
    if (!recipientPhoneNumberId) {
      setLoadingAllContacts(false);
      return () => controller.abort();
    }
    setLoadingAllContacts(true);
    const params = new URLSearchParams({ opt_in_status: "true", is_opted_out: "false", phone_number_id: String(recipientPhoneNumberId) });
    campaignFilterCountryCodes.forEach(code => params.append("country_code", code));
    campaignFilterTagIds.forEach(id => params.append("tag_ids", id));
    soft7AxiosInstance.get(`/admin/contacts/all?${params}`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        checkCampaignResponse(data);
        const contacts = extractRecipientContacts(data);
        setAllContactsList(contacts);
        setSelectedDirectContactIds(ids => ids.filter(id => contacts.some(contact => contact.id === id)));
      }).catch(err => {
        if (controller.signal.aborted) return;
        setAllContactsList([]);
        setSelectedDirectContactIds([]);
        setContactsLoadError(getCampaignErrorMessage(err));
      }).finally(() => {
        if (!controller.signal.aborted) setLoadingAllContacts(false);
      });
    return () => controller.abort();
  }, [recipientPhoneNumberId, campaignFilterCountryCodes, campaignFilterTagIds]);

  // selectedTagNames: holds the tag name strings selected in the Tag dropdown
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  const { data: tags = [], isLoading: loadingTags } = useQuery<Tag[]>({
    queryKey: ["campaign-tags"],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get("/admin/contacts/tags");
      // API may return { data: [...] } or array directly
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    enabled: step >= 3,
    staleTime: 0,
  });


  const activeSendingNumber = phoneNumbers?.find((p: any) => form.selectedPhoneNumbers?.includes(p.id)) || phoneNumbers?.[0];

  const getMediaType = (file: File): "IMAGE" | "VIDEO" | "DOCUMENT" => {
    const type = file.type;
    if (type.startsWith("image/")) return "IMAGE";
    if (type.startsWith("video/")) return "VIDEO";
    return "DOCUMENT";
  };

  const handleMediaUpload = async (file: File) => {
    try {
      if (!headerMedia?.type) {
        toast.error("Invalid template: No media type found");
        return;
      }

      const detectedType = getMediaType(file);

      if (detectedType !== headerMedia.type) {
        toast.error(`Expected ${headerMedia.type} but got ${detectedType}`);
        return;
      }

      setUploadingMedia(true);

      const formData = new FormData();
      formData.append("file", file);
      // Use the active phone number ID, or safely fallback to the hardcoded Meta test one if DB is empty
      const selectedPhoneId = activeSendingNumber?.phone_number_id || '762352490286897';
      formData.append("phone_number_id", selectedPhoneId);
      formData.append("type", headerMedia.type);

      // Store a local preview URL for displaying in the Review step
      setHeaderPreviewUrl(URL.createObjectURL(file));

      const res = await soft7AxiosInstance.post("/admin/campaigns/upload-media", formData);
      const data = res.data;

      if (!data.success) throw new Error(data?.message || "Upload failed");

      // Extract the media URL from the API response (e.g. data.data.media_url)
      const uploadedUrl = data?.data?.media_url || data?.data?.media_id || data?.url || data?.mediaUrl || data?.id;

      if (!uploadedUrl) {
        throw new Error("API did not return a valid media URL or ID");
      }

      setForm((prev) => ({
        ...prev,
        headerMediaUrl: uploadedUrl,
        ...(headerMedia.type === "DOCUMENT"
          ? { headerDocumentFilename: prev.headerDocumentFilename || file.name }
          : {}),
      }));

      toast.success(`${headerMedia.type} uploaded successfully 🚀`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleOpenTemplateModal = async () => {
    if (!form.selectedPhoneNumbers || form.selectedPhoneNumbers.length === 0) {
      toast.error("Please select a Sender Phone Number first.");
      return;
    }

    const selectedPhoneId = form.selectedPhoneNumbers[0];
    const activeNumber = phoneNumbers.find(
      (p: any) => p.id === selectedPhoneId || p.phone_number_id === selectedPhoneId
    );
    const fbPhoneNumberId = activeNumber?.phone_number_id || activeNumber?.id;
    
    let wabaId = null;
    for (const waba of wabaAccounts) {
      const phoneData = waba?.meta_data?.phone_numbers?.data || [];
      if (phoneData.some((p: any) => p.id === fbPhoneNumberId || p.id === selectedPhoneId)) {
        wabaId = waba.waba_id;
        break;
      }
    }

    if (!wabaId && wabaAccounts.length > 0) {
      const firstWaba = wabaAccounts[0];
      wabaId = firstWaba.waba_id || firstWaba.whatsapp_business_account_id || firstWaba.wabaId;
    }

    if (!wabaId) {
      toast.error("Could not find WABA account for selected phone number.");
      return;
    }

    try {
      const toastId = toast.loading("Fetching templates...");
      const res = await soft7AxiosInstance.get(`/admin/templates?status=APPROVED&wabaId=${wabaId}`);
      toast.dismiss(toastId);

      const templates = res.data?.data || res.data || [];
      setApprovedTemplates(templates);
      setTemplateModalOpen(true);
    } catch (err) {
      toast.dismiss();
      toast.error("Failed to fetch templates");
      console.error(err);
    }
  };

  function updateField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    if (k === "startDate" || k === "startTime") {
      setScheduleError(null);
    }
  }

  const validateSchedule = (): boolean => {
    setScheduleError(null);

    if (form.schedulingMode === "later") {
      if (!form.startDate) {
        setScheduleError("Start date is required");
        return false;
      }
      if (!form.startTime || form.startTime === "::00" || form.startTime.split(":").slice(0, 2).some(p => !p)) {
        setScheduleError("Start time (HH:MM) is required");
        return false;
      }
    }

    return true;
  };
  const validateCampaignName = (name: string): string | null => {
    if (!name.trim()) return "Campaign name is required.";
    return null;
  };

  const handleNext = async () => {
    // ── Step 1: Basic Info ──────────────────────────────────────────────
    if (step === 1) {
      const nameErr = validateCampaignName(form.name);
      if (nameErr) {
        setCampaignNameError(nameErr);
        toast.error(nameErr);
        return;
      }
      if (!form.selectedPhoneNumbers || form.selectedPhoneNumbers.length === 0) {
        toast.error("Please select a sender phone number before continuing.");
        return;
      }
      if (!form.selectedTemplate || !form.messageTemplate) {
        toast.error("Please select a message template before continuing.");
        return;
      }
    }

    // ── Step 2: Variable Mapping ─────────────────────────────────────────
    if (step === 2) {
      // Header media required but not uploaded?
      if (headerMedia && !form.headerMediaUrl?.trim()) {
        toast.error(`Please upload the required ${headerMedia.type} before continuing.`);
        return;
      }
      // All body variable values must be filled
      const emptyVar = templateFields.findIndex((f) => !(f.source === "contact" ? f.contactField?.trim() : f.value.trim()));
      if (emptyVar !== -1) {
        toast.error(`Please fill in variable ${emptyVar + 1} before continuing.`);
        return;
      }
    }

    // ── Step 3: Audience / Contacts ──────────────────────────────────────
    // Tags are optional — at least one contact or contact list is required
    if (step === 3) {
      if (
        form.audience.contactLists.length === 0 &&
        selectedBroadcastIds.length === 0 &&
        selectedDirectContactIds.length === 0 &&
        manualContacts.length === 0
      ) {
        toast.error("Please select at least one contact or contact list to proceed.");
        return;
      }
      setCheckingAudience(true);
      setAudienceValidationError(null);
      try {
        await validateCampaignAudience(buildPayload());
      } catch (error) {
        const message = getCampaignErrorMessage(error);
        setAudienceValidationError(message);
        toast.error(message);
        return;
      } finally {
        setCheckingAudience(false);
      }
    }

    // ── Step 4: Schedule ────────────────────────────────────────────────
    if (step === 4 && !validateSchedule()) {
      return;
    }

    if (step < 5) {
      const nextStep = (step + 1) as Step;

      // When entering Review step, log the payload directly (no function hoisting issues)
      if (nextStep === 5) {
        const parameter_mapping = buildParameterMapping(templateFields);

        const media_uploads: { type: string; link: string; filename?: string }[] = [];
        if (form.headerMediaUrl && headerMedia?.type) {
          const item: any = {
            type: headerMedia.type.toLowerCase(),
            link: form.headerMediaUrl,
          };
          if (headerMedia.type === "DOCUMENT" && form.headerDocumentFilename) {
            item.filename = form.headerDocumentFilename.trim();
          }
          media_uploads.push(item);
        }

        const contact_filters: any = {};
        if (selectedTagNames.length > 0) {
          contact_filters.tags = selectedTagNames;
        }
        if (form.audience.contactLists && form.audience.contactLists.length > 0) {
          contact_filters.list_ids = form.audience.contactLists;
        }

        const reviewPayload: any = {
          name: form.name,
          template_id: form.selectedTemplate,
          phone_number_id: activeSendingNumber?.phone_number_id || "661886587013056",
          save_contacts: false,
        };

        if (form.description) reviewPayload.description = form.description;
        if (Object.keys(contact_filters).length > 0) reviewPayload.contact_filters = contact_filters;
        if (Object.keys(parameter_mapping).length > 0) reviewPayload.parameter_mapping = parameter_mapping;
        if (media_uploads.length > 0) reviewPayload.media_uploads = media_uploads;
        if (form.schedulingMode === "later" && form.startDate && form.startTime) reviewPayload.scheduled_at = `${form.startDate}T${form.startTime}.000Z`;
        reviewPayload.send_immediately = form.schedulingMode === "now";

      }

      setStep(nextStep);
    }
  };

  const handlePrev = () => {
    if (step === 1) {
      router.push("/user/campaigns");
    } else {
      setStep((s) => (s - 1) as Step);
    }
  };


  function extractTemplateMeta(template: any) {
    const variables: TemplateField[] = [];
    let detectedHeaderMedia: null | {
      type: "IMAGE" | "VIDEO" | "DOCUMENT";
    } = null;

    template.components?.forEach((comp: any) => {

      // ✅ BODY variables — also capture example names from body_text[0]
      if (comp.text || comp.buttons?.some((button: any) => button.url?.includes("{{"))) {
        const matches = [comp.text || "", ...(comp.buttons || []).map((button: any) => button.url || "")].join(" ").match(/{{\s*[^{}]+\s*}}/g);
        // body_text[0] = ordered example names e.g. ["order_id", "order_details", "invoice"]
        const exampleNames: string[] = comp.example?.body_text?.[0] ?? [];
        if (matches) {
          matches.forEach((m: string, idx: number) => {
            const key = m.replace(/[{}]/g, "").trim();
            if (!variables.find((v) => v.key === key)) {
              variables.push({ key, value: "", label: exampleNames[idx] ?? undefined });
            }
          });
          // Sort variables by their numeric key so {{1}} → field 0, {{2}} → field 1, etc.
          variables.sort((a, b) => parseInt(a.key, 10) - parseInt(b.key, 10));
          // Set default value for the first variable (lowest key) after sorting
          if (variables.length > 0 && variables[0].value === "") {
            variables[0].source = "contact";
            variables[0].contactField = "contact.name";
            variables[0].fallbackValue = "Guest";
          }
        }
      }

      // ✅ HEADER MEDIA
      if (
        comp.type === "HEADER" &&
        ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)
      ) {
        detectedHeaderMedia = { type: comp.format };
      }
    });

    return { variables, headerMedia: detectedHeaderMedia };
  }




  useEffect(() => {
    if (selectedTemplateObj) {
      const { variables, headerMedia } = extractTemplateMeta(selectedTemplateObj);
      setTemplateFields(variables);
      setHeaderMedia(headerMedia);
    }
  }, [selectedTemplateObj]);

  const createCampaignMutation = useMutation({
    mutationFn: async (payload: any) => {
      await validateCampaignAudience(payload);
      const res = await soft7AxiosInstance.post("/admin/campaigns", payload);
      return checkCampaignResponse(res.data);
    },
    onSuccess: async (data: any, payload: any) => {
      const campaignId = getCreatedCampaignId(data);
      if (!campaignId) {
        const message = "The server accepted the campaign but did not return its ID. Open Campaigns to locate it before creating another campaign.";
        setCampaignRedirectError(message);
        toastify.error(message, { containerId: "campaign-errors" });
        return;
      }

      // Refresh cached lists without delaying navigation to the created campaign.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["tags"] }),
      ]).catch(error => console.error("Failed to refresh campaign caches:", error));
      clearImportedContacts();
      clearSelectedContacts();

      // ── AUTO-START: If send_immediately was requested, call /start right after creation ──
      // The backend only creates the campaign in 'scheduled' state; it does NOT auto-run it.
      // Without this call the campaign just sits idle and no messages are sent.
      if (payload?.send_immediately) {
        try {
          const response = await soft7AxiosInstance.post(`/admin/campaigns/${encodeURIComponent(campaignId)}/start`);
          checkCampaignResponse(response.data);
        } catch (startErr: any) {
          // Don't block navigation — the user can manually start from the stats page
          console.error(`Failed to auto-start campaign ${campaignId}:`, startErr?.response?.data || startErr?.message);
          toast.error(`Campaign saved, but it could not start: ${getCampaignErrorMessage(startErr)} Open the campaign details to retry.`, { duration: 8000 });
        }
      }

      router.push(`/user/campaigns/${encodeURIComponent(campaignId)}/stats`);
    },
    onError: (error: any) => {
      toastify.error(getCampaignErrorMessage(error), {
        containerId: "campaign-errors",
      });
    },
  });

  // Converts a local IST date+time to UTC by subtracting 5h30m
  // so the server (which adds +5:30 when storing) saves the correct time.
  function toUTC(date: string, time: string): { date: string; time: string } {
    const [year, month, day] = date.split("-").map(Number);
    const parts = time.split(":").map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;

    let totalMinutes = h * 60 + m - (5 * 60 + 30); // subtract IST offset
    let dayOffset = 0;

    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
      dayOffset = -1;
    } else if (totalMinutes >= 24 * 60) {
      totalMinutes -= 24 * 60;
      dayOffset = 1;
    }

    const adjusted = new Date(year, month - 1, day + dayOffset);
    const newDate = `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, "0")}-${String(adjusted.getDate()).padStart(2, "0")}`;
    const newTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    return { date: newDate, time: newTime };
  }

  async function validateCampaignAudience(payload: any) {
    if (payload.contact_filters?.list_ids?.length || payload.contact_filters?.tags?.length) {
      const { data } = await soft7AxiosInstance.post("/admin/campaigns/preview-recipients", {
        phone_number_id: payload.phone_number_id,
        contact_filters: payload.contact_filters,
      });
      checkCampaignResponse(data);
      const recipientCount = getPreviewRecipientCount(data);
      if (recipientCount === 0) throw new Error("No eligible recipients found. Please choose contacts who can receive this campaign.");
    }
  }

  // Build the final API payload in the required shape
  function buildPayload() {
    // parameter_mapping: { "1": "value1", "2": "value2", ... }
    const parameter_mapping = buildParameterMapping(templateFields);

    // media_uploads: only if a header media was uploaded
    const media_uploads: { type: string; link: string; filename?: string }[] = [];
    if (form.headerMediaUrl && headerMedia?.type) {
      const item: any = {
        type: headerMedia.type.toLowerCase(),
        link: form.headerMediaUrl,
      };
      if (headerMedia.type === "DOCUMENT" && form.headerDocumentFilename) {
        item.filename = form.headerDocumentFilename.trim();
      }
      media_uploads.push(item);
    }

    // contact_filters — only include list_ids if actually selected
    const contact_filters: any = {};
    if (form.audience.contactLists && form.audience.contactLists.length > 0) {
      contact_filters.list_ids = form.audience.contactLists;
    }

    // tags: send the tag names (not IDs) as required by the API
    if (selectedTagNames.length > 0) {
      contact_filters.tags = selectedTagNames;
    }

    // Collect phone numbers from directly selected contacts (from Contacts sub-section)
    const directPhones = selectedDirectContactIds
      .map(id => allContactsList.find(c => c.id === id)?.phone_number)
      .filter(Boolean) as string[];

    // Collect phone numbers from broadcast contacts (selected on the Contacts page)
    const broadcastPhones = selectedBroadcastIds
      .map(id => broadcastContacts.find(c => c.id === id)?.phone)
      .filter(Boolean) as string[];

    // Collect phone numbers from manually added contacts
    const manualPhones = manualContacts.map(c => c.phone).filter(Boolean);

    // Preserve selected phone values, including country codes and formatting.
 const allContactNumbers = [...new Set(
 [...broadcastPhones, ...directPhones, ...manualPhones]
 .filter(Boolean)
 )];
 
 if (allContactNumbers.length > 0) {
 contact_filters.contactNumber = allContactNumbers;
 }

 const payload: any = {
 name: form.name,
 template_id: form.selectedTemplate,
 phone_number_id: activeSendingNumber?.phone_number_id || "661886587013056",
 contact_filters,
 save_contacts: false,
 };

 // Only add optional fields if they have data
 if (Object.keys(parameter_mapping).length > 0) payload.parameter_mapping = parameter_mapping;
 if (media_uploads.length > 0) payload.media_uploads = media_uploads;
 // Convert local IST time → UTC before sending (server adds +5:30 so we subtract it here)
 if (form.schedulingMode === "later" && form.startDate && form.startTime) {
 const { date: utcDate, time: utcTime } = toUTC(form.startDate, form.startTime);
 payload.scheduled_at = `${utcDate}T${utcTime}.000Z`;
 }
 payload.send_immediately = form.schedulingMode === "now";
 // When sending immediately, also send scheduled_at as current UTC time + 1 minute
 if (form.schedulingMode === "now") {
 payload.scheduled_at = new Date(Date.now() + 5 * 1000).toISOString();
 }

 return payload;
 }

  const requiredVariableKeys = selectedTemplateObj ? extractTemplateMeta(selectedTemplateObj).variables.map(field => field.key) : [];
  const mappingValidation = validateTemplateMappings(requiredVariableKeys, templateFields, []);
  const variablesInvalid = mappingValidation.some(result => result.blocking);

 async function submit(e: React.FormEvent) {
 e.preventDefault();
    if (createCampaignMutation.isPending || createCampaignMutation.isSuccess || campaignRedirectError) return;
    if (variablesInvalid) {
      toast.error(mappingValidation.find(result => result.blocking)?.message || "Please complete the template variable mappings.");
      return;
    }
 const hasDynamicMediaHeader =
 selectedTemplateObj?.components?.some(
 (c: any) =>
 c.type === "HEADER" &&
 ["IMAGE", "VIDEO", "DOCUMENT"].includes((c.format || "").toUpperCase()),
 ) && selectedTemplateObj?.headerMode === "dynamic";
 if (hasDynamicMediaHeader && !form.headerMediaUrl?.trim()) {
 toast.error("Please provide Header Media URL for the dynamic template.");
 return;
 }
 createCampaignMutation.mutate(buildPayload());
 }


 // Shared handler for adding a manual contact — used by both the Enter key and the Add button
 const handleAddManualContact = () => {
 const phone = "+" + manualPhone.replace(/[^\d]/g, "").trim();
 if (!phone || phone.length < 8) {
 toast.error("Please enter a valid phone number");
 return;
 }
 if (manualContacts.some((c) => c.phone === phone)) {
 toast.error("This number is already added");
 return;
 }
 setManualContacts((prev) => [
 ...prev,
 { name: manualName.trim() || "Manual Contact", phone },
 ]);
 setManualName("");
 setManualPhone("");
 toast.success("Contact added!");
 };

 const steps = ["Basic Info", "Variables", "Contact", "Schedule", "Review"];

 return (
 <div
 className="campaign-create-page min-h-screen bg-background text-foreground px-4 sm:px-6 py-8"
 style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
 >
      <ToastContainer containerId="campaign-errors" position="top-center" autoClose={6000} />
 <div className={`mx-auto w-full transition-all duration-300 ${step >= 2 && selectedTemplateObj ? "max-w-6xl flex flex-col lg:flex-row items-start gap-8" : "max-w-3xl"}`}>
 {/* Main Form Container */}
 <div className="flex-1 min-w-0 w-full">
 {/* Header */}
 <div className="mb-6">
 <div className="flex items-center gap-4 mb-4">
 <button
 onClick={() => router.push("/user/campaigns")}
 className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs h-8 px-3 text-[0.8125rem] flex items-center gap-1.5"
 >
 <ChevronLeft className="w-4 h-4" />
 Back to Campaigns
 </button>
 </div>
 <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5 font-display">
 <FileText className="w-6 h-6 text-accent shrink-0" />
 {steps[step - 1]}
 </h1>
 </div>

 {/* Progress Bar */}
 <div className="mb-8">
 <div className="flex items-center justify-between mb-3">
 {steps.map((s, idx) => (
 <div key={idx} className="flex flex-col items-center flex-1">
 <div
 className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
 idx + 1 === step
 ? "bg-accent text-primary-foreground shadow-md ring-4 ring-accent/20"
 : idx + 1 < step
 ? "bg-primary-light text-primary-text border border-primary-soft font-bold"
 : "bg-card text-muted-foreground border border-border"
 }`}
 style={idx + 1 === step ? { backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" } : {}}
 >
 {idx + 1}
 </div>
 <span className={`text-[11px] mt-1.5 font-medium hidden sm:block ${idx + 1 === step ? "text-primary-text font-bold" : "text-muted-foreground"}`}>
 {s}
 </span>
 </div>
 ))}
 </div>
 <div className="h-1.5 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full transition-all duration-500"
 style={{
 width: `${((step - 1) / (steps.length - 1)) * 100}%`,
 backgroundColor: "var(--color-primary)",
 }}
 ></div>
 </div>
 </div>

 {/* Form Card */}
 <div
 className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm text-foreground"
 style={{ backgroundColor: "var(--color-surface-muted)" }}
 >
 <div className="flex-1">
 {/* Step 1: Basic Info */}
 {step === 1 && (
 <div className="space-y-6">
 <h2 className="text-xl font-bold text-foreground font-display mb-4">
 Basic Information
 </h2>

 {/* Campaign Name */}
 <div>
 <label className="block text-sm font-semibold text-secondary-foreground dark:text-white mb-2">
 Campaign Name <span className="text-error">*</span>
 </label>
 <input
 type="text"
 value={form.name}
 onChange={(e) => {
 updateField("name", e.target.value);
 // Live validation feedback
 const err = validateCampaignName(e.target.value);
 setCampaignNameError(err);
 }}
 className={`w-full w-full text-sm text-foreground bg-input border border-border rounded-md h-[2.375rem] px-3 text-sm ${campaignNameError
 ? "!border-destructive !ring-destructive/20 bg-destructive/5"
 : ""
 }`}
 placeholder="Enter campaign name (e.g. Summer Launch)"
 />
 {campaignNameError && (
 <div className="mt-2 flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
 <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
 <p className="text-xs font-semibold text-destructive">{campaignNameError}</p>
 </div>
 )}
 </div>

 {/* Campaign Type */}
 <div>
 <label className="block text-sm font-semibold text-foreground mb-2">
 Campaign Type
 </label>
 <div className="grid grid-cols-3 gap-4">
 {[
 {
 value: "WhatsApp",
 icon: MessageSquare,
 label: "WhatsApp",
 },
 ].map((type) => {
 const Icon = type.icon;
 const isSelected = form.type === type.value;
 return (
 <button
 key={type.value}
 type="button"
 aria-pressed={isSelected}
 onClick={() => updateField("type", type.value)}
 className={`flex flex-col items-center justify-center p-4 border rounded-xl transition cursor-pointer ${
 isSelected
 ? "bg-primary-light border-primary text-primary-text shadow-sm"
 : "bg-card border-border text-foreground hover:bg-muted"
 }`}
 >
 <Icon className="w-7 h-7 mb-2 text-accent" />
 <span className="font-semibold text-sm">{type.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Sender Phone Numbers Selection */}
 {phoneNumbers && phoneNumbers.length > 0 && (
 <div className="mt-6">
 <label className="block text-sm font-semibold text-foreground mb-3">
 Select Sender Phone Numbers
 </label>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[250px] overflow-y-auto pr-2">
 {phoneNumbers.map((phone) => {
 const isSelected = form.selectedPhoneNumbers?.includes(phone.id);
 return (
 <div
 key={phone.id}
 onClick={() => {
 const newSelection = isSelected ? [] : [phone.id];
 updateField("selectedPhoneNumbers", newSelection);
 }}
 className={`p-3.5 border rounded-xl cursor-pointer transition-all flex flex-col gap-1 ${isSelected
 ? "border-primary bg-primary-light shadow-sm"
 : "border-border bg-card hover:bg-muted"
 }`}
 >
 <div className="font-semibold text-foreground flex items-center justify-between text-xs">
 {phone.verified_name || phone.display_phone_number || 'Unknown Number'}
 {isSelected && (
 <div className="w-2 h-2 rounded-full bg-accent"></div>
 )}
 </div>
 <div className="text-[11px] text-muted-foreground">
 {phone.display_phone_number}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Message Template */}
 <div>
 <label className="block text-sm font-semibold text-foreground mb-2">
 Message Template
 </label>
 <div className="flex gap-3">
 {form.messageTemplate ? (
 <>
 <div className="w-full flex items-center justify-between p-4 border border-primary-soft bg-primary-light rounded-xl">
 <div className="flex flex-col">
 <span className="font-bold text-foreground text-sm">
 {form.messageTemplate}
 </span>
 <span className="text-xs font-semibold text-primary-text">
 Selected Template
 </span>
 </div>
 <button
 onClick={handleOpenTemplateModal}
 className="text-xs font-bold text-primary-text hover:underline cursor-pointer"
 >
 Change
 </button>
 </div>
 {selectedTemplateObj?.components?.some(
 (c: any) =>
 c.type === "HEADER" &&
 ["IMAGE", "VIDEO", "DOCUMENT"].includes((c.format || "").toUpperCase()),
 ) &&
 selectedTemplateObj?.headerMode === "dynamic" && (
 <div className="w-full mt-3 p-4 border border-border bg-muted/40 rounded-xl">
 <label className="block text-xs font-semibold text-foreground mb-2">
 Header Media (required for dynamic template)
 </label>
 <input
 type="text"
 value={form.headerMediaUrl}
 onChange={(e) => updateField("headerMediaUrl", e.target.value)}
 placeholder="https://example.com/image.jpg or paste media ID from upload"
 className="w-full w-full text-sm text-foreground bg-input border border-border rounded-md h-[2.375rem] px-3 text-sm"
 />
 </div>
 )}
 </>
 ) : (
 <button
 type="button"
 onClick={handleOpenTemplateModal}
 className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none h-[2.375rem] px-4 bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs flex items-center gap-2 cursor-pointer"
 >
 <FileText size={15} />
 Select Template
 </button>
 )}
 </div>
 </div>

 
 </div>
 )}

 <TemplateSelectionModal
 isOpen={templateModalOpen}
 onClose={() => setTemplateModalOpen(false)}
 templates={approvedTemplates}
 onSelect={(template) => {
 updateField("messageTemplate", template.name);
 updateField("selectedTemplate", template.id);
 updateField("templateCategory", template.category || "");
 updateField("headerMediaUrl", "");
 setHeaderPreviewUrl("");

 const { variables, headerMedia } = extractTemplateMeta(template);

 setTemplateFields(variables);

 // ✅ IMPORTANT: always reset
 setHeaderMedia(headerMedia || null);

 setSelectedTemplateObj(template);
 setTemplateModalOpen(false);
 }}
 selectedTemplateId={form.selectedTemplate}
 />

 {headerMedia && (
 <MediaPickerModal
 isOpen={mediaPickerOpen}
 onClose={() => setMediaPickerOpen(false)}
 onSelect={(url, filename) => {
 updateField("headerMediaUrl", url);
 setHeaderPreviewUrl(url);
 if (headerMedia.type === "DOCUMENT" && filename) {
 updateField("headerDocumentFilename", filename);
 }
 }}
 onUploadNew={async (file) => {
 await handleMediaUpload(file);
 setMediaPickerOpen(false); // Close on start upload or keep open? Let's close it so they can see the spinner on the main form.
                  }}
                  uploadingMedia={uploadingMedia}
                  mediaType={headerMedia.type}
                />
              )}

              {/* Step 2: Variable Mapping */}
              
              {step === 2 && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-bold text-foreground font-display">Variable Mapping</h2>
                  </div>

                  {!form.messageTemplate ? (
                    <div className="p-8 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                      <p className="text-foreground font-semibold">No template selected.</p>
                      <p className="text-xs text-muted-foreground mt-1">Go back and pick a template first.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">

                      {/* ── SECTION 1: UPLOAD MEDIA ── */}
                      {headerMedia && (
                        <div className="rounded-2xl border border-border overflow-hidden bg-card">
                          <div
                            className="px-4 py-3 border-b border-border flex items-center justify-between"
                            style={{ backgroundColor: "var(--color-surface-active)" }}
                          >
                            <p className="text-sm font-bold text-foreground">
                              Upload {headerMedia.type === "DOCUMENT" ? "PDF / Document" : headerMedia.type.charAt(0) + headerMedia.type.slice(1).toLowerCase()}
                            </p>
                            {headerMedia.type === "DOCUMENT" && (
                              <span className="text-[11px] font-semibold text-destructive bg-destructive/10 px-2.5 py-0.5 rounded-full">
                                PDF Document Header
                              </span>
                            )}
                          </div>

                          <div className="p-4" style={{ backgroundColor: "var(--color-surface-muted)" }}>
                            {form.headerMediaUrl ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3 p-4 bg-surface border border-black/15 rounded-xl shadow-2xs">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
                                      <Check className="w-4.5 h-4.5 text-white" strokeWidth={2.5} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-foreground">
                                        {headerMedia.type === "DOCUMENT" ? "PDF / Document attached" : `${headerMedia.type.charAt(0) + headerMedia.type.slice(1).toLowerCase()} uploaded`}
                                      </p>
                                      {headerMedia.type === "DOCUMENT" && form.headerDocumentFilename ? (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate font-medium">
                                          File: <strong className="text-foreground">{form.headerDocumentFilename}</strong>
                                        </p>
                                      ) : (
                                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                          Ready to attach to campaign
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMediaPickerOpen(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs text-xs px-3 py-1.5 shrink-0 cursor-pointer shadow-2xs"
                                  >
                                    Change
                                  </button>
                                </div>

                                {headerMedia.type === "DOCUMENT" && (
                                  <div className="p-3.5 bg-card rounded-xl border border-border">
                                    <label className="block text-xs font-bold text-foreground mb-1">
                                      PDF / Document Display Name <span className="text-primary-text font-semibold">(Display Name in WhatsApp)</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={form.headerDocumentFilename}
                                      onChange={(e) => updateField("headerDocumentFilename", e.target.value)}
                                      placeholder="e.g. Wedding_Invitation.pdf"
                                      className="w-full w-full text-sm text-foreground bg-input border border-border rounded-md h-[2.375rem] px-3 text-sm"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      The recipient will see this file name on WhatsApp when the document arrives (instead of Untitled).
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setMediaPickerOpen(true)}
                                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border hover:border-accent bg-primary-light hover:bg-primary-light/80 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Upload className="w-5 h-5 text-accent" />
                                  <span className="text-sm font-semibold text-primary-text">
                                    {headerMedia.type === "DOCUMENT" ? "Select or Upload PDF / Document" : "Select or Upload Media"}
                                  </span>
                                </button>
                                {uploadingMedia && (
                                  <p className="text-xs text-primary-text mt-2 flex items-center gap-1 font-medium">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── SECTION 2: BODY VARIABLES ── */}
                      {templateFields.length > 0 && (
                        <div className="relative z-20 rounded-2xl border border-border overflow-visible bg-card">
                          {/* Section title bar */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 border-b border-border"
                            style={{ backgroundColor: "var(--color-surface-active)" }}
                          >
                            <span
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-primary-foreground text-xs font-bold shrink-0 shadow-sm"
                              style={{ backgroundColor: "var(--color-primary)" }}
                            >
                              B
                            </span>
                            <div>
                              <p className="text-sm font-bold text-foreground">Template Variables</p>
                              <p className="text-xs text-muted-foreground">
                                Enter a shared value or personalize each placeholder using a contact column
                              </p>
                            </div>
                          </div>

                          <div className="divide-y divide-border" style={{ backgroundColor: "var(--color-surface-muted)" }}>
                            {templateFields.map((field, idx) => (
                              <div key={idx} className="px-4 py-4 hover:bg-black/2 transition-colors">
                                <div className="flex items-start gap-4">
                                  {/* Serial number badge */}
                                  <span
                                    className="w-7 h-7 mt-1 shrink-0 flex items-center justify-center rounded-full bg-accent text-primary-foreground text-xs font-bold shadow-sm"
                                    style={{ backgroundColor: "var(--color-primary)" }}
                                  >
                                    {idx + 1}
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    {/* Value input */}
                                    <label className="block text-sm font-semibold text-foreground mb-2" htmlFor={`variable-${field.key}`}>
                                      {`Variable {{${field.key}}}`}{field.label ? ` ? ${field.label}` : ""}
                                    </label>
                                    <div className="flex gap-2 mb-3" role="group" aria-label={`Value source for variable ${field.key}`}>
                                      {(["manual", "contact"] as const).map(source => (
                                        <button key={source} type="button" aria-pressed={(field.source || "manual") === source}
                                          onClick={() => updateTemplateField(idx, { source })}
                                          className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${(field.source || "manual") === source ? "bg-primary-light border-accent text-primary-text" : "bg-card border-border text-muted-foreground"}`}>
                                          {source === "manual" ? "Manual value" : "Contact column"}
                                        </button>
                                      ))}
                                    </div>
                                    {field.source === "contact" ? (
                                      <div className="space-y-3">
                                        <select id={`variable-${field.key}`} value={field.contactField || ""}
                                          onChange={e => updateTemplateField(idx, { contactField: e.target.value })}
                                          className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/15">
                                          <option value="">Select a contact column</option>
                                          {contactColumnOptions.map(column => <option key={column.field} value={column.field}>{column.label}</option>)}
                                        </select>
                                        {columnsLoading && <p className="text-xs text-muted-foreground">Loading custom columns?</p>}
                                        {columnsError && <p className="text-xs text-muted-foreground">Custom columns could not be loaded. <button type="button" className="underline" onClick={() => refetchColumns()}>Retry</button></p>}
                                        <div>
                                          <label htmlFor={`fallback-${field.key}`} className="block text-xs font-semibold text-foreground mb-1">Fallback value (optional)</label>
                                          <input id={`fallback-${field.key}`} value={field.fallbackValue || ""}
                                            onChange={e => updateTemplateField(idx, { fallbackValue: e.target.value })}
                                            placeholder="e.g. Guest"
                                            aria-describedby={`fallback-help-${field.key}`}
                                            className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/15" />
                                          <p id={`fallback-help-${field.key}`} className="text-xs text-muted-foreground mt-1">If provided, used when this contact has no value in the selected column. You can leave it blank.</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Each recipient gets their own contact value.</p>
                                      </div>
                                    ) : (
                                      <input id={`variable-${field.key}`} value={field.value}
                                        onChange={e => updateTemplateField(idx, { value: e.target.value })}
                                        placeholder={`Enter a value for {{${field.key}}}`}
                                        className="w-full h-10 px-3 border border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/15" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state — template selected but no variables */}
                      {templateFields.length === 0 && !headerMedia && (
                        <div className="p-6 text-center bg-card rounded-2xl border border-border">
                          <p className="text-foreground font-semibold">This template has no variables.</p>
                          <p className="text-xs text-muted-foreground mt-1">The message body has no {'{{n}}'} placeholders — you can proceed to the next step.</p>
                        </div>
                      )}

                    </div>
                  )}

                  {/* Info */}
                  <div className="p-4 bg-primary-light border border-primary-soft rounded-xl flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Dynamic Personalization</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Fill in the values above — they will be injected into the WhatsApp message when the campaign runs.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Contact/Audience */}
              {step === 3 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-foreground font-display mb-4">Select Contacts</h2>
                  <p className="text-sm text-muted-foreground">{CAMPAIGN_CONTACT_GUIDANCE}</p>

                  {/* ── Contact Filters (Country Code + Tag) ── */}
                  <div className="rounded-xl border border-black/15 bg-surface shadow-xs relative z-20">
                    {/* Filter Header */}
                    <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between rounded-t-xl" style={{ backgroundColor: "var(--color-surface-active)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
                          <Filter className="w-4 h-4 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                        </div>
                        <span className="text-sm font-bold text-foreground">Filter Contacts</span>
                        {(campaignFilterCountryCodes.length > 0 || campaignFilterTagIds.length > 0) && (
                          <span className="text-xs bg-accent text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                            {(campaignFilterCountryCodes.length > 0 ? 1 : 0) + (campaignFilterTagIds.length > 0 ? 1 : 0)} active
                          </span>
                        )}
                      </div>
                      {(campaignFilterCountryCodes.length > 0 || campaignFilterTagIds.length > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCampaignFilterCountryCodes([]);
                            setCampaignFilterTagIds([]);
                          }}
                          className="text-xs text-destructive hover:underline font-semibold transition-colors cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>

                    {/* Filter Body */}
                    <div className="p-4 rounded-b-xl" style={{ backgroundColor: "var(--color-surface-muted)" }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Country Code Filter */}
                        <div ref={campaignFilterCountryRef} className="campaign-country-filter relative">
                          <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            Country Code
                          </label>
                          <button
                            type="button"
                            onClick={() => { setCampaignFilterCountryDropdownOpen(prev => !prev); setAddContactDropdownOpen(false); setCampaignFilterTagDropdownOpen(false); }}
                            className="w-full h-10 px-3.5 border border-black/15 rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 bg-surface text-foreground transition shadow-2xs cursor-pointer flex items-center justify-between"
                          >
                            <span className={campaignFilterCountryCodes.length > 0 ? "font-medium" : "text-muted-foreground"}>
                              {campaignFilterCountryCodes.length > 0
                                ? `${campaignFilterCountryCodes.length} countr${campaignFilterCountryCodes.length === 1 ? "y" : "ies"} selected`
                                : "All countries"}
                            </span>
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${campaignFilterCountryDropdownOpen ? "rotate-90" : ""}`} />
                          </button>
                          {campaignFilterCountryDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-black/15 bg-surface shadow-2xl overflow-hidden">
                              <div className="p-2 border-b border-black/10">
                                <input
                                  type="search"
                                  value={campaignFilterCountrySearch}
                                  onChange={event => setCampaignFilterCountrySearch(event.target.value)}
                                  placeholder="Search country..."
                                  className="w-full px-3 py-2 border border-black/15 rounded-lg text-sm text-foreground outline-none focus:border-accent"
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-56 overflow-y-auto p-1">
                                {countryFilterOptions
                                  .filter(({ dialCode, info }) =>
                                    `${info.name} +${dialCode}`.toLowerCase().includes(campaignFilterCountrySearch.toLowerCase())
                                  )
                                  .map(({ dialCode, info }) => {
                                    const selected = campaignFilterCountryCodes.includes(dialCode);
                                    return (
                                      <button
                                        key={dialCode}
                                        type="button"
                                        onClick={() => setCampaignFilterCountryCodes(prev =>
                                          selected ? prev.filter(code => code !== dialCode) : [...prev, dialCode]
                                        )}
                                        className="w-full px-3 py-2 rounded-lg text-sm text-left text-foreground hover:bg-primary-light flex items-center gap-2"
                                      >
                                        <span className="w-4 text-accent">{selected ? <Check className="w-4 h-4" /> : null}</span>
                                        <span>{info.flag}</span>
                                        <span className="flex-1">{info.name}</span>
                                        <span className="text-muted-foreground">+{dialCode}</span>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                          {/* Keep the existing country-filter styling scoped to this section. */}
                          <style jsx global>{`
                            .campaign-create-page::-webkit-scrollbar {
                              display: none;
                            }
                            .campaign-filter-phone-input .form-control {
                              border: 1px solid var(--color-border-strong) !important;
                              border-radius: 0.75rem !important;
                              height: 2.5rem !important;
                              font-size: 0.875rem !important;
                              padding-left: 48px !important;
                              width: 100% !important;
                              cursor: pointer !important;
                            }
                            .campaign-filter-country-placeholder {
                              position: absolute;
                              top: 0;
                              left: 48px;
                              right: 12px;
                              height: 2.5rem;
                              display: flex;
                              align-items: center;
                              color: var(--color-text);
                              font-size: 0.875rem;
                              pointer-events: none;
                              z-index: 2;
                              overflow: hidden;
                              text-overflow: ellipsis;
                              white-space: nowrap;
                            }
                            .campaign-filter-input-wrapper {
                              position: relative;
                            }
                            .campaign-filter-phone-input .form-control:focus {
                              border-color: var(--color-primary) !important;
                              box-shadow: 0 0 0 2px var(--color-primary-ring) !important;
                              outline: none !important;
                            }
                            .campaign-filter-phone-input {
                              position: relative !important;
                            }
                            .campaign-filter-phone-input .flag-dropdown {
                              border: none !important;
                              background: transparent !important;
                              border-radius: 0.75rem 0 0 0.75rem !important;
                            }
                            .campaign-filter-phone-input .flag-dropdown:hover,
                            .campaign-filter-phone-input .flag-dropdown.open {
                              background: transparent !important;
                            }
                            .campaign-filter-phone-input .flag-dropdown.open .country-list {
                              left: 0 !important;
                              top: calc(100% + 4px) !important;
                              width: calc(100% + 280px) !important;
                              min-width: 280px !important;
                            }
                            .campaign-filter-phone-input .selected-flag {
                              border-radius: 0.75rem 0 0 0.75rem !important;
                              padding: 0 0 0 12px !important;
                            }
                            .campaign-filter-phone-input .selected-flag:hover,
                            .campaign-filter-phone-input .selected-flag:focus {
                              background: transparent !important;
                            }
                            .campaign-filter-phone-input .country-list {
                              border-radius: 0.75rem !important;
                              border: 1px solid var(--color-border-strong) !important;
                              box-shadow: var(--elevation-xl) !important;
                              max-height: 220px !important;
                              z-index: 70 !important;
                            }
                            .campaign-filter-phone-input .country-list .search {
                              padding: 8px !important;
                              background: var(--color-surface-active) !important;
                              border-radius: 0.75rem 0.75rem 0 0 !important;
                              position: sticky !important;
                              top: 0 !important;
                              z-index: 1 !important;
                            }
                            .campaign-filter-phone-input .country-list .search-box {
                              width: 100% !important;
                              padding: 8px 12px !important;
                              border: 1px solid var(--color-border-strong) !important;
                              border-radius: 0.5rem !important;
                              font-size: 0.875rem !important;
                              margin: 0 !important;
                              background: white !important;
                            }
                            .campaign-filter-phone-input .country-list .search-box:focus {
                              outline: none !important;
                              border-color: var(--color-primary) !important;
                            }
                            .campaign-filter-phone-input .country-list .country {
                              padding: 8px 12px !important;
                              font-size: 0.875rem !important;
                            }
                            .campaign-filter-phone-input .country-list .country:hover {
                              background: var(--color-surface-hover) !important;
                            }
                            .campaign-filter-phone-input .country-list .country.highlight {
                              background: var(--color-primary-light) !important;
                            }
                          `}</style>
                          {campaignFilterCountryCodes.length > 0 && (
                            <div className="mt-1.5">
                              <div className="flex flex-wrap gap-1.5">
                                {campaignFilterCountryCodes.map(code => (
                                  <span key={code} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-light text-primary-text border border-primary-soft">
                                    +{code}
                                    <button
                                      type="button"
                                      onClick={() => setCampaignFilterCountryCodes(prev => prev.filter(selectedCode => selectedCode !== code))}
                                      className="hover:text-destructive transition-colors cursor-pointer"
                                      aria-label={`Remove country code +${code}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tag Filter */}
                        <div ref={campaignFilterTagRef}>
                          <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            <TagIcon className="w-3.5 h-3.5 text-accent" />
                            Tag
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => { setCampaignFilterTagDropdownOpen(prev => !prev); setAddContactDropdownOpen(false); setCampaignFilterCountryDropdownOpen(false); }}
                              className="w-full h-10 px-3.5 border border-black/15 rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 bg-surface text-foreground transition shadow-2xs cursor-pointer flex items-center justify-between"
                            >
                              <span className={campaignFilterTagIds.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                                {campaignFilterTagIds.length > 0
                                  ? `${campaignFilterTagIds.length} tag${campaignFilterTagIds.length !== 1 ? "s" : ""} selected`
                                  : "All Tags"}
                              </span>
                              <svg className={`w-4 h-4 text-muted-foreground transition-transform ${campaignFilterTagDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {campaignFilterTagDropdownOpen && (
                                <div className="absolute z-[70] mt-1 w-full bg-surface border border-black/15 rounded-xl shadow-2xl max-h-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                  <div className="p-2 border-b border-black/10" style={{ backgroundColor: "var(--color-surface-active)" }}>
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                      <input
                                        type="text"
                                        value={campaignFilterTagSearch}
                                        onChange={(e) => setCampaignFilterTagSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Search tags..."
                                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-black/15 bg-surface text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/15"
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-52 overflow-y-auto divide-y divide-black/5">
                                    {loadingTags ? (
                                      <div className="flex items-center justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-accent" />
                                      </div>
                                    ) : tags
                                      .filter(t => t.name.toLowerCase().includes(campaignFilterTagSearch.toLowerCase()))
                                      .length === 0 ? (
                                      <div className="px-4 py-4 text-xs text-muted-foreground italic text-center">No tags found</div>
                                    ) : (
                                      tags
                                        .filter(t => t.name.toLowerCase().includes(campaignFilterTagSearch.toLowerCase()))
                                        .map(tag => {
                                          const tagId = String(tag.id);
                                          const isSelected = campaignFilterTagIds.includes(tagId);
                                          return (
                                            <label
                                              key={tag.id}
                                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-primary-light" : "hover:bg-black/2"}`}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                  setCampaignFilterTagIds(prev =>
                                                    prev.includes(tagId)
                                                      ? prev.filter(id => id !== tagId)
                                                      : [...prev, tagId]
                                                  );
                                                }}
                                                className="w-4 h-4 accent-accent cursor-pointer shrink-0"
                                              />
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <TagIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                                                <span className="text-sm font-medium text-foreground truncate">{tag.name}</span>
                                              </div>
                                              {isSelected && <div className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                                            </label>
                                          );
                                        })
                                    )}
                                  </div>
                                </div>
                            )}
                          </div>

                          {/* Selected tag pills */}
                          {campaignFilterTagIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {campaignFilterTagIds.map(tagId => {
                                const tag = tags.find(t => String(t.id) === tagId);
                                return (
                                  <span
                                    key={tagId}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-light text-primary-text border border-primary-soft"
                                  >
                                    {tag?.name || tagId}
                                    <button
                                      type="button"
                                      onClick={() => setCampaignFilterTagIds(prev => prev.filter(id => id !== tagId))}
                                      className="hover:text-destructive transition-colors cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Banner: contacts pre-loaded from import ── */}
                  {fromImport && manualContacts.length > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary-light border border-primary-soft">
                      <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {manualContacts.length} contact{manualContacts.length !== 1 ? 's' : ''} pre-loaded from import
                        </p>
                        {importedListName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            List: <span className="font-medium text-foreground">{importedListName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <>
                      {/* ── BROADCAST CONTACT LIST DROPDOWN (shown only when contacts were selected from Contacts page) ── */}
                      {broadcastContacts.length > 0 && (
                        <div className="space-y-3">
                          <label className="block text-sm font-semibold text-foreground flex items-center gap-2">
                            <Users className="w-4 h-4 text-accent" />
                            Broadcast Contact List
                          </label>

                          {/* Dropdown trigger */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setBroadcastDropdownOpen(prev => !prev)}
                              className="w-full appearance-none px-4 py-2.5 rounded-xl border border-black/15 bg-surface text-foreground font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent cursor-pointer shadow-2xs transition-all flex items-center justify-between"
                            >
                              <span>
                                {selectedBroadcastIds.length === 0
                                  ? "Select contacts from broadcast list..."
                                  : `${selectedBroadcastIds.length} contact${selectedBroadcastIds.length !== 1 ? "s" : ""} selected`}
                              </span>
                              <svg
                                className={`w-4 h-4 text-muted-foreground transition-transform ${broadcastDropdownOpen ? "rotate-180" : ""}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {broadcastDropdownOpen && (
                              <>
                                {/* Click outside overlay */}
                                <div className="fixed inset-0 z-30" onClick={() => setBroadcastDropdownOpen(false)} />
                                <div className="absolute z-40 mt-2 w-full rounded-xl shadow-xl border border-border bg-surface overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                  {/* Search bar */}
                                  <div className="p-2 border-b border-border">
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                      <input
                                        type="text"
                                        value={broadcastSearch}
                                        onChange={e => setBroadcastSearch(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        placeholder="Search contacts..."
                                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-black/15 bg-surface text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/15"
                                      />
                                    </div>
                                  </div>

                                  {/* Select All / Deselect All */}
                                  <div className="px-3 py-2 border-b border-border flex items-center justify-between" style={{ backgroundColor: "var(--color-surface-active)" }}>
                                    <span className="text-xs text-foreground font-semibold">
                                      {selectedBroadcastIds.length} of {broadcastContacts.length} selected
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setSelectedBroadcastIds(broadcastContacts.map(c => c.id)); }}
                                        className="text-xs text-primary-text hover:underline font-bold"
                                      >Select All</button>
                                      <span className="text-muted-foreground">|</span>
                                      <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setSelectedBroadcastIds([]); }}
                                        className="text-xs text-muted-foreground hover:underline font-medium"
                                      >Deselect All</button>
                                    </div>
                                  </div>

                                  {/* Contact list */}
                                  <div className="max-h-56 overflow-y-auto divide-y divide-border">
                                    {broadcastContacts
                                      .filter(c =>
                                        c.name.toLowerCase().includes(broadcastSearch.toLowerCase()) ||
                                        c.phone.includes(broadcastSearch)
                                      )
                                      .map(contact => {
                                        const isSelected = selectedBroadcastIds.includes(contact.id);
                                        return (
                                          <label
                                            key={contact.id}
                                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected
                                                ? "bg-primary-light"
                                                : "hover:bg-black/2"
                                              }`}
                                            onClick={e => e.stopPropagation()}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {
                                                setSelectedBroadcastIds(prev =>
                                                  prev.includes(contact.id)
                                                    ? prev.filter(id => id !== contact.id)
                                                    : [...prev, contact.id]
                                                );
                                              }}
                                              className="w-4 h-4 accent-accent cursor-pointer"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                                              <p className="text-xs text-muted-foreground">{contact.phone}</p>
                                            </div>
                                            {isSelected && (
                                              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                                            )}
                                          </label>
                                        );
                                      })
                                    }
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                        </div>
                      )}

                      {/* ─── ADD CONTACT SECTION ─── */}
                      <div className="space-y-3">
                        {/* Section Label */}
                        <label className="block text-sm font-semibold text-foreground flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-accent" />
                          Add Contacts
                        </label>

                        {/* Add Contact Trigger Button */}
                        <div ref={addContactDropdownRef} className="relative">
                          <button
                            type="button"
                            onClick={() => { setAddContactDropdownOpen(prev => !prev); setCampaignFilterCountryDropdownOpen(false); setCampaignFilterTagDropdownOpen(false); }}
                            className="w-full appearance-none px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-accent bg-primary-light hover:bg-primary-light/80 text-primary-text font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-accent/15 cursor-pointer shadow-2xs transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-5 h-5 text-accent" />
                            Add Contact
                            {(() => {
                              const totalAdded = manualContacts.length + form.audience.contactLists.length + selectedDirectContactIds.length;
                              return totalAdded > 0 ? (
                                <span className="text-xs bg-accent text-primary-foreground px-2 py-0.5 rounded-full ml-1 font-bold">
                                  {totalAdded}
                                </span>
                              ) : null;
                            })()}
                          </button>

                          {/* Dropdown Options */}
                          {addContactDropdownOpen && (
                            <>
                              <div className="absolute z-40 mt-2 w-full rounded-xl shadow-xl border border-border bg-surface overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                {/* Option 1: Select from Contact List */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddContactMode("contactlist");
                                    setAddContactDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary-light transition-colors text-left border-b border-border cursor-pointer"
                                >
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-xs shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
                                    <Users className="w-5 h-5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-foreground">Select from Contact List</p>
                                    <p className="text-xs text-muted-foreground">Choose from your saved contact lists or contacts</p>
                                  </div>
                                  {(form.audience.contactLists.length + selectedDirectContactIds.length) > 0 && (
                                    <span className="text-xs bg-accent text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
                                      {form.audience.contactLists.length + selectedDirectContactIds.length}
                                    </span>
                                  )}
                                </button>

                                {/* Option 2: Input Manually */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddContactMode("manual");
                                    setAddContactDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary-light transition-colors text-left border-b border-border cursor-pointer"
                                >
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-xs shrink-0" style={{ backgroundColor: "var(--color-primary-hover)" }}>
                                    <Keyboard className="w-5 h-5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-foreground">Input Manually</p>
                                    <p className="text-xs text-muted-foreground">Type name & phone number one by one</p>
                                  </div>
                                </button>

                                {/* Option 3: Import from Excel */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddContactDropdownOpen(false);
                                    excelInputRef.current?.click();
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary-light transition-colors text-left border-b border-border cursor-pointer"
                                >
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-xs shrink-0" style={{ backgroundColor: "var(--neutral-700)" }}>
                                    <FileSpreadsheet className="w-5 h-5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-foreground">Import from Excel</p>
                                    <p className="text-xs text-muted-foreground">Upload .xlsx or .csv file with contacts</p>
                                  </div>
                                </button>

                                {/* Option 4: Paste Numbers */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddContactMode("paste");
                                    setAddContactDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary-light transition-colors text-left cursor-pointer"
                                >
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-xs shrink-0" style={{ backgroundColor: "var(--color-warning)" }}>
                                    <Clipboard className="w-5 h-5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-foreground">Paste Numbers</p>
                                    <p className="text-xs text-muted-foreground">Paste multiple phone numbers at once</p>
                                  </div>
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Hidden file input for Excel import */}
                        <input
                          ref={excelInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setImportingExcel(true);
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              try {
                                const data = evt.target?.result;
                                const workbook = XLSX.read(data, { type: "binary" });
                                const sheetName = workbook.SheetNames[0];
                                const sheet = workbook.Sheets[sheetName];
                                const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

                                const imported: { name: string; phone: string }[] = [];
                                rows.forEach((row) => {
                                  // Try to find phone column (flexible matching)
                                  const phoneKey = Object.keys(row).find(k =>
                                    /phone|mobile|number|contact|whatsapp|tel/i.test(k)
                                  ) || Object.keys(row)[1] || Object.keys(row)[0];
                                  const nameKey = Object.keys(row).find(k =>
                                    /name|contact.?name|first.?name|full.?name/i.test(k)
                                  ) || Object.keys(row)[0];

                                  const phone = String(row[phoneKey] || "").replace(/[^\d+]/g, "").trim();
                                  const name = String(row[nameKey] || "").trim();

                                  if (phone && phone.length >= 7) {
                                    // Skip if this phone is already added
                                    if (!manualContacts.some(c => c.phone === phone) && !imported.some(c => c.phone === phone)) {
                                      imported.push({ name: name || "Imported Contact", phone });
                                    }
                                  }
                                });

                                if (imported.length > 0) {
                                  setManualContacts(prev => [...prev, ...imported]);
                                  toast.success(`✅ ${imported.length} contact${imported.length !== 1 ? "s" : ""} imported successfully!`);
                                } else {
                                  toast.error("No valid phone numbers found in the file. Make sure there's a column with phone/mobile/number.");
                                }
                              } catch (err) {
                                console.error("Excel import error:", err);
                                toast.error("Failed to parse the file. Please check the format.");
                              } finally {
                                setImportingExcel(false);
                                // Reset the input so the same file can be re-uploaded
                                e.target.value = "";
                              }
                            };
                            reader.readAsBinaryString(file);
                          }}
                        />

                        {/* Loading state for Excel import */}
                        {importingExcel && (
                          <div className="flex items-center gap-2 p-3 bg-primary-light border border-primary-soft rounded-xl">
                            <Loader2 className="w-4 h-4 animate-spin text-accent" />
                            <span className="text-sm font-medium text-primary-text">Importing contacts from file...</span>
                          </div>
                        )}

                        {/* ── Select from Contact List Panel ── */}
                        {addContactMode === "contactlist" && (
                          (() => {
                            const toggleList = (id: string) => {
                              updateField("audience", {
                                ...form.audience,
                                contactLists: form.audience.contactLists.includes(id)
                                  ? form.audience.contactLists.filter((x) => x !== id)
                                  : [...form.audience.contactLists, id],
                              });
                            };

                            const toggleDirectContact = (id: string) => {
                              setSelectedDirectContactIds(prev =>
                                prev.includes(id) ? prev.filter(x => x !== id) : mergeContactSelection(prev, [id])
                              );
                            };

                            const filteredAllContacts = allContactsList.filter(c => {
                              const matchesSearch =
                                (c.name || "").toLowerCase().includes(contactPanelSearch.toLowerCase()) ||
                                (c.phone_number || "").includes(contactPanelSearch);
                              const matchesCountryCode =
                                contactCountryCodeFilter === "all" ||
                                extractCountryCode(c.phone_number || "") === contactCountryCodeFilter;
                              return matchesSearch && matchesCountryCode;
                            });

                            // Derive available country codes from the full contacts list (ignoring search filter)
                            const availableCountryCodes = getUniqueCountryCodes(
                              allContactsList.map(c => c.phone_number || "").filter(Boolean)
                            );

                            const filteredLists = contactLists.filter(l =>
                              (l.name || "").toLowerCase().includes(contactPanelSearch.toLowerCase())
                            );
                            const someVisibleContactsSelected = filteredAllContacts.some(contact => selectedDirectContactIds.includes(contact.id));
                            const allVisibleContactsSelected = filteredAllContacts.length > 0 && filteredAllContacts.every(contact => selectedDirectContactIds.includes(contact.id));

                            return (
                              <div className="rounded-xl border border-black/15 bg-surface overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between" style={{ backgroundColor: "var(--color-surface-active)" }}>
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
                                      <Users className="w-4 h-4 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                                    </div>
                                    <span className="text-sm font-bold text-foreground">Select from Contact List</span>
                                    {(form.audience.contactLists.length + selectedDirectContactIds.length) > 0 && (
                                      <span className="text-xs bg-accent text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                        {form.audience.contactLists.length + selectedDirectContactIds.length} selected
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setAddContactMode("none")}
                                    className="p-1 rounded-lg hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* ── Sub-section 1: My Contact List ── */}
                                <div className="border-b border-black/10">
                                  <button
                                    type="button"
                                    onClick={() => setMyListOpen(prev => !prev)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-primary-light/40 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                                        <Users className="w-4 h-4 text-accent" />
                                      </div>
                                      <span className="text-sm font-semibold text-foreground">
                                        My Contact List
                                      </span>
                                      {form.audience.contactLists.length > 0 && (
                                        <span className="text-xs bg-accent text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                          {form.audience.contactLists.length}
                                        </span>
                                      )}
                                    </div>
                                    <svg
                                      className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${myListOpen ? "rotate-180" : ""}`}
                                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  {myListOpen && (
                                    <>
                                      {filteredLists.length > 0 && (
                                        <label className="flex items-center gap-3 px-4 py-2.5 border-t border-b border-black/10 cursor-pointer transition-colors hover:bg-black/5" style={{ backgroundColor: "var(--color-surface-active)" }}>
                                          <input
                                            type="checkbox"
                                            checked={filteredLists.length > 0 && filteredLists.every(list => form.audience.contactLists.includes(list.id))}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              if (checked) {
                                                const newIds = new Set([...form.audience.contactLists, ...filteredLists.map(l => l.id)]);
                                                updateField("audience", { ...form.audience, contactLists: Array.from(newIds) });
                                              } else {
                                                const newIds = form.audience.contactLists.filter(id => !filteredLists.some(l => l.id === id));
                                                updateField("audience", { ...form.audience, contactLists: newIds });
                                              }
                                            }}
                                            className="w-4 h-4 accent-accent cursor-pointer shrink-0"
                                          />
                                          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Select All Lists</span>
                                        </label>
                                      )}
                                      <div className="max-h-48 overflow-y-auto divide-y divide-black/5 bg-surface">
                                        {!recipientPhoneNumberId ? (
                                        <p className="px-4 py-3 text-xs text-muted-foreground">Select a sender phone number to load contact lists.</p>
                                      ) : loadingContactLists ? (
                                        <p className="px-4 py-3 text-xs text-muted-foreground">Loading contact lists...</p>
                                      ) : contactListsLoadError ? (
                                        <p role="alert" className="px-4 py-3 text-xs text-destructive">{contactListsLoadError}</p>
                                      ) : filteredLists.length === 0 ? (
                                        <p className="px-4 py-3 text-xs text-muted-foreground italic">No lists found</p>
                                      ) : filteredLists.map(list => {
                                        const isChecked = form.audience.contactLists.includes(list.id);
                                        return (
                                          <label
                                            key={list.id}
                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isChecked ? "bg-primary-light/80" : "hover:bg-black/2"
                                              }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleList(list.id)}
                                              className="w-4 h-4 accent-accent cursor-pointer shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-foreground truncate">{list.name}</p>
                                              <p className="text-xs font-medium text-muted-foreground mt-0.5">{list.total_contacts ?? 0} contacts</p>
                                            </div>
                                            {isChecked && <div className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                                          </label>
                                        );
                                      })}
                                      </div>
                                      {form.audience.contactLists.map(id => (
                                        <ContactListRecipientPreview key={id} listId={id}
                                          listName={contactLists.find(list => list.id === id)?.name || id}
                                          phoneNumberId={recipientPhoneNumberId} />
                                      ))}
                                    </>
                                  )}
                                </div>

                                {/* ── Sub-section 2: Contacts ── */}
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setAllContactsOpen(prev => !prev)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-primary-light/40 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-accent" />
                                      </div>
                                      <span className="text-sm font-bold text-foreground">
                                        Contacts
                                      </span>
                                      {selectedDirectContactIds.length > 0 && (
                                        <span className="text-xs bg-accent text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                          {selectedDirectContactIds.length}
                                        </span>
                                      )}
                                    </div>
                                    <svg
                                      className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${allContactsOpen ? "rotate-180" : ""}`}
                                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  {allContactsOpen && (
                                    <>
                                      <div id="campaign-contact-selection" className="px-4 py-3 border-t border-border text-xs text-muted-foreground" aria-live="polite">
                                        <p>Browse and select contacts linked to your selected sender.</p>
                                        <p className="mt-1 font-semibold">{selectedDirectContactIds.length} contacts selected{!loadingAllContacts && !contactsLoadError && recipientPhoneNumberId ? ` · ${allContactsList.length} available` : ""}</p>
                                      </div>
                                      {!loadingAllContacts && filteredAllContacts.length > 0 && (
                                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-b border-black/10" style={{ backgroundColor: "var(--color-surface-active)" }}>
                                          <label className="flex items-center gap-3 cursor-pointer transition-colors hover:bg-black/5">
                                            <input
                                              type="checkbox"
                                              checked={allVisibleContactsSelected}
                                              ref={input => {
                                                if (input) input.indeterminate = someVisibleContactsSelected && !allVisibleContactsSelected;
                                              }}
                                              onChange={(e) => {
                                                const checked = e.target.checked;
                                                if (checked) {
                                                  setSelectedDirectContactIds(prev => mergeContactSelection(prev, filteredAllContacts.map(c => c.id)));
                                                } else {
                                                  const newIds = selectedDirectContactIds.filter(id => !filteredAllContacts.some(c => c.id === id));
                                                  setSelectedDirectContactIds(newIds);
                                                }
                                              }}
                                              className="w-4 h-4 accent-accent cursor-pointer shrink-0"
                                            />
                                            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Select All Contacts</span>
                                          </label>

                                          
                                        </div>
                                      )}
                                      <div className="max-h-56 overflow-y-auto divide-y divide-black/5 bg-surface">
                                        {loadingAllContacts ? (
                                        <div className="flex items-center justify-center py-6">
                                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                                        </div>
                                      ) : filteredAllContacts.length === 0 ? (
                                        <p className="px-4 py-3 text-xs text-muted-foreground italic">{contactsLoadError || (!recipientPhoneNumberId ? "Select a sender phone number to load contacts." : "No eligible contacts found.")}</p>
                                      ) : filteredAllContacts.map(contact => {
                                        const isChecked = selectedDirectContactIds.includes(contact.id);
                                        return (
                                          <label
                                            key={contact.id}
                                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isChecked ? "bg-primary-light/80" : "hover:bg-black/2"
                                              }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              aria-describedby="campaign-contact-selection"
                                              onChange={() => toggleDirectContact(contact.id)}
                                              className="w-4 h-4 accent-accent cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-bold text-foreground truncate">{contact.name}</p>
                                              <p className="text-xs font-medium text-muted-foreground mt-0.5">{contact.phone_number}</p>
                                            </div>
                                            {isChecked && <div className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                                          </label>
                                        );
                                      })}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* ── Manual Input Form ── */}
                        {addContactMode === "manual" && (
                          <div className="rounded-xl border border-border bg-surface shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ backgroundColor: "var(--color-surface-active)" }}>
                              <div className="flex items-center gap-2">
                                <Keyboard className="w-4 h-4 text-accent" />
                                <span className="text-sm font-bold text-foreground">Input Manually</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setAddContactMode("none"); setManualName(""); setManualPhone(""); }}
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="p-4 space-y-3" style={{ backgroundColor: "var(--color-surface-muted)" }}>
                              <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                  <label className="block text-xs font-semibold text-foreground mb-1">Name (optional)</label>
                                  <input
                                    type="text"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="w-full w-full text-sm text-foreground bg-input border border-border rounded-md h-[2.375rem] px-3 text-sm"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-xs font-semibold text-foreground mb-1">Phone Number <span className="text-destructive">*</span></label>
                                  <PhoneInput
                                    country={"in"}
                                    value={manualPhone}
                                    onChange={(value) => setManualPhone(value)}
                                    enableSearch={true}
                                    disableSearchIcon={true}
                                    searchPlaceholder="Search country..."
                                    inputStyle={{
                                      width: "100%",
                                      height: "40px",
                                      fontSize: "14px",
                                      borderRadius: "8px",
                                      border: "1px solid var(--color-border-strong)",
                                      paddingLeft: "48px",
                                      backgroundColor: "white",
                                      color: "var(--color-text)",
                                    }}
                                    buttonStyle={{
                                      borderRadius: "8px 0 0 8px",
                                      border: "1px solid var(--color-border-strong)",
                                      borderRight: "none",
                                      backgroundColor: "var(--color-surface-muted)",
                                    }}
                                    dropdownStyle={{
                                      borderRadius: "12px",
                                      boxShadow: "var(--elevation-xl)",
                                      border: "1px solid var(--color-border-strong)",
                                      zIndex: 9999,
                                      backgroundColor: "white",
                                    }}
                                    searchStyle={{
                                      width: "95%",
                                      margin: "8px auto",
                                      borderRadius: "8px",
                                      border: "1px solid var(--color-border-strong)",
                                      padding: "8px 12px",
                                      fontSize: "13px",
                                    }}
                                    containerStyle={{
                                      width: "100%",
                                    }}
                                    inputProps={{
                                      onKeyDown: (e: React.KeyboardEvent) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddManualContact();
                                        }
                                      },
                                    }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddManualContact}
                                  className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground border border-primary hover:bg-primary-hover shadow-xs h-10 px-4 flex items-center gap-1.5 shrink-0"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground">Select country code, type the number, then press Enter or click Add.</p>
                            </div>
                          </div>
                        )}

                        {/* ── Paste Numbers Form ── */}
                        {addContactMode === "paste" && (
                          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ backgroundColor: "var(--color-surface-active)" }}>
                              <div className="flex items-center gap-2">
                                <Clipboard className="w-4 h-4 text-accent" />
                                <label htmlFor="campaign-paste-phone-numbers" className="text-sm font-bold text-foreground">Paste Phone Numbers</label>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setAddContactMode("none"); setPasteText(""); }}
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="p-4 space-y-3" style={{ backgroundColor: "var(--color-surface-muted)" }}>
                              <textarea
                                id="campaign-paste-phone-numbers"
                                value={pasteText}
                                onChange={e => setPasteText(e.target.value)}
                                placeholder={"Paste phone numbers here (one per line)\n\ne.g.\n+919876543210\n+918765432109\n+917654321098"}
                                rows={8}
                                spellCheck={false}
                                aria-describedby="campaign-paste-phone-numbers-help"
                                className="block w-full min-w-0 h-48 sm:h-56 min-h-[180px] max-h-[60dvh] px-3 py-3 text-base sm:text-sm leading-6 text-foreground bg-input border border-border rounded-md resize-y overflow-y-auto font-mono focus:outline-none focus:ring-2 focus:ring-accent/15"
                              />
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <p id="campaign-paste-phone-numbers-help" className="min-w-0 text-xs text-muted-foreground">One phone number per line. Separate with new lines, commas, or spaces.</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const numbers = pasteText
                                      .split(/[\n,;\s]+/)
                                      .map(n => n.replace(/[^\d+]/g, "").trim())
                                      .filter(n => n.length >= 7);
                                    const unique = [...new Set(numbers)];
                                    const newContacts = unique
                                      .filter(phone => !manualContacts.some(c => c.phone === phone))
                                      .map(phone => ({ name: "Pasted Contact", phone }));
                                    if (newContacts.length > 0) {
                                      setManualContacts(prev => [...prev, ...newContacts]);
                                      toast.success(`✅ ${newContacts.length} number${newContacts.length !== 1 ? "s" : ""} added!`);
                                      setPasteText("");
                                      setAddContactMode("none");
                                    } else {
                                      toast.error("No valid new phone numbers found.");
                                    }
                                  }}
                                  className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground border border-primary hover:bg-primary-hover shadow-xs px-4 py-2"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Add Numbers
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Manually Added Contacts List ── */}
                        {manualContacts.length > 0 && (
                          <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
                            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between" style={{ backgroundColor: "var(--color-surface-active)" }}>
                              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Phone className="w-4 h-4 text-accent" />
                                Added Contacts
                                <span className="text-xs bg-accent text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">{manualContacts.length}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualContacts([]);
                                  toast.success("All manually added contacts cleared.");
                                }}
                                className="text-xs text-destructive hover:underline font-semibold transition-colors cursor-pointer"
                              >
                                Clear All
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-border">
                              {manualContacts.map((contact, idx) => (
                                <div
                                  key={`manual-${idx}-${contact.phone}`}
                                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/2 transition-colors group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-accent" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManualContacts(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                    
                    </>
                </div>
              )}

              {/* Step 4: Schedule */}
              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-foreground font-display mb-4">
                    Schedule Campaign
                  </h2>

                  {/* Scheduling Mode Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => updateField("schedulingMode", "now")}
                      className={`p-4 rounded-xl border text-sm font-bold transition-all cursor-pointer ${form.schedulingMode === "now"
 ? "bg-primary-light border-primary text-primary-text ring-1 ring-accent"
 : "border-border bg-card text-foreground hover:bg-muted"
 }`}
                    >
                      ⚡ Send Immediately
                    </button>

                    <button
                      type="button"
                      onClick={() => updateField("schedulingMode", "later")}
                      className={`p-4 rounded-xl border text-sm font-bold transition-all cursor-pointer ${form.schedulingMode === "later"
 ? "bg-primary-light border-primary text-primary-text ring-1 ring-accent"
 : "border-border bg-card text-foreground hover:bg-muted"
 }`}
                    >
                      📅 Schedule for Later
                    </button>
                  </div>

                  {/* If Later → Show Date & Time */}
                  {form.schedulingMode === "later" && (
                    <>
                      {scheduleError && (
                        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-xl flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                          <div>
                            <p className="text-sm font-semibold">
                              {scheduleError}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-foreground mb-2">
                            Start Date <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="date"
                            value={form.startDate}
                            onChange={(e) => updateField("startDate", e.target.value)}
                            className="w-full w-full text-sm text-foreground bg-input border border-border rounded-md h-[2.375rem] px-3 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-foreground mb-2">
                            Start Time <span className="text-destructive">*</span>
                          </label>
                          {/* Manual HH:MM Input + AM/PM Dropdown */}
                          {(() => {
                            const parts = (form.startTime || ":").split(":");
                            const rawH24 = parts[0] ?? "";
                            const rawM = parts[1] ?? "";
                            const period = form.startTimePeriod || "AM";

                            let displayH = "";
                            if (rawH24 !== "") {
                              const h24 = parseInt(rawH24, 10);
                              if (!isNaN(h24)) {
                                const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                                displayH = String(h12);
                              }
                            }
                            const displayM = rawM;

                            const updateTime = (h12Str: string, mStr: string, p: "AM" | "PM", isBlur = false) => {
                              if (h12Str === "" && mStr === "") {
                                updateField("startTime", "");
                                updateField("startTimePeriod", p);
                                return;
                              }

                              let processH = h12Str;
                              if (isBlur && processH === "0") {
                                processH = "12";
                              }

                              let newH = processH;
                              if (processH !== "") {
                                const h12 = parseInt(processH, 10) || 12;
                                const h24new = p === "AM" ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
                                newH = String(h24new).padStart(2, "0");
                              }

                              let newM = mStr;
                              if (isBlur && newM !== "") {
                                newM = newM.padStart(2, "0");
                              }

                              updateField("startTime", `${newH}:${newM}:00`);
                              updateField("startTimePeriod", p);
                            };

                            const inputCls = "bg-surface border border-black/15 focus:border-accent focus:ring-2 focus:ring-accent/15 rounded-xl px-2 text-center text-base font-bold text-foreground transition-all outline-none w-[68px] h-[44px] shadow-2xs";

                            const selectCls = "appearance-none bg-surface border border-black/15 focus:border-accent focus:ring-2 focus:ring-accent/15 rounded-xl pl-4 pr-10 text-sm font-bold text-foreground cursor-pointer transition-all outline-none w-full h-[44px] shadow-2xs";

                            return (
                              <div className="flex items-center gap-2 max-w-[320px]">
                                {/* Hour Input */}
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  placeholder="00"
                                  value={displayH}
                                  onChange={e => {
                                    let val = e.target.value.replace(/\D/g, "");
                                    if (val !== "" && parseInt(val, 10) > 12) {
                                      val = "12";
                                    }
                                    updateTime(val, displayM, period as "AM" | "PM", false);
                                  }}
                                  onBlur={() => updateTime(displayH, displayM, period as "AM" | "PM", true)}
                                  className={inputCls}
                                />

                                <span className="text-xl font-bold text-foreground pb-1">:</span>

                                {/* Minute Input */}
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  placeholder="00"
                                  value={displayM}
                                  onChange={e => {
                                    let val = e.target.value.replace(/\D/g, "");
                                    if (val !== "" && parseInt(val, 10) > 59) {
                                      val = "59";
                                    }
                                    updateTime(displayH, val, period as "AM" | "PM", false);
                                  }}
                                  onBlur={() => updateTime(displayH, displayM, period as "AM" | "PM", true)}
                                  className={inputCls}
                                />

                                {/* AM/PM Dropdown */}
                                <div className="relative w-[100px] ml-1">
                                  <select
                                    value={period}
                                    onChange={e => updateTime(displayH, displayM, e.target.value as "AM" | "PM", false)}
                                    className={selectCls}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </>
                  )}

                  {/* If Now → Show Info */}
                  {form.schedulingMode === "now" && (
                    <div className="p-4 bg-primary-light border border-primary-soft rounded-xl">
                      <p className="text-xs font-semibold text-primary-text">
                        🚀 This campaign will run immediately after clicking &quot;Create Campaign&quot;.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Review */}
              {step === 5 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-foreground font-display mb-4">Review & Launch</h2>

                  <div className="bg-card rounded-2xl p-6 space-y-4 border border-border w-full lg:max-w-[40vw] max-h-[80vh] overflow-y-auto mx-auto shadow-xs">
                    {/* Campaign Details */}
                    <div className="space-y-1">
                      <ReviewItem label="Campaign Name" value={form.name || "N/A"} />
                      <ReviewItem label="Type" value={form.type} />
                      <ReviewItem label="Message Template" value={form.messageTemplate || "N/A"} />
                      {form.templateCategory && (
                        <div className="flex justify-between items-center py-2.5 border-b border-border text-xs">
                          <span className="font-semibold text-muted-foreground">Template Category:</span>
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
 form.templateCategory === "MARKETING"
 ? "bg-warning-bg border-warning-border text-warning"
 : form.templateCategory === "UTILITY"
 ? "bg-info-bg border-info-border text-info"
 : form.templateCategory === "AUTHENTICATION"
 ? "bg-primary-lighter border-primary-soft text-primary-text"
 : "bg-primary-light border-primary-soft text-primary-text"
 }`}
                          >
                            {form.templateCategory}
                          </span>
                        </div>
                      )}
                      <ReviewItem
                        label="Sender Phones"
                        value={
                          form.selectedPhoneNumbers?.length > 0
                            ? phoneNumbers.filter(p => form.selectedPhoneNumbers.includes(p.id)).map(p => p.display_phone_number || p.verified_name).join(", ")
                            : "None"
                        }
                      />
                      {/* Selected Contacts — vertical scrollable list */}
                      {(() => {
                        const directPhones = selectedDirectContactIds
                          .map(id => allContactsList.find(c => c.id === id)?.phone_number || null)
                          .filter(Boolean) as string[];
                        const broadcastPhones = selectedBroadcastIds
                          .map(id => broadcastContacts.find(c => c.id === id)?.phone || null)
                          .filter(Boolean) as string[];
                        const manualPhones = manualContacts.map(c => c.phone).filter(Boolean);
                        // Show phone values exactly as selected, including country codes.
                        const allPhones = [...new Set(
                          [...directPhones, ...broadcastPhones, ...manualPhones]
                            .filter(Boolean)
                        )];

                        return (
                          <div className="py-2.5 border-b border-border text-xs">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-semibold text-muted-foreground">Selected Contacts:</span>
                              <span className="text-foreground font-bold">
                                {allPhones.length > 0 ? `${allPhones.length} number${allPhones.length !== 1 ? "s" : ""}` : "None"}
                              </span>
                            </div>
                            {allPhones.length > 0 && (
                              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/40 divide-y divide-border">
                                {allPhones.map((phone, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 px-3 py-1.5"
                                  >
                                    <span className="w-5 h-5 rounded-full bg-primary-light border border-primary-soft flex items-center justify-center text-[10px] font-bold text-primary-text shrink-0">
                                      {i + 1}
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-foreground">
                                      {phone}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <ReviewItem
                        label="Contact Lists"
                        value={
                          form.audience.contactLists.length > 0
                            ? contactLists.filter(l => form.audience.contactLists.includes(l.id)).map(l => l.name).join(", ")
                            : "None"
                        }
                      />
                      {form.audience.contactLists.map(id => (
                        <ContactListRecipientPreview key={id} listId={id}
                          listName={contactLists.find(list => list.id === id)?.name || id}
                          phoneNumberId={recipientPhoneNumberId} />
                      ))}
                      <ReviewItem
                        label="Tags"
                        value={
                          form.audience.tags.length > 0
                            ? form.audience.tags.map(id => tags.find(t => String(t.id) === id)?.name || id).join(", ")
                            : "None"
                        }
                      />
                      <ReviewItem
                        label="Schedule"
                        value={
                          form.schedulingMode === "now"
                            ? "Send Immediately"
                            : `${form.startDate} at ${formatTimeAmPm(form.startTime)}`
                        }
                      />
                    </div>
                  </div>

                  {createCampaignMutation.isError && (
                    <div role="alert" className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-xl flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <p className="text-sm font-semibold">
                        {getCampaignErrorMessage(createCampaignMutation.error)}
                      </p>
                    </div>
                  )}
                  {campaignRedirectError && (
                    <div role="alert" className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-xl space-y-2">
                      <p className="text-sm font-semibold">{campaignRedirectError}</p>
                      <button type="button" className="text-sm underline" onClick={() => router.push("/user/campaigns")}>Open Campaigns</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {step >= 2 && (
              <div className="mt-4 space-y-2 text-sm" aria-live="polite">
                {mappingValidation.filter(result => result.message).map(result => (
                  <p key={result.key} role={result.blocking ? "alert" : "status"}
                    className={result.blocking ? "text-error" : "text-muted-foreground"}>{result.message}</p>
                ))}
              </div>
            )}
            {/* Navigation Buttons */}
            {step === 3 && audienceValidationError && <p role="alert" className="mt-4 text-sm text-destructive">{audienceValidationError}</p>}
            <div className="campaign-nav pt-6 mt-6 border-t border-border flex justify-between items-center">
              <button
                type="button"
                onClick={handlePrev}
                disabled={step <= 1 || createCampaignMutation?.isPending || checkingAudience}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none h-[2.375rem] px-4 bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={createCampaignMutation?.isPending || checkingAudience}
                  className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none h-[2.375rem] px-4 bg-primary text-primary-foreground border border-primary hover:bg-primary-hover shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>{checkingAudience ? "Checking audience..." : "Next"}</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={createCampaignMutation?.isPending || createCampaignMutation.isSuccess || variablesInvalid || Boolean(campaignRedirectError)}
                  className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none h-[2.375rem] px-4 bg-primary text-primary-foreground border border-primary hover:bg-primary-hover shadow-xs flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {createCampaignMutation?.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>{form.schedulingMode === "now" ? "Send Campaign" : "Schedule Campaign"}</span>
                  )}
                </button>
              )}
            </div>
          </div>
          {/* End of Main Form Container */}
        </div>

        {/* Live Preview Panel (Sticky on right) */}
        {step >= 2 && selectedTemplateObj && (
          <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-6 mb-8 lg:mb-0">
            <LivePreview
              templateObj={selectedTemplateObj}
              templateFields={templateFields}
              headerPreviewUrl={headerPreviewUrl}
              headerMediaUrl={form.headerMediaUrl}
              audience={form.audience}
              contactLists={contactLists || []}
              schedule={{
                mode: form.schedulingMode,
                startDate: form.startDate,
                startTime: form.startTime
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const ReviewItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border text-xs">
    <span className="font-semibold text-muted-foreground">{label}:</span>
    <span className="text-foreground font-bold text-right truncate max-w-[260px]">{value}</span>
  </div>
);



/** formatTimeAmPm: converts "14:30:00" → "2:30 PM" (for UI display) */
function formatTimeAmPm(timeStr?: string): string {
  if (!timeStr) return "12:00 AM";
  const [hhStr, mmStr] = timeStr.split(":");
  if (!hhStr || !mmStr) return timeStr;
  const h24 = parseInt(hhStr, 10);
  const mm = mmStr.padStart(2, "0");
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${mm} ${period}`;
}

// ── LIVE PREVIEW COMPONENT ──
const LivePreview = ({
  templateObj,
  templateFields,
  headerPreviewUrl,
  headerMediaUrl,
  audience,
  contactLists,
  schedule,
}: {
  templateObj: any,
  templateFields: TemplateField[],
  headerPreviewUrl: string,
  headerMediaUrl: string,
  audience: { contacts: number[], contactLists: (string | number)[], tags: string[] },
  contactLists: { id: string | number, name: string }[],
  schedule: { mode: string, startDate: string, startTime: string }
}) => {
  const bodyComponent = templateObj?.components?.find((c: any) => c.type === "BODY");
  const bodyText: string = bodyComponent?.text || "";
  const previewBody = bodyText.split(/(\{\{\s*[^{}]+\s*\}\})/g).map((part, index) => {
    if (index % 2 === 0) return part;
    const field = templateFields.find(field => field.key === part.slice(2, -2).trim());
    if (!field) return part;
    const previewValue = field.source === "contact" ? (field.fallbackValue || `[${field.contactField || "Select column"}]`) : field.value;
    return previewValue ? <strong key={index} className="font-bold">{previewValue}</strong> : part;
  });

  const headerComponent = templateObj?.components?.find((c: any) => c.type === "HEADER");
  const footerComponent = templateObj?.components?.find((c: any) => c.type === "FOOTER");
  const buttonsComponent = templateObj?.components?.find((c: any) => c.type === "BUTTONS");

  const displayImageUrl = headerPreviewUrl || (headerComponent?.format === "IMAGE" && headerMediaUrl.startsWith("http") ? headerMediaUrl : "");

  return (
    <div className="w-full bg-surface rounded-2xl shadow-xl border border-black/15 relative overflow-hidden flex flex-col h-auto min-h-[520px] font-sans">
      {/* Editorial Card Header */}
      <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between z-10 shrink-0" style={{ backgroundColor: "var(--color-surface-active)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
            <User className="w-4 h-4 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
          </div>
          <span className="text-sm font-bold text-foreground">Live Preview</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary-light text-primary-text border border-primary-soft">
          WhatsApp
        </span>
      </div>

      {/* Chat canvas */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 " style={{ backgroundColor: "var(--color-surface-muted)" }}>
        {/* The message bubble */}
        <div className="bg-surface border border-black/10 shadow-xs rounded-2xl rounded-tl-sm p-4 relative w-[94%] text-sm font-medium leading-relaxed text-foreground">
          {/* Header Image if any */}
          {(displayImageUrl || headerComponent?.format === "IMAGE") && (
            <div className="mb-3 rounded-xl overflow-hidden bg-surface-active border border-black/5 flex items-center justify-center">
              {displayImageUrl ? (
                <img src={displayImageUrl} alt="Preview" className="w-full h-auto max-h-48 object-cover" />
              ) : (
                <div className="w-full h-32 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Header Text if any */}
          {headerComponent?.format === "TEXT" && (
            <div className="font-bold text-xs uppercase tracking-wider text-foreground mb-1.5">{headerComponent.text}</div>
          )}

          {/* Body */}
          <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {bodyText ? previewBody : <span className="text-muted-foreground italic">Select a template to preview message...</span>}
          </div>

          {/* Footer */}
          {footerComponent?.text && (
            <div className="text-xs text-muted-foreground mt-2.5 pt-2 border-t border-black/5">{footerComponent.text}</div>
          )}
        </div>

        {/* Buttons — rendered outside the bubble, just like real WhatsApp */}
        {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
          <div className="flex flex-col gap-1 w-[94%]">
            {buttonsComponent.buttons.map((btn: any, i: number) => (
              <div
                key={i}
                className="bg-surface rounded-xl text-center py-2 px-3 text-[11px] font-bold text-info shadow-sm flex items-center justify-center gap-1.5 border border-black/10"
              >
                {btn.type === "URL" ? (
                  <>
                    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    {btn.text}
                  </>
                ) : btn.type === "QUICK_REPLY" ? (
                  <>
                    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {btn.text}
                  </>
                ) : btn.type === "PHONE_NUMBER" ? (
                  <>
                    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    {btn.text}
                  </>
                ) : btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

