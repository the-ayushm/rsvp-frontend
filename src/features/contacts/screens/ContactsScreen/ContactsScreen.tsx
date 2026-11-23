/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import Avatar from "@/components/ui/Avatar";
import {
  useState,
  useEffect,
  useRef,
  ElementType,
  useCallback,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useBroadcastStore } from "@/lib/broadcastStore";
import {
  Plus, Upload, Download, Filter, MessageCircle, MessageSquare, RefreshCcw, X, Trash2,
  Phone, User, Mail, Tag, ChevronDown, Pencil, Search, List,
  Radio, UserCheck, Tag as TagIcon, Calendar, AtSign, Hash,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
  SlidersHorizontal, Columns3, Check, Clock, Loader2, Users, Globe
} from "lucide-react";
import ImportContacts from "../../components/ImportContacts";
import { ExportContacts } from "../../components/ExportContacts";
import { CreateContactModal, CustomCountrySelect } from "../../components/CreateContactModal";
import { useRouter, useSearchParams } from "next/navigation";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { selectContactCount } from "../../utils/select-contact-count";

// ==================== TYPES ====================
interface Contact {
  id: string;
  name: string;
  phone_number: string;
  country_code?: string | null;
  phone_number_id?: string | null;
  source?: string | null;
  email: string | null;
  status?: string;
  tags?: string[];
  assigned_to?: string[] | null;
  created_at: string;
  updated_at: string;
  attributes: Record<string, any>;
  custom_fields?: Record<string, any> | null;
  notes?: string;
  is_valid?: boolean;
  company_id?: string;
  user_id?: string | null;
  message_count?: number;
  failed_count?: number;
  last_contacted_at?: string | null;
}

interface ExportContact {
  id: string; phone: string; name: string; email?: string | null;
  source?: string; assigned_to?: string[] | null; tags?: string; status?: string; createdAt: string;
}

interface Filters {
  searchNamePhone: string;
  email?: string;
  phone?: string;
  createdDate: string;
  reminderDate: string;
  assignedDate: string;
  source: string[];
  assignedTo: string;
  assigned_to?: string[];
  tags: string[];
  lists: string[];
  status?: string;
  country_code: string[];
  optInStatus: string;
  duplicate: string;
  showUnassignedOnly: boolean;
  filterGroups: any[];
  custom_fields?: Record<string, string>;
}

interface TagData {
  id: number;
  name: string;
  group?: string;
  userId: number;
  createdAt: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  bg_color: string;
  border_color: string;
  header_bg: string;
  position: number;
}



type DateFilterKeys = 'createdDate' | 'reminderDate' | 'assignedDate';

// ==================== HELPERS ====================

const getPhoneDetails = (
  rawPhone: string,
  contactCountryCode?: string | null
): { countryCode: string; numberOnly: string } => {
  if (!rawPhone) return { countryCode: '—', numberOnly: '—' };
  const cleaned = rawPhone.trim();
  if (!contactCountryCode) return { countryCode: '—', numberOnly: rawPhone };
  const digits = cleaned.replace(/[^\d]/g, '');

  let overrideCC = '';
  if (contactCountryCode) {
    const ccDigits = String(contactCountryCode).replace(/[^\d]/g, '');
    if (ccDigits) overrideCC = `+${ccDigits}`;
  }

  // 1. 10-digit number -> Default to +91 Indian country code unless contact country code provided
  if (digits.length === 10) {
    return {
      countryCode: overrideCC || '+91',
      numberOnly: digits,
    };
  }

  // 2. 12-digit number starting with 91 -> +91 Indian number (e.g. 919619545566)
  if (digits.length === 12 && digits.startsWith('91')) {
    return {
      countryCode: '+91',
      numberOnly: digits.slice(2),
    };
  }

  // 3. Cleaned string starts with +91
  if (cleaned.startsWith('+91')) {
    return {
      countryCode: '+91',
      numberOnly: digits.startsWith('91') ? digits.slice(2) : digits,
    };
  }

  // 4. International format parser (libphonenumber-js) for numbers with '+' or > 10 digits
  if (cleaned.startsWith('+') || digits.length > 10) {
    const phoneObj = parsePhoneNumberFromString(cleaned.startsWith('+') ? cleaned : `+${cleaned}`);
    if (phoneObj && phoneObj.countryCallingCode) {
      if (digits.length === 10) {
        return {
          countryCode: overrideCC || '+91',
          numberOnly: digits,
        };
      }
      return {
        countryCode: `+${phoneObj.countryCallingCode}`,
        numberOnly: phoneObj.nationalNumber || digits,
      };
    }
  }

  return {
    countryCode: overrideCC || (digits.length === 10 ? '+91' : '—'),
    numberOnly: digits || rawPhone,
  };
};

const formatPhoneNumber = (phone: string, contactCountryCode?: string | null): string => {
  if (!phone) return phone;
  const { countryCode, numberOnly } = getPhoneDetails(phone, contactCountryCode);
  if (countryCode && countryCode !== '—') {
    return `${countryCode}${numberOnly}`;
  }
  return phone;
};

const displayPhoneNumber = (phone: string, contactCountryCode?: string | null): string => {
  if (!phone) return phone;
  const { countryCode, numberOnly } = getPhoneDetails(phone, contactCountryCode);
  if (countryCode && countryCode !== '—') {
    return `${countryCode} ${numberOnly}`;
  }
  return numberOnly || phone;
};

const formatDate = (isoDate: string): string => {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return "Invalid Date"; }
};

const formatDateShort = (isoDate: string): string => {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return "Invalid Date"; }
};

const getCustomFieldValue = (contact: Contact, colDef?: { key: string; label: string }) => {
  if (!colDef) return undefined;

  const customFields = contact.custom_fields && typeof contact.custom_fields === 'object' ? contact.custom_fields : {};
  const attributes = contact.attributes && typeof contact.attributes === 'object' ? contact.attributes : {};

  const merged = { ...attributes, ...customFields };
  if (Object.keys(merged).length === 0) return undefined;

  const label = colDef.label || '';
  const colKey = colDef.key || '';

  // 1. Exact match on label or key
  if (merged[label] !== undefined && merged[label] !== null) return merged[label];
  if (merged[colKey] !== undefined && merged[colKey] !== null) return merged[colKey];

  // 2. Case-insensitive exact match
  const labelLower = label.toLowerCase();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null) continue;
    if (k.toLowerCase() === labelLower) return v;
  }

  // 3. Normalized match (ignores all non-alphanumeric chars like dots, spaces, underscores)
  const normLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normLabel) {
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === null) continue;
      if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normLabel) return v;
    }
  }

  // 4. Try strip "CUSTOM_" prefix from colKey
  if (colKey.startsWith('CUSTOM_')) {
    const rawKeyFromCol = colKey.replace(/^CUSTOM_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rawKeyFromCol) {
      for (const [k, v] of Object.entries(merged)) {
        if (v === undefined || v === null) continue;
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === rawKeyFromCol) return v;
      }
    }
  }

  return undefined;
};

// ==================== UI PRIMITIVES ====================

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-8 h-8 text-accent animate-spin" />
  </div>
);

const EmptyState = ({
  message, action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) => (
  <div className="text-center py-16">
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted border border-border flex items-center justify-center">
      <Users className="w-8 h-8 text-muted-foreground" />
    </div>
    <p className="text-muted-foreground text-sm">{message}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm font-medium"
      >
        {action.label}
      </button>
    )}
  </div>
);

/** Contact avatar — one brand tint for everyone (semantic colors are reserved for state). */
const NameAvatar = ({ name }: { name: string }) => <Avatar name={name} size="xs" />;

const StatusBadge = ({ status, stages }: { status?: string, stages: PipelineStage[] }) => {
  const stage = stages.find(s => s.id === status) || stages.find(s => s.name.toLowerCase() === status?.toLowerCase());
  const label = stages.length === 0 ? 'Not Available' : (stage ? stage.name : 'Select status...');
  
  const bgColor = stage ? stage.bg_color : 'bg-muted';
  const textColor = stage ? stage.color : 'text-muted-foreground';
  const ringColor = stage ? stage.color.replace('text-', 'ring-') : 'ring-border-strong/20';
  const dotColor = stage ? stage.color.replace('text-', 'bg-') : 'bg-disabled-foreground';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${bgColor} ${textColor} ${ringColor} dark:ring-opacity-30`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`} />
      {label}
    </span>
  );
};

const SourceBadge = ({ source }: { source?: string }) => {
  if (!source) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    facebook: 'border-info text-[var(--color-primary-dark)] dark:border-info dark:text-info',
    instagram: 'border-primary text-primary-text dark:border-primary dark:text-primary-text',
    whatsapp: 'border-primary text-[var(--color-primary-dark)] dark:border-primary dark:text-primary-text',
    website: 'border-primary text-primary-text dark:border-primary dark:text-primary-text',
  };
  const cls = map[source.toLowerCase()] ?? 'border-border-strong text-secondary-foreground dark:border-border dark:text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${cls}`}>
      {source}
    </span>
  );
};

// ==================== MODAL WRAPPER ====================
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const Modal = ({ title, children, onClose, size = 'md' }: ModalProps) => {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
      <div className={`bg-card rounded-xl w-full ${widths[size]} shadow-2xl border border-border flex flex-col max-h-[90vh]`}>
        <div className="px-5 py-4 flex justify-between items-center border-b border-border bg-muted rounded-t-xl shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-secondary-foreground dark:hover:text-white rounded transition">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// ==================== MULTI-SELECT DROPDOWN ====================
const MultiSelectDropdown = ({
  label, options, selectedValues, onChange, placeholder, searchable = false,
}: {
  label: string;
  options: { value: string; label: string; flag?: string; code?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  searchable?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && menuRef.current) {
      const timer = setTimeout(() => {
        menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const filtered = searchable
    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) || (o.code && o.code.toLowerCase().includes(q.toLowerCase())))
    : options;

  const toggle = (v: string) =>
    onChange(selectedValues.includes(v) ? selectedValues.filter(x => x !== v) : [...selectedValues, v]);

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="block text-[12px] font-semibold text-muted-foreground mb-[7px]">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full bg-surface-muted border-[1.5px] border-solid border-border text-[14px] px-[14px] py-[11px] rounded-[8px] flex items-center justify-between text-foreground focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] transition-all"
      >
        <span className={selectedValues.length === 0 ? 'text-muted-foreground' : ''}>
          {selectedValues.length > 0 ? `${selectedValues.length} selected` : placeholder}
        </span>
        <ChevronDown size={15} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={menuRef} className="absolute z-30 mt-1 w-full rounded-lg shadow-xl bg-card border border-border overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-border">
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search..."
                className="w-full bg-muted border border-border text-foreground text-xs px-2.5 py-1.5 rounded-md focus:outline-none focus:border-primary"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        <div className="max-h-48 overflow-y-auto">
          {filtered.map((o, idx) => {
            const selected = selectedValues.includes(o.value);

            return (
              <button
                type="button"
                key={`${o.value}-${o.code || idx}`}
                onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted cursor-pointer transition text-left"
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 ${
                    selected
                      ? 'bg-foreground border-foreground text-primary-foreground'
                      : 'border-border'
                  }`}
                >
                  {selected && <Check size={10} className="text-white" />}
                </div>
                {o.code ? (
                  <img
                    src={`https://flagcdn.com/w20/${o.code.toLowerCase()}.png`}
                    alt={o.label}
                    className="w-4.5 h-3.5 object-cover rounded-[2px] shrink-0 border border-black/10"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : o.flag ? (
                  <span className="text-sm shrink-0 leading-none">{o.flag}</span>
                ) : null}
                <span className="text-xs text-foreground truncate">
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
};

// ==================== CREATE CONTACT MODAL ====================







// ==================== DELETE CONFIRM MODAL ====================
const DeleteConfirmModal = ({
  contact,
  onConfirm,
  onClose,
  isDeleting,
}: {
  contact: Contact;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) => (
  <Modal title="Delete Contact" onClose={onClose} size="sm">
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error-bg dark:bg-error-bg/30 flex items-center justify-center">
        <Trash2 size={22} className="text-error dark:text-error" />
      </div>
      <p className="text-sm text-foreground mb-1">
        Delete <span className="font-semibold">&quot;{contact.name}&quot;</span>?
      </p>
      <p className="text-xs text-muted-foreground mb-6">This action cannot be undone.</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition border border-border"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 text-sm bg-error text-white rounded-lg hover:bg-error transition disabled:opacity-50 flex items-center gap-2"
        >
          {isDeleting && <Loader2 size={14} className="animate-spin" />}
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </Modal>
);

// ==================== BULK DELETE CONFIRM MODAL ====================
const BulkDeleteConfirmModal = ({
  count,
  onConfirm,
  onClose,
  isDeleting,
}: {
  count: number;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) => (
  <Modal title="Delete Selected Contacts" onClose={onClose} size="sm">
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error-bg dark:bg-error-bg/30 flex items-center justify-center">
        <Trash2 size={22} className="text-error dark:text-error" />
      </div>
      <p className="text-sm text-foreground mb-1">
        Are you sure you want to delete <span className="font-semibold text-error dark:text-error">{count}</span> contacts?
      </p>
      <p className="text-xs text-muted-foreground mb-6">This action cannot be undone.</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition border border-border disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 text-sm bg-error text-white rounded-lg hover:bg-error transition disabled:opacity-50 flex items-center gap-2 font-semibold"
        >
          {isDeleting && <Loader2 size={14} className="animate-spin" />}
          {isDeleting ? 'Deleting...' : `Delete ${count} Contacts`}
        </button>
      </div>
    </div>
  </Modal>
);

// ==================== EDIT CONTACT MODAL (FIXED) ====================
interface EditContactModalProps {
  contact: Contact;
  onClose: () => void;
  onSuccess: (updatedContact: Contact) => void;
  stages: PipelineStage[];
  availableTags: TagData[];
  acceptedTeamMembers?: any[];
  columnOptions?: ColumnOption[];
  phoneNumbers?: any[];
}

const EditContactModal = ({
  contact,
  onClose,
  onSuccess,
  stages,
  availableTags,
  acceptedTeamMembers = [],
  columnOptions = [],
  phoneNumbers = [],
}: EditContactModalProps) => {
  const linkedPhoneNumber = phoneNumbers.find(number =>
    contact.phone_number_id != null &&
    [number.id, number.phone_number_id].some(id => id != null && String(id) === String(contact.phone_number_id))
  );
  const linkedPhoneNumberId = linkedPhoneNumber?.phone_number_id ||
    (/^\d+$/.test(contact.phone_number_id || '') ? contact.phone_number_id : '');
  const rawInitialAssigned: string[] =
    Array.isArray(contact.assigned_to)
      ? contact.assigned_to
      : contact.assigned_to
      ? [contact.assigned_to]
      : [];

  const isInitialAssignedValid = acceptedTeamMembers.some((m: any) => {
    const id = String(m.user_id || m.id || m.userId || "");
    return id && rawInitialAssigned.includes(id);
  });

  const initialAssigned: string[] = isInitialAssignedValid ? rawInitialAssigned : [];

  const parsedCountryCode = contact.country_code ? String(contact.country_code).replace(/[^\d]/g, '') : '';
  let parsedPhone = contact.phone_number || '';

  if (parsedCountryCode) {
    if (parsedPhone.startsWith('+' + parsedCountryCode)) {
      parsedPhone = parsedPhone.slice(('+' + parsedCountryCode).length).trim();
    }
    parsedPhone = parsedPhone.replace(/[^\d]/g, '');
  }

  const initialOptOut = (contact as any).is_opted_out === true || (contact as any).opt_in === false || (contact as any).is_opted_in === false;

  const [formData, setFormData] = useState({
    name: contact.name || "",
    email: contact.email || "",
    country_code: parsedCountryCode,
    phone_number: parsedPhone,
    source: contact.source ?? contact.attributes?.source ?? "",
    assigned_to: initialAssigned,
    status: contact.status || (stages.length > 0 ? stages[0].id : "new_lead"),
    tag_ids: Array.isArray(contact.tags) ? contact.tags.map(t => typeof t === 'object' && t !== null ? String((t as any).id) : String(t)) : [],
    is_opted_out: initialOptOut,
    attributes: contact.attributes || {},
    custom_fields: contact.custom_fields || {},
    notes: contact.notes || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const assignedOptions = [
    { value: "", label: "Unassigned" },
    ...acceptedTeamMembers.map((m: any) => {
      const id = m.user_id || m.id || m.userId;
      const name = m.name || m.invitee_email || m.email || m.user?.name || m.user?.email || "Team Member";
      return { value: String(id), label: name };
    }),
  ];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d+]/g, "");
    if (value.replace(/[^\d]/g, '').length <= 15) {
      setFormData(prev => ({ ...prev, phone_number: value }));
    }
  };

  const validateEmail = (email?: string | null) => {
    if (!email || !email.trim()) return { isValid: true, message: "" };
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(email.trim())) {
      return { isValid: false, message: "Invalid email format (e.g. name@example.com)" };
    }
    return { isValid: true, message: "✓ Valid email format" };
  };

  const validatePhoneNumber = (phone?: string | null, countryCode: string = "") => {
    if (!phone || !phone.trim()) {
      return { isValid: false, message: "Phone number is required" };
    }
    const rawDigits = phone.replace(/[^\d]/g, "");
    if (!rawDigits) {
      return { isValid: false, message: "Please enter phone digits" };
    }
    const code = countryCode.toString().replace(/[^\d]/g, "");
    if (code === "91" || code === "1") {
      if (rawDigits.length !== 10) {
        return { isValid: false, message: `✗ Must be exactly 10 digits (currently ${rawDigits.length})` };
      }
    } else if (code === "65") {
      if (rawDigits.length !== 8 && rawDigits.length !== 10) {
        return { isValid: false, message: `✗ Singapore number must be 8 digits (currently ${rawDigits.length})` };
      }
    } else if (code === "44") {
      if (rawDigits.length < 9 || rawDigits.length > 11) {
        return { isValid: false, message: `✗ UK number must be 9-11 digits (currently ${rawDigits.length})` };
      }
    } else if (code === "61") {
      if (rawDigits.length < 9 || rawDigits.length > 10) {
        return { isValid: false, message: `✗ Australia number must be 9-10 digits (currently ${rawDigits.length})` };
      }
    } else if (code === "971") {
      if (rawDigits.length !== 9) {
        return { isValid: false, message: `✗ UAE number must be 9 digits (currently ${rawDigits.length})` };
      }
    } else {
      if (rawDigits.length < 7 || rawDigits.length > 15) {
        return { isValid: false, message: `✗ Number must be 7-15 digits (currently ${rawDigits.length})` };
      }
    }
    return { isValid: true, message: "✓ Valid phone number" };
  };

  const phoneValidation = validatePhoneNumber(formData.phone_number, formData.country_code);
  const emailValidation = validateEmail(formData.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (!phoneValidation.isValid) {
      toast.error(phoneValidation.message.replace(/^✗\s*/, ''));
      return;
    }

    if (formData.email && !emailValidation.isValid) {
      toast.error(emailValidation.message);
      return;
    }

    setIsSaving(true);
    try {
      const isSelectedAssignedValid = acceptedTeamMembers.some((m: any) => {
        const id = String(m.user_id || m.id || m.userId || "");
        return id && (Array.isArray(formData.assigned_to) ? formData.assigned_to.includes(id) : id === String(formData.assigned_to));
      });
      const validAssigned_to: string[] = (isSelectedAssignedValid && formData.assigned_to)
        ? (Array.isArray(formData.assigned_to) ? formData.assigned_to : [formData.assigned_to])
        : [];

      const digits = (formData.phone_number || "").replace(/[^\d]/g, '');
      const fullE164Phone = !formData.country_code || formData.phone_number.startsWith('+')
        ? formData.phone_number
        : `+${formData.country_code}${digits}`;

      const payload = {
        name: formData.name.trim(),
        phone_number: fullE164Phone,
        source: formData.source.trim(),
        country_code: formData.country_code || null,
        email: formData.email ? formData.email.trim() : null,
        status: formData.status || (stages.length > 0 ? stages[0].id : 'new_lead'),
        assigned_to: validAssigned_to,
        tag_ids: formData.tag_ids || [],
        is_opted_out: !!formData.is_opted_out,
        attributes: { ...formData.attributes, source: formData.source.trim() },
        custom_fields: formData.custom_fields || contact.custom_fields || {},
        notes: formData.notes || null,
      };
      
      const response = await soft7AxiosInstance.put(`/admin/contacts/${contact.id}`, payload);

      if (initialOptOut !== formData.is_opted_out) {
        try {
          await soft7AxiosInstance.put(`/admin/contacts/${contact.id}/opt-in-out`, {
            is_opted_out: formData.is_opted_out,
          });
        } catch (e) {
          console.error("Opt status sync error:", e);
        }
      }
      
      if (response.data.success) {
        const updatedContact: any = {
          ...contact,
          ...payload,
          assigned_to: validAssigned_to,
          id: contact.id,
        };
        toast.success('Contact updated successfully');
        onSuccess(updatedContact);
        onClose();
      } else {
        toast.error(response.data.message || 'Failed to update contact');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update contact');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-surface dark:bg-card text-foreground rounded-[16px] w-full max-w-[740px] shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),0_2px_10px_rgba(36,28,20,0.05)] border-none flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-[30px] py-[22px] flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-primary to-primary">
          <div className="absolute w-[200px] h-[200px] rounded-full -top-[110px] -right-[50px] pointer-events-none" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)' }}></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-white">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
              </svg>
            </div>
            <div className="font-display text-[19px] font-semibold tracking-[-0.01em] m-0" style={{ color: 'var(--color-primary-foreground)' }}>
              Edit contact
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-[32px] h-[32px] shrink-0 rounded-full border-none flex items-center justify-center transition-colors relative z-10 hover:opacity-80"
            style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)' }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-foreground)" strokeWidth="2" strokeLinecap="round" className="w-[14px] h-[14px]"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Identity strip */}
        <div className="flex items-center gap-[14px] px-[30px] py-[20px] bg-surface-hover border-b border-border shrink-0">
          <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-bold text-[17px] shrink-0 shadow-[0_6px_16px_-6px_rgba(var(--color-primary-rgb),0.5)]" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}>
            {(formData.name || contact.name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[15.5px] font-bold text-foreground">{contact.name}</div>
            <div className="text-[12.5px] text-muted-foreground mt-[2px]">{displayPhoneNumber(contact.phone_number, contact.country_code)}</div>
          </div>
        </div>

        {/* Body and Form */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto px-[30px] pt-[24px] pb-[6px]">
            
            {/* 1. Name & 2. Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mb-[18px]">
              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Name <span className="text-primary-text ml-[2px]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                />
                {formData.email && (
                  <p className={`text-[11px] font-medium mt-1 ${emailValidation.isValid ? "text-[var(--color-primary-hover)]" : "text-error"}`}>
                    {emailValidation.message}
                  </p>
                )}
              </div>
            </div>

            {/* 3. Country Code & 4. Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mb-[18px]">
              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Country Code
                </label>
              <CustomCountrySelect
                value={formData.country_code}
                onChange={(val) => setFormData((prev) => ({ ...prev, country_code: val }))}
              />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Phone number <span className="text-primary-text ml-[2px]">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={handlePhoneChange}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                  required
                />
                {formData.phone_number && (
                  <p className={`text-[11px] font-medium mt-1 ${phoneValidation.isValid ? "text-[var(--color-primary-hover)]" : "text-error"}`}>
                    {phoneValidation.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mb-[18px]">
              <div>
                <label htmlFor="contact-waba-phone-number" className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  WhatsApp phone number
                </label>
                <input
                  id="contact-waba-phone-number"
                  type="text"
                  value={linkedPhoneNumber?.display_phone_number || linkedPhoneNumber?.displayPhone || linkedPhoneNumber?.phone_number || ''}
                  readOnly
                  placeholder="Not provided"
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground focus:outline-none"
                />
              </div>
              <div>
              <label htmlFor="contact-phone-number-id" className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                Phone number ID
              </label>
              <input
                id="contact-phone-number-id"
                type="text"
                value={linkedPhoneNumberId}
                readOnly
                placeholder="Not provided"
                className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground focus:outline-none"
              />
              </div>
            </div>

            <div className="mb-[18px]">
              <label htmlFor="contact-source" className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                Source
              </label>
              <input
                id="contact-source"
                type="text"
                value={formData.source}
                onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                placeholder="Enter source"
                className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface"
              />
            </div>

            {/* 5. Assigned to & 6. Assigned Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mb-[18px]">
              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Assigned to
                </label>
                <div className="relative">
                  <select
                    value={Array.isArray(formData.assigned_to) ? (formData.assigned_to[0] || '') : (formData.assigned_to || '')}
                    onChange={e => setFormData(prev => ({ ...prev, assigned_to: e.target.value ? [e.target.value] : [] }))}
                    className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                  >
                    {assignedOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-[12px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Assigned Tags
                </label>
                <div className="relative" ref={tagDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setTagDropdownOpen(p => !p)}
                    className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] flex items-center justify-between text-left"
                  >
                    <span className="truncate">
                      {formData.tag_ids?.length > 0 
                        ? formData.tag_ids.map(id => availableTags.find(t => t.id.toString() === id.toString() || t.name === id)?.name || id).join(', ') 
                        : <span className="text-muted-foreground">Select tags...</span>}
                    </span>
                    <svg className={`shrink-0 w-[15px] h-[15px] text-muted-foreground transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  
                  {tagDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-surface border-[1.5px] border-border rounded-[8px] shadow-[0_10px_20px_-5px_rgba(0,0,0,0.1)] max-h-[160px] overflow-y-auto">
                      {availableTags.length > 0 ? availableTags.map(tag => {
                        const isSelected = formData.tag_ids?.some(t => t.toString() === tag.id.toString() || t === tag.name);
                        return (
                        <label key={tag.id} className="flex items-center gap-[10px] px-[14px] py-[10px] hover:bg-surface-muted cursor-pointer transition-colors border-b border-border last:border-0"
                          onClick={(e) => {
                            e.preventDefault();
                            setFormData(prev => ({
                              ...prev,
                              tag_ids: prev.tag_ids?.some(t => t.toString() === tag.id.toString() || t === tag.name)
                                ? prev.tag_ids.filter(t => t.toString() !== tag.id.toString() && t !== tag.name)
                                : [...(prev.tag_ids || []), tag.id.toString()]
                            }));
                          }}
                        >
                          <div className={`w-[16px] h-[16px] shrink-0 rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-surface'}`}>
                            {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-[10px] h-[10px]"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span className="text-[14px] text-foreground truncate">{tag.name}</span>
                        </label>
                      )}) : (
                        <div className="px-[14px] py-[10px] text-[13px] text-muted-foreground">No tags available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 7. Status & 8. Opt-Out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mb-[18px]">
              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                  >
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-[12px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                  Opt-Out <span className="text-muted-foreground font-normal lowercase">(true, false)</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.is_opted_out ? 'true' : 'false'}
                    onChange={e => setFormData(prev => ({ ...prev, is_opted_out: e.target.value === 'true' }))}
                    className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                  >
                    <option value="false">False (Opted In)</option>
                    <option value="true">True (Opted Out)</option>
                  </select>
                  <svg className="absolute right-[12px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>

            {/* Custom fields & Dynamic Columns Entry */}
            {(() => {
              const standardKeys = new Set([
                'name', 'email', 'country_code', 'phone_number', 'phone', 'assigned_to',
                'tag_ids', 'tags', 'tag', 'status', 'is_opted_out', 'opt_in', 'opt_out',
                'optin', 'optout', 'created_at', 'updated_at', 'id', 'phone_number_id',
                'country code', 'phone number', 'assigned to', 'assigned tags', 'source'
              ]);

              const extraCols = (columnOptions || []).filter(c => 
                !c.compulsory &&
                !standardKeys.has((c.key || '').toLowerCase()) &&
                !standardKeys.has((c.label || '').toLowerCase())
              );
              const mergedFields: Record<string, any> = {
                ...(contact.attributes || {}),
                ...(contact.custom_fields || {}),
                ...(formData.custom_fields || {}),
              };

              const fieldKeysSet = new Set<string>();
              Object.keys(mergedFields).forEach(k => {
                const norm = k ? k.toLowerCase().replace(/_/g, ' ').trim() : '';
                const raw = k ? k.toLowerCase().trim() : '';
                if (k && !standardKeys.has(norm) && !standardKeys.has(raw)) {
                  fieldKeysSet.add(k);
                }
              });
              extraCols.forEach(c => {
                if (c.label && !c.compulsory && !standardKeys.has(c.label.toLowerCase())) {
                  fieldKeysSet.add(c.label);
                }
              });

              const keys = Array.from(fieldKeysSet).filter(Boolean);
              if (keys.length === 0) return null;

              return (
                <div className="mb-[18px]">
                  <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                    Custom Columns / Fields
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                    {keys.map(k => (
                      <div key={k}>
                        <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[6px]">
                          {k}
                        </label>
                        <input
                          type="text"
                          value={String(formData.custom_fields?.[k] ?? mergedFields[k] ?? "")}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              custom_fields: {
                                ...(prev.custom_fields || {}),
                                [k]: val,
                              }
                            }));
                          }}
                          placeholder={`Enter ${k}...`}
                          className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="mb-[18px]">
              <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-[8px]">
                Notes
              </label>
              <textarea
                rows={3}
                value={formData.notes || ''}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full min-h-[84px] rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground resize-y"
                placeholder="Add notes about this contact..."
              />
            </div>

            <hr className="border-t border-border mt-[4px] mb-[0px] border-x-0 border-b-0" />
          </div>

          <div className="flex justify-end gap-[10px] px-[30px] pt-[18px] pb-[24px] shrink-0 bg-surface dark:bg-card">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold bg-surface border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150 flex items-center gap-[7px] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold text-white transition-all duration-150 flex items-center gap-[7px] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 hover:-translate-y-[1px] shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)]"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]"><polyline points="20 6 9 17 4 12"/></svg>
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== STATUS DROPDOWN CELL COMPONENT ====================
const StatusDropdownCell = ({ 
  contact, 
  onStatusChange,
  stages
}: { 
  contact: Contact; 
  onStatusChange: (contactId: string, newStatus: string) => void;
  stages: PipelineStage[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const validStages = stages.filter(s => s.name.toLowerCase().trim() !== 'select' && s.id.toLowerCase().trim() !== 'select');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (isUpdating) return;
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = Math.min(validStages.length * 32 + 12, 210);
      const spaceBelow = window.innerHeight - rect.bottom;
      const isUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      
      const topPos = isUp 
        ? rect.top - dropdownHeight - 4 
        : rect.bottom + 4;
      const leftPos = Math.max(10, Math.min(rect.left, window.innerWidth - 165));

      setCoords({ top: topPos, left: leftPos });
    }
    setIsOpen(!isOpen);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === contact.status) {
      setIsOpen(false);
      return;
    }
    
    setIsUpdating(true);
    try {
      const response = await soft7AxiosInstance.put(`/admin/contacts/${contact.id}`, {
        status: newStatus,
      });
      
      if (response.data.success) {
        toast.success(`Status updated successfully`);
        onStatusChange(contact.id, newStatus);
      } else {
        toast.error('Failed to update status');
      }
    } catch (error: any) {
      console.error('Status update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const currentStage = stages.find(s => s.id === contact.status) || stages.find(s => s.name.toLowerCase() === contact.status?.toLowerCase());
  const currentStatusLabel = stages.length === 0 ? 'Not Available' : (currentStage ? currentStage.name : 'Select status...');
  const stageBg   = currentStage?.bg_color ?? 'bg-muted/60';
  const stageText = currentStage?.color    ?? 'text-muted-foreground';
  const stageBorder = currentStage ? (currentStage.border_color || currentStage.color.replace('text-', 'border-')) : 'border-border-strong';

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border whitespace-nowrap transition text-[11px] font-medium cursor-pointer ${stageBg} ${stageText} ${stageBorder}`}
      >
        <span className="font-medium">
          {isUpdating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            currentStatusLabel
          )}
        </span>
        <ChevronDown size={11} className={`opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !isUpdating && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
          }}
          className="min-w-[150px] max-h-52 overflow-y-auto bg-card border border-border rounded-lg shadow-2xl py-1 text-xs"
        >
          {validStages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => handleStatusChange(stage.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition text-left cursor-pointer ${
                contact.status === stage.id
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-foreground'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stage.color.replace('text-', 'bg-')}`} />
              <span className="flex-1 truncate">{stage.name}</span>
              {contact.status === stage.id && (
                <Check size={12} className="text-accent shrink-0" />
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

// ==================== FILTERS MODAL ====================
const FiltersModal = ({
  filters, onFilterChange, onApply, onClose, onClear, availableTags, stages, acceptedTeamMembers = [], contactLists = [], columnOptions = []
}: {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: Filters[keyof Filters]) => void;
  onApply: () => void;
  onClose: () => void;
  onClear: () => void;
  availableTags: TagData[];
  stages: PipelineStage[];
  acceptedTeamMembers?: any[];
  contactLists?: any[];
  columnOptions?: ColumnOption[];
}) => {
  const [assignedOpen, setAssignedOpen] = useState(false);
  const [optInOpen, setOptInOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const assignedRef = useRef<HTMLDivElement>(null);
  const optInRef = useRef<HTMLDivElement>(null);
  const dupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assignedRef.current && !assignedRef.current.contains(e.target as Node)) setAssignedOpen(false);
      if (optInRef.current && !optInRef.current.contains(e.target as Node)) setOptInOpen(false);
      if (dupRef.current && !dupRef.current.contains(e.target as Node)) setDupOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sourceOptions = ['whatsapp','import','website','facebook','instagram','twitter','linkedin','email','referral']
    .map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
  const tagOptions = availableTags.map(t => ({ value: String(t.id), label: t.name }));
  const listOptions = (contactLists || []).map((l: any) => ({ value: String(l.id), label: l.name || `List ${l.id}` }));
  const countryCodeOptions = [
    { value: '91', label: 'India +91', flag: '🇮🇳', code: 'in' },
    { value: '1', label: 'USA +1', flag: '🇺🇸', code: 'us' },
    { value: '44', label: 'UK +44', flag: '🇬🇧', code: 'gb' },
    { value: '62', label: 'Indonesia +62', flag: '🇮🇩', code: 'id' },
    { value: '61', label: 'Australia +61', flag: '🇦🇺', code: 'au' },
    { value: '971', label: 'UAE +971', flag: '🇦🇪', code: 'ae' },
    { value: '65', label: 'Singapore +65', flag: '🇸🇬', code: 'sg' },
    { value: '60', label: 'Malaysia +60', flag: '🇲🇾', code: 'my' },
    { value: '94', label: 'Sri Lanka +94', flag: '🇱🇰', code: 'lk' },
    { value: '880', label: 'Bangladesh +880', flag: '🇧🇩', code: 'bd' },
    { value: '92', label: 'Pakistan +92', flag: '🇵🇰', code: 'pk' },
    { value: '977', label: 'Nepal +977', flag: '🇳🇵', code: 'np' },
    { value: '66', label: 'Thailand +66', flag: '🇹🇭', code: 'th' },
    { value: '84', label: 'Vietnam +84', flag: '🇻🇳', code: 'vn' },
    { value: '63', label: 'Philippines +63', flag: '🇵🇭', code: 'ph' },
    { value: '55', label: 'Brazil +55', flag: '🇧🇷', code: 'br' },
    { value: '49', label: 'Germany +49', flag: '🇩🇪', code: 'de' },
    { value: '33', label: 'France +33', flag: '🇫🇷', code: 'fr' },
    { value: '39', label: 'Italy +39', flag: '🇮🇹', code: 'it' },
    { value: '34', label: 'Spain +34', flag: '🇪🇸', code: 'es' },
    { value: '966', label: 'Saudi Arabia +966', flag: '🇸🇦', code: 'sa' },
    { value: '974', label: 'Qatar +974', flag: '🇶🇦', code: 'qa' },
    { value: '965', label: 'Kuwait +965', flag: '🇰🇼', code: 'kw' },
    { value: '27', label: 'South Africa +27', flag: '🇿🇦', code: 'za' },
    { value: '81', label: 'Japan +81', flag: '🇯🇵', code: 'jp' },
    { value: '82', label: 'South Korea +82', flag: '🇰🇷', code: 'kr' },
    { value: '852', label: 'Hong Kong +852', flag: '🇭🇰', code: 'hk' },
    { value: '36', label: 'Hungary +36', flag: '🇭🇺', code: 'hu' },
    { value: '354', label: 'Iceland +354', flag: '🇮🇸', code: 'is' },
  ];
  const assignedOpts = [
    { value: '', label: 'All users' },
    ...acceptedTeamMembers.map((m: any) => {
      const id = m.user_id || m.id || m.userId;
      const name = m.name || m.invitee_email || m.email || m.user?.name || m.user?.email || 'Team Member';
      return { value: String(id), label: name };
    }),
  ];
  const optInOpts = [
    { value: 'all', label: 'All' },
    { value: 'true', label: 'True (Opted Out)' },
    { value: 'false', label: 'False (Opted In)' },
  ];
  const dupOpts = [{ value: 'all', label: 'All' }, { value: 'show-duplicates', label: 'Show duplicates' }, { value: 'hide-duplicates', label: 'Hide duplicates' }];
  const dateFilters: { label: string; key: DateFilterKeys }[] = [
    { label: 'Created Date', key: 'createdDate' },
    { label: 'Reminder Date', key: 'reminderDate' },
    { label: 'Assigned Date', key: 'assignedDate' },
  ];

  const SimpleDropdown = ({
    label: lbl, opts, value, onChange, isOpen, setIsOpen, dropRef,
  }: {
    label: string; opts: { value: string; label: string }[]; value: string;
    onChange: (v: string) => void; isOpen: boolean; setIsOpen: (v: boolean) => void;
    dropRef: React.RefObject<HTMLDivElement | null>;
  }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (isOpen && menuRef.current) {
        const timer = setTimeout(() => {
          menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [isOpen]);

    return (
      <div className="mb-[22px]">
        <label className="block text-[12px] font-semibold text-muted-foreground mb-[7px]">
          {lbl}
        </label>
        <div ref={dropRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full bg-surface-muted border-[1.5px] border-solid border-border text-[14px] px-[14px] py-[11px] rounded-[8px] flex items-center justify-between text-foreground focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] transition-all"
          >
            <span className={value ? '' : 'text-muted-foreground'}>
              {opts.find(o => o.value === value || (value === 'opted-in' && o.value === 'false') || (value === 'not-opted-in' && o.value === 'true') || (value === 'opted-out' && o.value === 'true'))?.label || 'Select...'}
            </span>
            <ChevronDown size={15} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {isOpen && (
            <div ref={menuRef} className="absolute z-20 mt-1 w-full rounded-lg shadow-xl bg-card border border-border overflow-hidden">
              {opts.map(o => (
                <div
                  key={o.value}
                  onClick={() => { onChange(o.value); setIsOpen(false); }}
                  className={`px-3 py-1.5 text-xs cursor-pointer transition flex items-center justify-between ${
                    o.value === value || (value === 'opted-in' && o.value === 'false') || (value === 'not-opted-in' && o.value === 'true') || (value === 'opted-out' && o.value === 'true')
                      ? 'text-[var(--color-primary)] dark:text-[var(--color-primary)] bg-[var(--color-success-light)] dark:bg-[var(--color-success-light)]0/10'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {o.label}
                  {(o.value === value || (value === 'opted-in' && o.value === 'false') || (value === 'not-opted-in' && o.value === 'true') || (value === 'opted-out' && o.value === 'true')) && <Check size={12} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface rounded-[16px] w-full max-w-[740px] shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),_0_2px_10px_rgba(36,28,20,0.05)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div 
          className="px-[30px] py-[22px] flex items-center justify-between relative overflow-hidden shrink-0 rounded-t-[16px]"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary) 100%)' }}
        >
          <div 
            className="absolute w-[200px] h-[200px] rounded-full pointer-events-none" 
            style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)', top: '-110px', right: '-50px' }}
          />
          
          <div className="flex items-center gap-3 relative z-10">
            <div 
              className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)' }}
            >
              <SlidersHorizontal size={18} className="text-white" />
            </div>
            <h1 className="text-[19px] font-semibold text-white tracking-tight m-0" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
              Filters
            </h1>
          </div>
          <button 
            onClick={onClose} 
            className="w-[32px] h-[32px] rounded-full text-white flex items-center justify-center transition-colors relative z-10 hover:opacity-80"
            style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)' }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-[30px] pt-[26px] pb-[32px] overflow-y-auto flex-1 scroll-smooth">
          
          {/* Section: Contact Fields */}
          <div className="flex items-center gap-[10px] text-[11.5px] font-bold tracking-[0.06em] text-primary-text uppercase mb-3 before:content-[''] before:block before:w-4 before:h-[2.5px] before:rounded-sm before:bg-primary">Contact Filters</div>

          {/* Row 1: 1. Name & 2. Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[22px]">
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-[7px]">Name</label>
              <div className="relative">
                <User size={16} className="absolute left-[13px] top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={filters.searchNamePhone}
                  onChange={e => onFilterChange('searchNamePhone', e.target.value)}
                  placeholder="Filter by name..."
                  className="w-full bg-surface-muted border-[1.5px] border-solid border-border pl-[38px] pr-[14px] py-[11px] rounded-[8px] text-[14px] text-foreground focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-[7px]">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-[13px] top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={filters.email || ''}
                  onChange={e => onFilterChange('email', e.target.value)}
                  placeholder="Filter by email address..."
                  className="w-full bg-surface-muted border-[1.5px] border-solid border-border pl-[38px] pr-[14px] py-[11px] rounded-[8px] text-[14px] text-foreground focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Row 2: 3. Assigned To & 4. Contact List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[22px]">
            <div className="[&>div]:mb-0">
              <SimpleDropdown
                label="Assigned To" opts={assignedOpts} value={filters.assignedTo}
                onChange={v => onFilterChange('assignedTo', v)} isOpen={assignedOpen}
                setIsOpen={setAssignedOpen} dropRef={assignedRef}
              />
            </div>
            <div className="[&>div]:mb-0">
              <MultiSelectDropdown
                label="Contact List" options={listOptions} selectedValues={filters.lists || []}
                onChange={v => onFilterChange('lists', v)} placeholder="All contact lists" searchable
              />
            </div>
          </div>

          {/* Row 3: 5. Status & 6. Assigned Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[22px]">
            <div className="[&>div]:mb-0">
              <MultiSelectDropdown
                label="Status" 
                options={stages.map(s => ({ value: s.id, label: s.name }))} 
                selectedValues={filters.status ? [filters.status] : []}
                onChange={v => onFilterChange('status', v[0] || '')} 
                placeholder="All statuses"
              />
            </div>
            <div className="[&>div]:mb-0">
              <MultiSelectDropdown
                label="Assigned Tags" options={tagOptions} selectedValues={filters.tags}
                onChange={v => onFilterChange('tags', v)} placeholder="All tags" searchable
              />
            </div>
          </div>

          {/* Row 4: 7. Opt-Out & 8. Country Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[22px] items-end">
            <div className="[&>div]:mb-0">
              <SimpleDropdown
                label="Opt-Out" opts={optInOpts} value={filters.optInStatus}
                onChange={v => onFilterChange('optInStatus', v)} isOpen={optInOpen}
                setIsOpen={setOptInOpen} dropRef={optInRef}
              />
            </div>
            <div className="[&>div]:mb-0">
              <MultiSelectDropdown
                label="Country Code" options={countryCodeOptions} selectedValues={filters.country_code}
                onChange={v => onFilterChange('country_code', v)} placeholder="All country codes" searchable
              />
            </div>
          </div>

          {/* Row 5: Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-[22px]">
            <div className="[&>div]:mb-0">
              <MultiSelectDropdown
                label="Source" options={sourceOptions} selectedValues={filters.source}
                onChange={v => onFilterChange('source', v)} placeholder="All sources"
              />
            </div>
          </div>

          {/* Custom Fields / Columns added by user */}
          {(() => {
            const customCols = (columnOptions || []).filter(c => !c.compulsory && c.key !== 'COUNTRY_CODE');
            if (customCols.length === 0) return null;

            return (
              <div className="mb-[22px]">
                <div className="flex items-center gap-[10px] text-[11.5px] font-bold tracking-[0.06em] text-primary-text uppercase mb-3 before:content-[''] before:block before:w-4 before:h-[2.5px] before:rounded-sm before:bg-primary">
                  Custom Fields
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customCols.map(col => (
                    <div key={col.key}>
                      <label className="block text-[12px] font-semibold text-muted-foreground mb-[7px]">
                        {col.label.charAt(0).toUpperCase() + col.label.slice(1)}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={filters.custom_fields?.[col.label] || filters.custom_fields?.[col.key] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const nextCustom = {
                              ...(filters.custom_fields || {}),
                              [col.label]: val,
                              [col.key]: val,
                            };
                            onFilterChange('custom_fields', nextCustom);
                          }}
                          placeholder={`Filter by ${col.label}...`}
                          className="w-full bg-surface-muted border-[1.5px] border-solid border-border px-[14px] py-[11px] rounded-[8px] text-[14px] text-foreground focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <hr className="border-0 border-t border-border my-1.5 mb-[22px]" />

          <div className="flex items-center justify-between p-[14px] px-[16px] bg-surface-hover rounded-[11px] mb-[22px]">
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">Show unassigned only</p>
              <p className="text-[12px] text-muted-foreground mt-[2px]">Filter contacts with no assigned user</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer w-[42px] h-[24px]">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={filters.showUnassignedOnly}
                onChange={() => onFilterChange('showUnassignedOnly', !filters.showUnassignedOnly)}
              />
              <div className="absolute inset-0 bg-border-strong rounded-full transition-colors peer-checked:bg-primary"></div>
              <div className="absolute left-[3px] top-[3px] bg-surface w-[18px] h-[18px] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform peer-checked:translate-x-[18px]"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-[30px] py-[16px] pb-[24px] border-t border-border flex justify-between items-center shrink-0">
          <button
            onClick={onClear}
            className="px-[20px] py-[11px] text-[14px] font-semibold border-[1.5px] border-border text-muted-foreground bg-surface hover:bg-surface-hover rounded-[8px] transition-all"
          >
            Clear All
          </button>
          <button
            onClick={onApply}
            className="px-[20px] py-[11px] text-[14px] font-semibold text-white rounded-[8px] flex items-center gap-[7px] transition-all shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)] hover:brightness-105 hover:-translate-y-[1px]"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]"><polyline points="20 6 9 17 4 12"/></svg>
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== CUSTOM ROWS PER PAGE SELECTOR ====================
const CustomRowsPerPage = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (limit: number) => void;
}) => {
  const [isCustom, setIsCustom] = useState(false);
  const [inputVal, setInputVal] = useState(value.toString());

  useEffect(() => {
    setInputVal(value.toString());
  }, [value]);

  const handleApply = () => {
    let num = parseInt(inputVal, 10);
    if (isNaN(num) || num < 10) num = 10;
    if (num > 100) num = 100;
    setInputVal(num.toString());
    setIsCustom(false);
    onChange(num);
  };

  const presetOptions = [10, 20, 30, 50, 100];

  if (isCustom) {
    return (
      <div className="flex items-center gap-1 bg-card border border-accent rounded-md px-1 py-0.5 shadow-xs">
        <input
          type="number"
          min={10}
          max={100}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleApply}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleApply();
            if (e.key === 'Escape') setIsCustom(false);
          }}
          autoFocus
          placeholder="10-100"
          className="w-10 bg-transparent text-foreground font-semibold text-xs text-center outline-none"
        />
        <button
          type="button"
          onClick={handleApply}
          className="text-[10px] font-bold text-accent hover:opacity-80 transition"
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <select
      value={presetOptions.includes(value) ? value : 'custom_val'}
      onChange={(e) => {
        if (e.target.value === 'custom') {
          setIsCustom(true);
        } else if (e.target.value !== 'custom_val') {
          onChange(Number(e.target.value));
        }
      }}
      className="w-[58px] bg-card border border-border text-foreground font-medium rounded-md px-1 py-0.5 text-xs outline-none focus:border-accent cursor-pointer"
    >
      {presetOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      {!presetOptions.includes(value) && (
        <option value="custom_val">{value}</option>
      )}
      <option value="custom">Custom...</option>
    </select>
  );
};

// ==================== PAGINATION ====================
const Pagination = ({
  currentPage, totalPages, totalItems, itemsPerPage, onPrev, onNext, selectedCount, isSelectingCount, onSelectCountChange, onLimitChange
}: {
  currentPage: number; totalPages: number; totalItems: number;
  itemsPerPage: number; onPrev: () => void; onNext: () => void; selectedCount: number;
  isSelectingCount: boolean;
  onSelectCountChange?: (count: number) => void;
  onLimitChange?: (limit: number) => void;
}) => {
  const [inputVal, setInputVal] = useState(selectedCount.toString());
  const inputFocused = useRef(false);

  useEffect(() => {
    if (!inputFocused.current && !isSelectingCount) {
      setInputVal(selectedCount.toString());
    }
  }, [selectedCount, isSelectingCount]);

  const handleApply = () => {
    const val = Number(inputVal);
    if (Number.isFinite(val) && onSelectCountChange) {
      const count = Math.min(Math.max(0, Math.trunc(val)), totalItems);
      setInputVal(count.toString());
      onSelectCountChange(count);
    } else {
      setInputVal(selectedCount.toString());
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/60 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <input
            type="number"
            min={0}
            max={totalItems}
            step={1}
            aria-label="Number of contacts to select"
            aria-busy={isSelectingCount}
            value={inputVal}
            onFocus={() => { inputFocused.current = true; }}
            onChange={(e) => {
              const value = e.target.value;
              setInputVal(value);
              const count = Number(value);
              if (Number.isFinite(count) && Number.isInteger(count)) {
                onSelectCountChange?.(Math.min(Math.max(0, count), totalItems));
              }
            }}
            onBlur={() => { inputFocused.current = false; handleApply(); }}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            className="w-14 px-1 py-0.5 text-center border border-border rounded-md bg-card text-foreground focus:outline-none focus:border-border focus:ring-1 focus:ring-ring"
          />
          <span className="ml-1 text-muted-foreground">of {totalItems} selected.</span>
          {isSelectingCount && <Loader2 size={13} className="ml-2 animate-spin" aria-label="Selecting contacts" />}
        </div>
        <span className="border-l border-border pl-2">Total: <span className="text-foreground font-medium">{totalItems}</span></span>
      </div>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span>Rows/page</span>
        <CustomRowsPerPage
          value={itemsPerPage}
          onChange={(newLimit) => onLimitChange && onLimitChange(newLimit)}
        />
      </div>
      <span>
        Page <span className="text-foreground font-medium">{currentPage}</span> / <span className="text-foreground font-medium">{totalPages}</span>
      </span>
      <div className="flex items-center gap-0.5">
        {[
          { icon: ChevronFirst, action: () => onPrev(), disabled: currentPage === 1, title: 'First' },
          { icon: ChevronLeft, action: onPrev, disabled: currentPage === 1, title: 'Prev' },
          { icon: ChevronRight, action: onNext, disabled: currentPage === totalPages, title: 'Next' },
          { icon: ChevronLast, action: () => onNext(), disabled: currentPage === totalPages, title: 'Last' },
        ].map(({ icon: Icon, action, disabled, title }) => (
          <button
            key={title} onClick={action} disabled={disabled} title={title}
            className="p-1.5 rounded hover:bg-surface-active dark:hover:bg-surface-raised text-muted-foreground hover:text-foreground dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  </div>
  );
};

// ==================== CONTACT DETAILS SIDEBAR ====================
const InfoRow = ({
  icon: Icon, label, value,
}: {
  icon: ElementType; label: string; value: string;
}) => (
  <div className="flex items-start gap-3">
    <Icon size={15} className="text-muted-foreground mt-0.5 shrink-0" />
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground dark:text-foreground break-all">{value}</p>
    </div>
  </div>
);

const ContactDetailsSidebar = ({
  contact, onClose, onUpdate,
}: {
  contact: Contact;
  onClose: () => void;
  onUpdate: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState<Contact>(contact);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setEdited(contact); setIsEditing(false); }, [contact]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await soft7AxiosInstance.put(`/admin/contacts/${contact.id}`, {
        name: edited.name,
        email: edited.email,
        attributes: edited.attributes,
      });
      toast.success('Contact updated');
      setIsEditing(false);
      onUpdate();
    } catch {
      toast.error('Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card shadow-2xl border-l border-border z-50 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Contact Details</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(p => !p)}
            className={`p-1.5 rounded-lg transition ${isEditing ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 space-y-5">
        {/* Avatar block */}
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <NameAvatar name={edited.name} />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={edited.name}
                onChange={e => setEdited(p => ({ ...p, name: e.target.value }))}
                className="w-full text-sm font-semibold bg-muted border border-border text-foreground px-2 py-1 rounded-lg focus:outline-none focus:border-primary"
              />
            ) : (
              <p className="text-sm font-semibold text-foreground truncate">{edited.name}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-4">
          <InfoRow icon={Phone} label="Phone" value={displayPhoneNumber(edited.phone_number, edited.country_code)} />
          <InfoRow icon={Mail} label="Email" value={edited.email || '—'} />
          <InfoRow icon={Tag} label="Tags" value={edited.tags?.join(', ') || '—'} />
          <InfoRow icon={Calendar} label="Created" value={formatDate(edited.created_at)} />
          {edited.last_contacted_at && (
            <InfoRow icon={Clock} label="Last Contacted" value={formatDate(edited.last_contacted_at)} />
          )}
        </div>

        {/* Edit fields */}
        {isEditing && (
          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={edited.email || ''}
                onChange={e => setEdited(p => ({ ...p, email: e.target.value }))}
                placeholder="Email address"
                className="w-full bg-muted border border-border text-foreground px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary placeholder-muted-foreground transition"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEdited(contact); setIsEditing(false); }}
                className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:text-foreground dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs bg-primary hover:opacity-90 text-primary-foreground rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Custom fields & attributes */}
        {(() => {
          const merged = {
            ...(edited.attributes && typeof edited.attributes === 'object' ? edited.attributes : {}),
            ...(edited.custom_fields && typeof edited.custom_fields === 'object' ? edited.custom_fields : {}),
          };
          const entries = Object.entries(merged);
          if (entries.length === 0) return null;
          return (
            <div className="border-t border-border pt-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custom Fields & Attributes</p>
              <div className="space-y-2">
                {entries.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="text-[11px] text-muted-foreground capitalize">{k}</span>
                    <span className="text-xs text-foreground font-medium">{v !== undefined && v !== null && v !== '' ? String(v) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ==================== COLUMNS DROPDOWN ====================
const COMPULSORY_KEYS = ['CREATED_AT', 'NAME', 'PHONE', 'SOURCE', 'STATUS', 'TAGS', 'OPT_IN', 'ASSIGNED_TO', 'EMAIL'];

const withSourceColumn = (columns: string[]) => {
  const next = columns.filter(key => key !== 'SOURCE' && key !== 'CUSTOM_SOURCE');
  const phoneIndex = next.indexOf('PHONE');
  next.splice(phoneIndex >= 0 ? phoneIndex + 1 : next.length, 0, 'SOURCE');
  return next;
};

interface ColumnOption {
  id?: string;
  key: string;
  label: string;
  icon: ElementType;
  compulsory: boolean;
  visible?: boolean;
}

const INITIAL_COLUMN_OPTIONS: ColumnOption[] = [
  { key: 'CREATED_AT', label: 'Created', icon: Calendar, compulsory: true, visible: true },
  { key: 'NAME', label: 'Name', icon: User, compulsory: true, visible: true },
  { key: 'PHONE', label: 'Phone', icon: Phone, compulsory: true, visible: true },
  { key: 'SOURCE', label: 'Source', icon: Globe, compulsory: true, visible: true },
  { key: 'COUNTRY_CODE', label: 'Country Code', icon: Globe, compulsory: false, visible: false },
  { key: 'STATUS', label: 'Status', icon: Tag, compulsory: true, visible: true },
  { key: 'TAGS', label: 'Tags', icon: Tag, compulsory: true, visible: true },
  { key: 'OPT_IN', label: 'Opt In', icon: Check, compulsory: true, visible: true },
  { key: 'ASSIGNED_TO', label: 'Assigned To', icon: User, compulsory: true, visible: true },
  { key: 'EMAIL', label: 'Email', icon: AtSign, compulsory: true, visible: true },
];

const INITIAL_DEFAULT_COLUMNS = [...COMPULSORY_KEYS];
// ==================== MAIN PAGE ====================
export default function ContactsPage() {
  const router = useRouter();
  const { setSelectedContacts } = useBroadcastStore();

  // Data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPreparingBroadcast, setIsPreparingBroadcast] = useState(false);
  const preparingBroadcastRef = useRef(false);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, total_pages: 0 });


  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectingCount, setIsSelectingCount] = useState(false);
  const countSelectionRef = useRef<{ controller: AbortController; count: number } | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [selectAllPages, setSelectAllPages] = useState(false);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

  // Columns
  const [columnOptions, setColumnOptions] = useState<ColumnOption[]>(INITIAL_COLUMN_OPTIONS);
  const [defaultColumns, setDefaultColumns] = useState(INITIAL_DEFAULT_COLUMNS);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(INITIAL_DEFAULT_COLUMNS);
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const columnsRef = useRef<HTMLDivElement>(null);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);

  // Phone dropdown state
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);
  const phoneDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);

  // Assign dropdown state
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [acceptedTeamMembers, setAcceptedTeamMembers] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // Assign Tags dropdown state
  const [showAssignTagsDropdown, setShowAssignTagsDropdown] = useState(false);
  const [selectedBulkTagIds, setSelectedBulkTagIds] = useState<string[]>([]);
  const [assignTagsLoading, setAssignTagsLoading] = useState(false);
  const assignTagsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showAssignDropdown) return;
    const handler = (e: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssignDropdown]);

  useEffect(() => {
    if (!showAssignTagsDropdown) return;
    const handler = (e: MouseEvent) => {
      if (assignTagsDropdownRef.current && !assignTagsDropdownRef.current.contains(e.target as Node)) {
        setShowAssignTagsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssignTagsDropdown]);

  useEffect(() => {
    if (!showPhoneDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        phoneDropdownRef.current && !phoneDropdownRef.current.contains(e.target as Node) &&
        phoneDropdownButtonRef.current && !phoneDropdownButtonRef.current.contains(e.target as Node)
      ) {
        setShowPhoneDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPhoneDropdown]);

  // Load saved columns on mount
  useEffect(() => {
    const stored = localStorage.getItem('contacts_selected_columns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = withSourceColumn(parsed.filter((k: string) => k !== 'COUNTRY_CODE'));
          setSelectedColumns(filtered);
          localStorage.setItem('contacts_selected_columns', JSON.stringify(filtered));
        }
      } catch (err) {
        console.error('Error parsing contacts_selected_columns from localStorage:', err);
      }
    }
  }, []);

  const defaultFilters: Filters = {
    searchNamePhone: '', email: '', phone: '', createdDate: '', reminderDate: '', assignedDate: '',
    source: [], assignedTo: '', assigned_to: [], tags: [], lists: [], status: '', country_code: [],
    optInStatus: 'all', duplicate: 'all',
    showUnassignedOnly: false, filterGroups: [], custom_fields: {},
  };
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  // Sync URL query parameters (e.g. ?source=instagram or ?status=lead) into filters
  const searchParams = useSearchParams();
  useEffect(() => {
    const urlSource = searchParams?.get('source');
    const urlStatus = searchParams?.get('status');
    const urlAssigned_to = searchParams?.get('assigned_to');
    const urlSearch = searchParams?.get('search') || searchParams?.get('q');

    if (urlSource || urlStatus || urlAssigned_to || urlSearch) {
      setFilters(prev => ({
        ...prev,
        source: urlSource ? [urlSource] : prev.source,
        status: urlStatus || prev.status,
        assigned_to: urlAssigned_to ? [urlAssigned_to] : prev.assigned_to,
        searchNamePhone: urlSearch || prev.searchNamePhone,
      }));

      if (urlSearch) {
        setSearchQuery(urlSearch);
      }
    }
  }, [searchParams]);

  const availableTagsRef = useRef(availableTags);
  availableTagsRef.current = availableTags;

  const pipelineStagesRef = useRef(pipelineStages);
  pipelineStagesRef.current = pipelineStages;

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const paginationLimitRef = useRef(pagination.limit);
  paginationLimitRef.current = pagination.limit;

  const phoneNumbersRef = useRef(phoneNumbers);
  phoneNumbersRef.current = phoneNumbers;

  const contactListsRef = useRef(contactLists);
  contactListsRef.current = contactLists;

  const selectedPhoneNumberIdRef = useRef(selectedPhoneNumberId);
  selectedPhoneNumberIdRef.current = selectedPhoneNumberId;

  useEffect(() => {
    countSelectionRef.current?.controller.abort();
    countSelectionRef.current = null;
    setIsSelectingCount(false);
    return () => { countSelectionRef.current?.controller.abort(); };
  }, [contacts, searchQuery, filters, selectedPhoneNumberId]);

  const getToken = useCallback(() => {
    let token = localStorage.getItem('console_access_token');
    if (token?.startsWith('"') && token?.endsWith('"')) token = token.slice(1, -1);
    return token;
  }, []);

  const getFilterParams = useCallback((page = 1, limit = 50, search = '', overrideFilters?: Filters) => {
    const activeFilters = overrideFilters || filtersRef.current;
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    params.append('sortBy', 'created_at');
    params.append('sortOrder', 'desc');

    const searchTerm = search || activeFilters.searchNamePhone;
    if (searchTerm) params.append('search', searchTerm);
    if (activeFilters.email) params.append('email', activeFilters.email);
    if (activeFilters.phone) params.append('phone', activeFilters.phone);
    if (activeFilters.createdDate) params.append('created_date', activeFilters.createdDate);
    if (activeFilters.reminderDate) params.append('reminder_date', activeFilters.reminderDate);
    if (activeFilters.assignedDate) params.append('assigned_date', activeFilters.assignedDate);
    if (activeFilters.status) params.append('status', activeFilters.status);

    if (activeFilters.source.length > 0) {
      activeFilters.source.forEach(s => params.append('source', s));
    }
    if (activeFilters.assignedTo) {
      params.append('assigned_to', activeFilters.assignedTo);
    }
    if (activeFilters.assigned_to && activeFilters.assigned_to.length > 0) {
      activeFilters.assigned_to.forEach(a => {
        if (a) params.append('assigned_to', a);
      });
    }
    if (activeFilters.tags.length > 0) {
      activeFilters.tags.forEach(t => params.append('tag_ids', t));
      activeFilters.tags.forEach(t => params.append('tags', t));
    }
    if (activeFilters.lists && activeFilters.lists.length > 0) {
      activeFilters.lists.forEach(l => {
        if (l) params.append('list_ids', l);
      });
    }
    if (activeFilters.country_code.length > 0) {
      activeFilters.country_code.forEach(c => params.append('country_code', c));
      activeFilters.country_code.forEach(c => params.append('country_codes', c));
    }
    if (activeFilters.optInStatus !== 'all') {
      const isOptedOut = activeFilters.optInStatus === 'true' || activeFilters.optInStatus === 'opted-out' || activeFilters.optInStatus === 'not-opted-in';
      params.append('opt_in_status', isOptedOut ? 'false' : 'true');
      params.append('is_opted_out', isOptedOut ? 'true' : 'false');
    }
    if (activeFilters.duplicate === 'show-duplicates') {
      params.append('duplicates', 'true');
    } else if (activeFilters.duplicate === 'hide-duplicates') {
      params.append('duplicates', 'false');
    }
    if (activeFilters.showUnassignedOnly) {
      params.append('unassigned_only', 'true');
    }
    if (activeFilters.custom_fields) {
      Object.entries(activeFilters.custom_fields).forEach(([k, v]) => {
        if (v && v.trim()) {
          params.append(`custom_field_${k}`, v.trim());
          params.append(k, v.trim());
        }
      });
    }
    return params;
  }, []);

  const handleDeleteAll = async () => {
    if (selectedIds.length === 0 && !selectAllPages) {
      toast.error('No contacts selected');
      return;
    }
    setShowBulkDeleteModal(true);
  };

  const executeBulkDelete = async () => {
    setIsDeleting(true);
    const toastId = toast.loading('Preparing contacts for deletion...');
    try {
      let idsToDelete: string[] = [];
      if (selectAllPages) {
        let page = 1;
        const fetchLimit = 500;
        let totalPages = 1;

        while (page <= totalPages) {
          const params = getFilterParams(page, fetchLimit, searchQuery);
          const url = selectedPhoneNumberId === 'all'
            ? `/admin/contacts?${params.toString()}`
            : `/admin/contacts/${selectedPhoneNumberId}?${params.toString()}`;

          const res = await soft7AxiosInstance.get(url);
          if (res.data.success && res.data.data) {
            const pageContacts: Contact[] = res.data.data.contacts || [];
            const pagePagination = res.data.data.pagination;
            totalPages = pagePagination?.total_pages || 1;

            pageContacts.forEach(c => {
              if (!excludedIds.includes(c.id)) {
                idsToDelete.push(c.id);
              }
            });
          } else {
            break;
          }
          page++;
        }
      } else {
        idsToDelete = [...selectedIds];
      }

      if (idsToDelete.length === 0) {
        toast.error('No contacts to delete', { id: toastId });
        setShowBulkDeleteModal(false);
        setIsDeleting(false);
        return;
      }

      toast.loading(`Deleting ${idsToDelete.length} contact(s)...`, { id: toastId });

      const res = await soft7AxiosInstance.delete('/admin/contacts', {
        data: { ids: idsToDelete },
      });
      const deletedCount = res?.data?.data?.deletedCount ?? idsToDelete.length;

      toast.success(`Successfully deleted ${deletedCount} contact(s)`, { id: toastId });
      setSelectedIds([]);
      setSelectAllPages(false);
      setExcludedIds([]);
      setSelectedContact(null);
      setShowBulkDeleteModal(false);
      await fetchContacts(1, searchQuery);
    } catch (error) {
      console.error('Failed to delete contacts:', error);
      toast.error('An error occurred while deleting contacts', { id: toastId });
      await fetchContacts(1, searchQuery);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusUpdate = useCallback((contactId: string, newStatus: string) => {
  setContacts(prevContacts => 
    prevContacts.map(contact => 
      contact.id === contactId 
        ? { ...contact, status: newStatus }
        : contact
    )
  );
}, []);

  const handleOptOutToggle = async (contact: Contact, isOptedOut: boolean) => {
    try {
      try {
        await soft7AxiosInstance.put(`/admin/contacts/${contact.id}/opt-in-out`, {
          is_opted_out: isOptedOut,
        });
      } catch {
        await soft7AxiosInstance.put(`/contacts/${contact.id}/opt-in-out`, {
          is_opted_out: isOptedOut,
        });
      }

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? { ...c, is_opted_out: isOptedOut, opt_in: !isOptedOut, is_opted_in: !isOptedOut }
            : c
        )
      );

      toast.success(
        isOptedOut
          ? `Contact "${contact.name}" marked as Opted Out`
          : `Contact "${contact.name}" marked as Opted In`
      );
    } catch (err: any) {
      console.error("Opt-in-out toggle error:", err);
      toast.error(err?.response?.data?.message || "Failed to update opt status");
    }
  };

  const handleSalesPipeline = () => {
    
    // Implement sales pipeline logic here
    router.push('/user/contacts/sales-pipeline');  
  };

  // Click-outside for columns d  pdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        showColumnsDropdown &&
        columnsRef.current && !columnsRef.current.contains(e.target as Node) &&
        columnsButtonRef.current && !columnsButtonRef.current.contains(e.target as Node)
      ) {
        setShowColumnsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnsDropdown]);

const contactMatchesFilters = (
  contact: Contact,
  filters: Filters,
  availableTags: TagData[],
  stages: PipelineStage[],
  phoneNumbersList: any[] = [],
  selectedPhoneId: string = 'all',
  contactListsList: any[] = []
): boolean => {
  // 0. Selected Phone Number Filter
  if (selectedPhoneId && selectedPhoneId !== 'all') {
    const selectedPn = phoneNumbersList.find(p => String(p.id) === String(selectedPhoneId) || String(p.phone_number_id) === String(selectedPhoneId));
    const validIdentifiers = new Set<string>();
    validIdentifiers.add(String(selectedPhoneId).toLowerCase());
    if (selectedPn) {
      if (selectedPn.id) validIdentifiers.add(String(selectedPn.id).toLowerCase());
      if (selectedPn.phone_number_id) validIdentifiers.add(String(selectedPn.phone_number_id).toLowerCase());
    }

    const contactPnId = (contact.phone_number_id || '').toString().toLowerCase();

    if (contactPnId && !validIdentifiers.has(contactPnId)) {
      return false;
    }
  }

  // 1. Search Query (name or phone)
  if (filters.searchNamePhone?.trim()) {
    const q = filters.searchNamePhone.trim().toLowerCase();
    const nameMatch = contact.name?.toLowerCase().includes(q);
    const phoneMatch = contact.phone_number?.includes(q);
    if (!nameMatch && !phoneMatch) return false;
  }

  // 1b. Email Filter
  if (filters.email?.trim()) {
    const emailQ = filters.email.trim().toLowerCase();
    if (!contact.email || !contact.email.toLowerCase().includes(emailQ)) {
      return false;
    }
  }

  // 1c. Phone Filter
  if (filters.phone?.trim()) {
    const phoneQ = filters.phone.trim();
    if (!contact.phone_number || !contact.phone_number.includes(phoneQ)) {
      return false;
    }
  }

  // 2. Created Date
  if (filters.createdDate) {
    if (!contact.created_at || !contact.created_at.startsWith(filters.createdDate)) {
      return false;
    }
  }

  // 3. Status
  if (filters.status) {
    const contactStatus = (contact.status || '').toLowerCase().trim();
    const filterStatus = filters.status.toLowerCase().trim();
    const stage = stages.find(s => s.id === filters.status || s.name.toLowerCase() === filterStatus);
    const stageName = stage?.name.toLowerCase() || '';
    const stageId = stage?.id.toLowerCase() || '';

    if (contactStatus !== filterStatus && contactStatus !== stageId && contactStatus !== stageName) {
      return false;
    }
  }

  // 4. Source
  if (filters.source && filters.source.length > 0) {
    const contactSource = (contact.attributes?.source || (contact as any).source || '').toString().toLowerCase().trim();
    const matchesSource = filters.source.some(s => s.toLowerCase().trim() === contactSource);
    if (!matchesSource) return false;
  }

  // 5. Country Code
  if (filters.country_code && filters.country_code.length > 0) {
    const { countryCode } = getPhoneDetails(contact.phone_number, (contact as any).country_code);
    const cleanCountryCode = countryCode.replace(/[^\d]/g, '');
    const rawPhoneClean = (contact.phone_number || '').replace(/[^\d]/g, '');

    const matchesCountry = filters.country_code.some(code => {
      const cleanFilterCode = code.replace(/[^\d]/g, '');
      return (cleanCountryCode && cleanCountryCode === cleanFilterCode) || (cleanFilterCode && rawPhoneClean.startsWith(cleanFilterCode));
    });
    if (!matchesCountry) return false;
  }

  // 6. Tags
  if (filters.tags && filters.tags.length > 0) {
    if (!contact.tags || contact.tags.length === 0) return false;

    const contactTags = contact.tags.map(t => (typeof t === 'string' ? t : (t as any)?.name || (t as any)?.id || '').toString());

    const selectedTagIdentifiers = filters.tags.flatMap(tagIdOrName => {
      const foundTag = availableTags.find(t => String(t.id) === String(tagIdOrName) || t.name === tagIdOrName);
      if (foundTag) {
        return [String(foundTag.id).toLowerCase(), foundTag.name.toLowerCase()];
      }
      return [String(tagIdOrName).toLowerCase()];
    });

    const matchesTag = contactTags.some(ct => {
      const ctLower = ct.toLowerCase();
      return selectedTagIdentifiers.includes(ctLower);
    });

    if (!matchesTag) return false;
  }

  // 6.5. Contact Lists
  if (filters.lists && filters.lists.length > 0) {
    const contactListId = ((contact as any).list_id || (contact as any).listId || (contact as any).list_ids || '').toString().toLowerCase();
    const contactListName = ((contact as any).list_name || (contact as any).listName || '').toString().toLowerCase();

    if (contactListId || contactListName) {
      const selectedListIdentifiers = filters.lists.flatMap(listIdOrName => {
        const foundList = (contactListsList || []).find((l: any) => String(l.id) === String(listIdOrName) || l.name === listIdOrName);
        if (foundList) {
          return [String(foundList.id).toLowerCase(), (foundList.name || '').toLowerCase()];
        }
        return [String(listIdOrName).toLowerCase()];
      });

      const matchesList = selectedListIdentifiers.includes(contactListId) || (contactListName && selectedListIdentifiers.includes(contactListName));
      if (!matchesList) return false;
    }
  }

  // 7. Assigned To
  if (filters.assigned_to && filters.assigned_to.length > 0) {
    const filterAssigned = filters.assigned_to[0].toLowerCase().trim();
    if (filterAssigned) {
      const contactAssigned = Array.isArray(contact.assigned_to)
        ? contact.assigned_to.map(a => String(a).toLowerCase().trim())
        : [String(contact.assigned_to || '').toLowerCase().trim()];
      if (!contactAssigned.some(a => a.includes(filterAssigned))) return false;
    }
  }

  // 8. Show Unassigned Only
  if (filters.showUnassignedOnly) {
    if (Array.isArray(contact.assigned_to) ? contact.assigned_to.length > 0 : Boolean(contact.assigned_to && String(contact.assigned_to).trim() !== '')) return false;
  }

  // 9. Opt-Out / Opt-In Status
  if (filters.optInStatus && filters.optInStatus !== 'all') {
    const isOptedOut = (contact as any).is_opted_out ?? (!((contact as any).opt_in ?? (contact as any).is_opted_in ?? true));
    if ((filters.optInStatus === 'true' || filters.optInStatus === 'opted-out' || filters.optInStatus === 'not-opted-in') && !isOptedOut) return false;
    if ((filters.optInStatus === 'false' || filters.optInStatus === 'opted-in') && isOptedOut) return false;
  }

  // 10. Custom Fields
  if (filters.custom_fields) {
    for (const [k, v] of Object.entries(filters.custom_fields)) {
      if (!v || !v.trim()) continue;
      const targetVal = getCustomFieldValue(contact, { key: k, label: k });
      if (!targetVal || !String(targetVal).toLowerCase().includes(v.trim().toLowerCase())) {
        return false;
      }
    }
  }

  return true;
};

const fetchContacts = useCallback(async (
  page = 1, 
  search = '', 
  limitOverride?: number, 
  overrideFilters?: Filters, 
  overridePhoneId?: string
) => {
  setIsLoading(true);
  try {
    const limitToUse = limitOverride || paginationLimitRef.current;
    const currentFilters = overrideFilters || filtersRef.current;
    const targetPhoneId = overridePhoneId !== undefined ? overridePhoneId : selectedPhoneNumberIdRef.current;
    const params = getFilterParams(page, limitToUse, search, currentFilters);
    const url = targetPhoneId === 'all' 
      ? `/admin/contacts?${params.toString()}`
      : `/admin/contacts/${targetPhoneId}?${params.toString()}`;
    
    const res = await soft7AxiosInstance.get(url);
    
    if (res.data.success && res.data.data) {
      const rawContacts: Contact[] = res.data.data.contacts || [];
      const currentTags = availableTagsRef.current;
      const currentStages = pipelineStagesRef.current;
      const currentPhones = phoneNumbersRef.current;
      const currentLists = contactListsRef.current;

      const filtered = rawContacts.filter(c => contactMatchesFilters(c, currentFilters, currentTags, currentStages, currentPhones, targetPhoneId, currentLists));
      
      setContacts(filtered);

      // Dynamically discover and register any custom_fields or attributes keys into columnOptions & selectedColumns
      setColumnOptions(prevCols => {
        const existingLabels = new Set(prevCols.map(c => c.label.toLowerCase().trim()));
        const existingKeys = new Set(prevCols.map(c => c.key));
        const newCols = [...prevCols];
        let hasNew = false;
        const newKeys: string[] = [];

        rawContacts.forEach(c => {
          const mergedFields = {
            ...(c.attributes && typeof c.attributes === 'object' ? c.attributes : {}),
            ...(c.custom_fields && typeof c.custom_fields === 'object' ? c.custom_fields : {}),
          };

          Object.keys(mergedFields).forEach(fieldKey => {
            if (!fieldKey) return;
            const normKey = fieldKey.toLowerCase().trim();

            const isCompulsoryLabel = [
              'created', 'created at', 'created_at', 'created date',
              'name', 'phone', 'phone number', 'phone_number', 'source',
              'status', 'tags', 'tag', 'email', 'opt in', 'opt_in', 'optin',
              'assigned to', 'assigned_to', 'assigned'
            ].includes(normKey);

            if (!isCompulsoryLabel && !existingLabels.has(normKey)) {
              existingLabels.add(normKey);
              const colKey = `CUSTOM_${fieldKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

              // Check if column definition in columnOptions has visible === false
              const matchingColDef = columnOptions.find(
                (c) => c.key === colKey || c.label?.toLowerCase().trim() === normKey
              );
              const isVis = matchingColDef ? matchingColDef.visible !== false : true;

              if (!existingKeys.has(colKey) && isVis) {
                existingKeys.add(colKey);
                newCols.push({
                  key: colKey,
                  label: fieldKey,
                  icon: List,
                  compulsory: false,
                  visible: true,
                });
                newKeys.push(colKey);
                hasNew = true;
              }
            }
          });
        });

        if (hasNew && newKeys.length > 0) {
          setSelectedColumns((prevSel) => {
            const updatedSel = Array.from(new Set([...prevSel, ...newKeys]));
            localStorage.setItem("contacts_selected_columns", JSON.stringify(updatedSel));
            return updatedSel;
          });
        }
        return newCols;
      });

      const serverPagination = res.data.data.pagination || { total: rawContacts.length, page, limit: limitToUse, total_pages: 1 };

      const hasActiveFilters = Boolean(
        search ||
        currentFilters.searchNamePhone ||
        currentFilters.email ||
        currentFilters.phone ||
        currentFilters.createdDate ||
        currentFilters.reminderDate ||
        currentFilters.assignedDate ||
        currentFilters.status ||
        currentFilters.source.length > 0 ||
        (Array.isArray(currentFilters.assigned_to) ? currentFilters.assigned_to.length > 0 : Boolean(currentFilters.assigned_to)) ||
        (currentFilters.assignedTo && currentFilters.assignedTo.trim() !== '') ||
        currentFilters.tags.length > 0 ||
        (currentFilters.lists && currentFilters.lists.length > 0) ||
        currentFilters.country_code.length > 0 ||
        currentFilters.optInStatus !== "all" ||
        currentFilters.duplicate !== "all" ||
        currentFilters.showUnassignedOnly
      );

      if (hasActiveFilters && filtered.length < rawContacts.length) {
        setPagination({
          ...serverPagination,
          total: filtered.length,
          total_pages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / limitToUse),
        });
      } else if (hasActiveFilters && filtered.length === 0) {
        setPagination({
          ...serverPagination,
          total: 0,
          total_pages: 0,
        });
      } else {
        setPagination(serverPagination);
      }
    } else {
      setContacts([]);
      setPagination((prev) => ({ ...prev, total: 0, total_pages: 0 }));
    }
  } catch (error) {
    console.error("Failed to load contacts:", error);
    setContacts([]);
    setPagination((prev) => ({ ...prev, total: 0, total_pages: 0 }));
  } finally {
    setIsLoading(false);
  }
}, [getFilterParams, selectedPhoneNumberId]);

  const fetchDynamicColumns = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get("/admin/columns/");
      const extraOptions: any[] = [];

      if (res.data.success && res.data.data) {
        const fetchedCols = Array.isArray(res.data.data) ? res.data.data : [];

        fetchedCols.forEach((col: any) => {
          const labelLower = (col.label || "").toLowerCase().trim();
          const isCompulsoryLabel = [
            "created", "created at", "created_at", "created date",
            "name",
            "phone", "phone number", "phone_number", "source",
            "status",
            "tags", "tag",
            "email",
            "opt in", "opt_in", "optin",
            "assigned to", "assigned_to", "assigned"
          ].includes(labelLower);

          const isIgnoredLabel = [
            "no.2", "no 2", "no. 2", "no2", "unnamed", "untitled"
          ].includes(labelLower) || labelLower.startsWith("no.");

          if (!isCompulsoryLabel && !isIgnoredLabel && col.label) {
            const key = `CUSTOM_${col.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
            const isVis = col.visible === true || String(col.visible).toLowerCase() === "true" || col.visible === 1;

            if (isVis && !extraOptions.some((c) => c.key === key)) {
              extraOptions.push({
                id: col.id || col._id,
                key,
                label: col.label,
                icon: List,
                compulsory: false,
                visible: true,
              });
            }
          }
        });
      }

      const allColumnOptions = [...INITIAL_COLUMN_OPTIONS, ...extraOptions];
      setColumnOptions(allColumnOptions);

      const stored = localStorage.getItem("contacts_selected_columns");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Strictly exclude any column definition that is no longer visible
            const validSelected = withSourceColumn(parsed.filter((key: string) => {
              const colDef = allColumnOptions.find((col) => col.key === key);
              return colDef && colDef.visible !== false;
            }));
            setSelectedColumns(validSelected);
            localStorage.setItem("contacts_selected_columns", JSON.stringify(validSelected));
          }
        } catch (err) {
          console.error("Error parsing contacts_selected_columns:", err);
        }
      } else {
        const defaultSelected = [
          ...INITIAL_DEFAULT_COLUMNS,
          ...extraOptions.map((col) => col.key),
        ];
        setSelectedColumns(defaultSelected);
        localStorage.setItem("contacts_selected_columns", JSON.stringify(defaultSelected));
      }
    } catch (error) {
      console.error("Failed to fetch dynamic columns:", error);
    }
  }, []);

  const handleDeleteCustomColumn = async (colKey: string, colId?: string) => {
    try {
      if (colId) {
        try {
          await soft7AxiosInstance.delete(`/admin/columns/${colId}`);
        } catch (e: any) {
          if (e?.response?.status === 404 || e?.response?.status === 301 || e?.response?.status === 308) {
            await soft7AxiosInstance.delete(`/admin/columns/${colId}/`);
          } else {
            throw e;
          }
        }
      }
      setColumnOptions(prev => prev.filter(c => c.key !== colKey));
      setSelectedColumns(prev => {
        const next = prev.filter(k => k !== colKey);
        localStorage.setItem('contacts_selected_columns', JSON.stringify(next));
        return next;
      });
      toast.success('Column deleted successfully');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete column');
    }
  };

  const fetchTags = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get('/admin/contacts/tags');
      if (res.data.success) setAvailableTags(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchPhoneNumbers = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get('/admin/waba/phone-numbers');
      if (res.data) {
        const data = res.data;
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.data?.data) ? data.data.data
          : Array.isArray(data?.data) ? data.data
          : [];
        setPhoneNumbers(list);
      }
    } catch (err) {
      console.error("Failed to fetch phone numbers:", err);
    }
  }, []);

  const fetchPipelineStages = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get('/admin/pipeline');
      if (res.data?.success) {
        const sortedStages = (res.data.data || []).sort((a: any, b: any) => a.position - b.position);
        setPipelineStages(sortedStages);
      }
    } catch (e) {
      console.error('Failed to fetch pipeline stages:', e);
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const resInvites = await soft7AxiosInstance.get('/admin/team/invites');
      const rawInv = resInvites.data?.data?.data ?? resInvites.data?.data ?? resInvites.data ?? [];
      const list = Array.isArray(rawInv) ? rawInv : [];
      const mapped = list.map((m: any) => ({
        id: m.user_id || m.id || m.userId,
        user_id: m.user_id || m.id || m.userId,
        name: m.name || m.invitee_email || m.email || m.user?.name || m.user?.email || 'Team Member',
        email: m.email || m.invitee_email || m.user?.email,
        status: m.status || m.invite_status,
      }));
      setAcceptedTeamMembers(mapped);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  }, []);

  const fetchContactLists = useCallback(async () => {
    try {
      const res = await soft7AxiosInstance.get('/admin/contacts/lists');
      const data = res.data?.data?.data || res.data?.data || res.data || [];
      if (Array.isArray(data)) {
        setContactLists(data);
      }
    } catch (err) {
      console.error("Failed to fetch contact lists:", err);
    }
  }, []);

  // Initial load - run once on mount
  useEffect(() => {
    fetchContacts(1, '');
    fetchTags();
    fetchDynamicColumns();
    fetchPipelineStages();
    fetchPhoneNumbers();
    fetchTeamMembers();
    fetchContactLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  const isSearchFirstMount = useRef(true);
  useEffect(() => {
    if (isSearchFirstMount.current) {
      isSearchFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchContacts(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchContacts]);

  const handleRefresh = async () => {
    await fetchContacts(pagination.page, searchQuery);
    await fetchTags();
    toast.success('Refreshed successfully');
  };

  const handlePhoneSelect = (phoneId: string) => {
    setSelectedPhoneNumberId(phoneId);
    selectedPhoneNumberIdRef.current = phoneId;
    setShowPhoneDropdown(false);
    setSelectAllPages(false);
    setSelectedIds([]);
    setExcludedIds([]);
    fetchContacts(1, searchQuery, undefined, undefined, phoneId);
  };

  const handleAssignMultiple = async (memberId: string) => {
    if (selectedIds.length === 0 && !selectAllPages) {
      toast.error("Please select at least one contact");
      return;
    }
    if (!memberId) {
      toast.error("Please select a team member");
      return;
    }
    setAssignLoading(true);
    const toastId = toast.loading("Assigning contacts...");
    try {
      let targetContacts = contacts.filter(c => selectedIds.includes(c.id));
      
      if (selectAllPages) {
        const params = getFilterParams(1, pagination.total || 1000, searchQuery);
        const url = selectedPhoneNumberId === 'all'
          ? `/admin/contacts?${params.toString()}`
          : `/admin/contacts/${selectedPhoneNumberId}?${params.toString()}`;
        const res = await soft7AxiosInstance.get(url);
        if (res.data.success && res.data.data?.contacts) {
          targetContacts = res.data.data.contacts;
        }
      }

      const assignOne = (contact: any) =>
        soft7AxiosInstance.put(`/admin/contacts/${contact.id}`, {
          name: contact.name,
          phone_number: contact.phone_number,
          assigned_to: [memberId],
        });

      // Firing every PUT at once overloads the API and some silently fail, so send in small batches.
      const BATCH_SIZE = 5;
      const runBatches = async (list: any[]) => {
        const failed: any[] = [];
        for (let i = 0; i < list.length; i += BATCH_SIZE) {
          const batch = list.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(batch.map(assignOne));
          results.forEach((r, idx) => {
            if (r.status === 'rejected') {
              const e: any = r.reason;
              console.error(`Assign failed for contact ${batch[idx].name}:`, e?.response?.data?.message || e?.message);
              failed.push(batch[idx]);
            }
          });
        }
        return failed;
      };

      let failed = await runBatches(targetContacts);
      if (failed.length > 0) failed = await runBatches(failed);

      const memberObj = acceptedTeamMembers.find((m: any) => String(m.user_id || m.id || m.userId) === String(memberId));
      const memberName = memberObj ? (memberObj.name || memberObj.invitee_email || memberObj.email) : "Team Member";

      if (failed.length === 0) {
        toast.success(`Successfully assigned ${targetContacts.length} contacts to ${memberName}`, { id: toastId });
      } else if (failed.length === targetContacts.length) {
        toast.error(`Failed to assign contacts to ${memberName}`, { id: toastId });
      } else {
        toast.error(`Assigned ${targetContacts.length - failed.length} of ${targetContacts.length} contacts to ${memberName}; ${failed.length} failed`, { id: toastId });
      }
      setShowAssignDropdown(false);
      setSelectedIds([]);
      setSelectAllPages(false);
      await fetchContacts(pagination.page, searchQuery);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign contacts", { id: toastId });
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignTags = async (tagIdsToAssign: string[]) => {
    if (selectedIds.length === 0 && !selectAllPages) {
      toast.error("Please select at least one contact");
      return;
    }
    if (tagIdsToAssign.length === 0) {
      toast.error("Please select at least one tag");
      return;
    }
    setAssignTagsLoading(true);
    const toastId = toast.loading("Assigning tags...");
    try {
      let targetContactIds: string[] = [];

      if (selectAllPages) {
        let page = 1;
        const fetchLimit = 500;
        let totalPages = 1;

        while (page <= totalPages) {
          const params = getFilterParams(page, fetchLimit, searchQuery);
          const url = selectedPhoneNumberId === 'all'
            ? `/admin/contacts?${params.toString()}`
            : `/admin/contacts/${selectedPhoneNumberId}?${params.toString()}`;

          const res = await soft7AxiosInstance.get(url);
          if (res.data.success && res.data.data) {
            const pageContacts: Contact[] = res.data.data.contacts || [];
            const pagePagination = res.data.data.pagination;
            totalPages = pagePagination?.total_pages || 1;

            pageContacts.forEach(c => {
              if (!excludedIds.includes(c.id)) {
                targetContactIds.push(c.id);
              }
            });
          } else {
            break;
          }
          page++;
        }
      } else {
        targetContactIds = [...selectedIds];
      }

      if (targetContactIds.length === 0) {
        toast.error("No contacts selected", { id: toastId });
        setAssignTagsLoading(false);
        return;
      }

      const payload = {
        contact_ids: targetContactIds,
        tag_ids: tagIdsToAssign,
        tag_id: tagIdsToAssign[0] || "",
        tags: tagIdsToAssign,
      };

      const res = await soft7AxiosInstance.post("/admin/contacts/bulk/tags", payload);

      if (res.data?.success || res.status === 200 || res.status === 201) {
        toast.success(`Successfully assigned tags to ${targetContactIds.length} contact(s)`, { id: toastId });
        setShowAssignTagsDropdown(false);
        setSelectedBulkTagIds([]);
        setSelectedIds([]);
        setSelectAllPages(false);
        setExcludedIds([]);
        await fetchContacts(pagination.page, searchQuery);
      } else {
        toast.error(res.data?.message || "Failed to assign tags", { id: toastId });
      }
    } catch (err: any) {
      console.error("Failed to assign tags:", err);
      toast.error(err?.response?.data?.message || "Failed to assign tags", { id: toastId });
    } finally {
      setAssignTagsLoading(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;
    setIsDeleting(true);
    try {
      await soft7AxiosInstance.delete(`/admin/contacts/${contactToDelete.id}`);
      toast.success('Contact deleted');
      setShowDeleteModal(false);
      setContactToDelete(null);
      if (selectedContact?.id === contactToDelete.id) setSelectedContact(null);
      await fetchContacts(pagination.page, searchQuery);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.total_pages) {
      fetchContacts(page, searchQuery);
    }
  };

  const handleSelectCountChange = async (count: number) => {
    const boundedCount = Math.min(Math.max(0, Math.trunc(count)), pagination.total);
    if (!Number.isFinite(boundedCount)) return;
    if (countSelectionRef.current?.count === boundedCount) return;
    if (!countSelectionRef.current && !selectAllPages && selectedIds.length === boundedCount) return;
    countSelectionRef.current?.controller.abort();
    countSelectionRef.current = null;
    setIsSelectingCount(false);
    setSelectAllPages(false);
    setExcludedIds([]);

    if (boundedCount <= contacts.length) {
      setSelectedIds(contacts.slice(0, boundedCount).map(c => c.id));
      return;
    }

    // Keep explicit IDs for a requested count so bulk actions use exactly that audience.
    const controller = new AbortController();
    countSelectionRef.current = { controller, count: boundedCount };
    setSelectedIds([]);
    setIsSelectingCount(true);
    const activeFilters = filtersRef.current;
    const phoneId = selectedPhoneNumberIdRef.current;
    try {
      const ids = await selectContactCount(boundedCount, contacts, async (page) => {
        const params = getFilterParams(page, 500, searchQuery, activeFilters);
        const url = phoneId === 'all'
          ? `/admin/contacts?${params.toString()}`
          : `/admin/contacts/${phoneId}?${params.toString()}`;
        const res = await soft7AxiosInstance.get(url, { signal: controller.signal });
        if (!res.data.success || !Array.isArray(res.data.data?.contacts)) {
          throw new Error('Failed to load contacts for selection');
        }
        const pageContacts: Contact[] = res.data.data.contacts;
        return {
          contacts: pageContacts.filter(c => contactMatchesFilters(c, activeFilters,
            availableTagsRef.current, pipelineStagesRef.current,
            phoneNumbersRef.current, phoneId, contactListsRef.current)),
          totalPages: res.data.data.pagination?.total_pages || 1,
        };
      }, controller.signal);
      if (!controller.signal.aborted) setSelectedIds(ids);
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : 'Failed to select contacts');
      }
    } finally {
      if (countSelectionRef.current?.controller === controller) {
        countSelectionRef.current = null;
        setIsSelectingCount(false);
      }
    }
  };

  const updateFiltersAndFetch = useCallback((newFilters: Filters, searchOverride?: string) => {
    filtersRef.current = newFilters;
    setFilters(newFilters);
    const q = searchOverride !== undefined ? searchOverride : searchQuery;
    if (searchOverride !== undefined) setSearchQuery(searchOverride);
    fetchContacts(1, q, undefined, newFilters);
  }, [fetchContacts, searchQuery]);

  const handleFilterChange = (key: keyof Filters, value: Filters[keyof Filters]) =>
    setFilters(p => {
      const next = { ...p, [key]: value };
      filtersRef.current = next;
      return next;
    });

  const handleApplyFilters = () => {
    setShowFiltersModal(false);
    setSelectAllPages(false);
    setSelectedIds([]);
    setExcludedIds([]);
    updateFiltersAndFetch(filters);
  };

  const handleClearFilters = () => {
    setShowFiltersModal(false);
    setSelectAllPages(false);
    setSelectedIds([]);
    setExcludedIds([]);
    handlePhoneSelect('all');
    updateFiltersAndFetch(defaultFilters, '');
  };

  const handleBroadcast = async () => {
    if (preparingBroadcastRef.current) return;
    if (selectedIds.length === 0 && !selectAllPages) { toast.error('Select at least one contact'); return; }
    preparingBroadcastRef.current = true;
    setIsPreparingBroadcast(true);
    const toastId = toast.loading('Preparing selected contacts...');
    try {
      const selected = new Set(selectedIds);
      const excluded = new Set(excludedIds);
      const activeFilters = filtersRef.current;
      const phoneId = selectedPhoneNumberId;
      const resolved = new Map<string, Contact>();
      if (!selectAllPages) {
        contacts.forEach(c => { if (selected.has(c.id)) resolved.set(c.id, c); });
      }

      // The table contains one page only. Resolve the full filtered audience
      // before handing it to the campaign, which reads contacts from the store.
      if (selectAllPages || resolved.size < selected.size) {
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const params = getFilterParams(page, 500, searchQuery, activeFilters);
          const url = phoneId === 'all'
            ? `/admin/contacts?${params.toString()}`
            : `/admin/contacts/${phoneId}?${params.toString()}`;
          const res = await soft7AxiosInstance.get(url);
          if (!res.data.success || !Array.isArray(res.data.data?.contacts)) {
            throw new Error('Failed to load selected contacts');
          }
          const pageContacts: Contact[] = res.data.data.contacts;
          totalPages = res.data.data.pagination?.total_pages || 1;
          pageContacts.forEach(c => {
            const isSelected = selectAllPages ? !excluded.has(c.id) : selected.has(c.id);
            if (isSelected && contactMatchesFilters(c, activeFilters,
              availableTagsRef.current, pipelineStagesRef.current,
              phoneNumbersRef.current, phoneId, contactListsRef.current)) {
              resolved.set(c.id, c);
            }
          });
          page++;
        }
      }

      if (!selectAllPages && resolved.size !== selected.size) {
        throw new Error('Some selected contacts could not be loaded. Refresh contacts and try again.');
      }
      if (resolved.size === 0) {
        throw new Error('No selected contacts found');
      }
      setSelectedContacts(Array.from(resolved.values()).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone_number,
        phone_number: c.phone_number,
        country_code: c.country_code,
      })));
      toast.success(`${resolved.size} contacts ready for broadcast`, { id: toastId });
      router.push('/user/campaigns/create');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to prepare selected contacts', { id: toastId });
    } finally {
      preparingBroadcastRef.current = false;
      setIsPreparingBroadcast(false);
    }
  };

  const handleGetTags = async() =>{
    try{
      const res = await soft7AxiosInstance.get('/admin/contacts/tags');
      if(res.data.success){
        const tags = res.data.data || [];
        toast.success(`Fetched ${tags.length} tags`);
        setAvailableTags(tags);
      }
    }catch(error){
      console.error('Failed to fetch tags:', error);
      toast.error('Failed to fetch tags');
    }
  }

  const openWhatsApp = (phone: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${formatPhoneNumber(phone).replace(/\D/g, '')}`, '_blank');
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns(p => {
      const next = p.includes(key) ? p.filter(c => c !== key) : [...p, key];
      localStorage.setItem('contacts_selected_columns', JSON.stringify(next));
      return next;
    });
  };

  const handleResetColumns = () => {
    setSelectedColumns(INITIAL_DEFAULT_COLUMNS);
    localStorage.setItem('contacts_selected_columns', JSON.stringify(INITIAL_DEFAULT_COLUMNS));
    setColumnSearch('');
  };

  const exportContacts: ExportContact[] = contacts.map(c => ({
    id: c.id, phone: displayPhoneNumber(c.phone_number, c.country_code), name: c.name,
    email: c.email,  assigned_to: c.assigned_to,
    tags: c.tags?.map((t: any) => typeof t === 'string' ? t : t?.name).join(', '), status: c.status, createdAt: c.created_at,
  }));

  const activeFilterBadges: { id: string; label: string; remove: () => void }[] = [];

  if (filters.searchNamePhone) {
    activeFilterBadges.push({
      id: 'search',
      label: `Name: "${filters.searchNamePhone}"`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, searchNamePhone: '' }, '');
      },
    });
  }

  if (filters.email) {
    activeFilterBadges.push({
      id: 'email',
      label: `Email: "${filters.email}"`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, email: '' });
      },
    });
  }

  if (filters.phone) {
    activeFilterBadges.push({
      id: 'phone',
      label: `Phone: "${filters.phone}"`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, phone: '' });
      },
    });
  }

  if (filters.source && filters.source.length > 0) {
    filters.source.forEach(src => {
      activeFilterBadges.push({
        id: `source-${src}`,
        label: `Source: ${src.charAt(0).toUpperCase() + src.slice(1)}`,
        remove: () => {
          const next = filters.source.filter(s => s !== src);
          updateFiltersAndFetch({ ...filters, source: next });
        },
      });
    });
  }

  if (filters.country_code && filters.country_code.length > 0) {
    filters.country_code.forEach(cc => {
      activeFilterBadges.push({
        id: `cc-${cc}`,
        label: `Country: +${cc}`,
        remove: () => {
          const next = filters.country_code.filter(c => c !== cc);
          updateFiltersAndFetch({ ...filters, country_code: next });
        },
      });
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach(tagVal => {
      const tagObj = availableTags.find(t => String(t.id) === String(tagVal) || t.name === tagVal);
      const tagName = tagObj ? tagObj.name : tagVal;
      activeFilterBadges.push({
        id: `tag-${tagVal}`,
        label: `Tag: ${tagName}`,
        remove: () => {
          const next = filters.tags.filter(t => t !== tagVal);
          updateFiltersAndFetch({ ...filters, tags: next });
        },
      });
    });
  }

  if (filters.lists && filters.lists.length > 0) {
    filters.lists.forEach(listVal => {
      const listObj = contactLists.find(l => String(l.id) === String(listVal) || l.name === listVal);
      const listName = listObj ? (listObj.name || `List ${listObj.id}`) : listVal;
      activeFilterBadges.push({
        id: `list-${listVal}`,
        label: `List: ${listName}`,
        remove: () => {
          const next = filters.lists.filter(l => l !== listVal);
          updateFiltersAndFetch({ ...filters, lists: next });
        },
      });
    });
  }

  if (filters.status) {
    const statusVal = filters.status;
    const stageObj = pipelineStages.find(s => s.id === statusVal || (s.name && s.name.toLowerCase() === statusVal.toLowerCase()));
    const stageName = stageObj ? stageObj.name : statusVal;
    activeFilterBadges.push({
      id: 'status',
      label: `Status: ${stageName}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, status: '' });
      },
    });
  }

  const assignedFilterVal = filters.assignedTo || (Array.isArray(filters.assigned_to) ? filters.assigned_to[0] : filters.assigned_to);
  if (assignedFilterVal) {
    const assignedMember = acceptedTeamMembers.find(
      (m: any) => String(m.user_id || m.id || m.userId) === String(assignedFilterVal)
    );
    const assignedName = assignedMember?.name || assignedMember?.invitee_email || assignedMember?.email || assignedFilterVal;
    activeFilterBadges.push({
      id: 'assigned_to',
      label: `Assigned: ${assignedName}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, assignedTo: '', assigned_to: [] });
      },
    });
  }

  if (filters.createdDate) {
    activeFilterBadges.push({
      id: 'createdDate',
      label: `Created: ${filters.createdDate}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, createdDate: '' });
      },
    });
  }

  if (filters.reminderDate) {
    activeFilterBadges.push({
      id: 'reminderDate',
      label: `Reminder: ${filters.reminderDate}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, reminderDate: '' });
      },
    });
  }

  if (filters.assignedDate) {
    activeFilterBadges.push({
      id: 'assignedDate',
      label: `Assigned Date: ${filters.assignedDate}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, assignedDate: '' });
      },
    });
  }

  if (filters.optInStatus && filters.optInStatus !== 'all') {
    const isOptedOut = filters.optInStatus === 'true' || filters.optInStatus === 'opted-out' || filters.optInStatus === 'not-opted-in';
    activeFilterBadges.push({
      id: 'optInStatus',
      label: `Opt-Out: ${isOptedOut ? 'True' : 'False'}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, optInStatus: 'all' });
      },
    });
  }

  if (filters.duplicate && filters.duplicate !== 'all') {
    activeFilterBadges.push({
      id: 'duplicate',
      label: `Duplicate: ${filters.duplicate === 'show-duplicates' ? 'Show Duplicates' : 'Hide Duplicates'}`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, duplicate: 'all' });
      },
    });
  }

  if (filters.custom_fields) {
    const processedKeys = new Set<string>();
    Object.entries(filters.custom_fields).forEach(([k, v]) => {
      if (v && v.trim()) {
        const colObj = columnOptions.find(c => c.key === k || c.label === k);
        const canonicalKey = colObj ? colObj.key : k;
        if (processedKeys.has(canonicalKey)) return;
        processedKeys.add(canonicalKey);

        const lbl = colObj ? colObj.label : k;
        activeFilterBadges.push({
          id: `custom_field_${canonicalKey}`,
          label: `${lbl}: "${v}"`,
          remove: () => {
            const nextCustom = { ...filters.custom_fields };
            delete nextCustom[k];
            if (colObj) {
              delete nextCustom[colObj.key];
              delete nextCustom[colObj.label];
            }
            updateFiltersAndFetch({ ...filters, custom_fields: nextCustom });
          },
        });
      }
    });
  }

  if (filters.showUnassignedOnly) {
    activeFilterBadges.push({
      id: 'showUnassignedOnly',
      label: `Unassigned Only`,
      remove: () => {
        updateFiltersAndFetch({ ...filters, showUnassignedOnly: false });
      },
    });
  }

  if (selectedPhoneNumberId !== 'all') {
    const selectedPn = phoneNumbers.find(p => String(p.id) === String(selectedPhoneNumberId) || String(p.phone_number_id) === String(selectedPhoneNumberId));
    const disp = selectedPn?.displayPhone || selectedPn?.display_phone_number || selectedPn?.phone_number || selectedPhoneNumberId;
    activeFilterBadges.push({
      id: 'selectedPhone',
      label: `Phone: ${disp}`,
      remove: () => {
        handlePhoneSelect('all');
      },
    });
  }

  const activeFiltersCount = activeFilterBadges.length;

  const allSelected = contacts.length > 0 && (
    selectAllPages
      ? contacts.every(c => !excludedIds.includes(c.id))
      : contacts.every(c => selectedIds.includes(c.id))
  );
  const allPagesSelected = selectAllPages;
  // Total effectively selected across all pages
  const effectiveSelectedCount = selectAllPages
    ? pagination.total - excludedIds.length
    : selectedIds.length;

// ── Render a table cell by column key ──────────────────────────────────────
const renderCell = (col: string, contact: Contact, onStatusChange?: (id: string, newStatus: string) => void) => {
  switch (col) {
    case 'CREATED_AT':
      return (
        <td key={col} className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {formatDateShort(contact.created_at)}
        </td>
      );
    case 'NAME':
      return (
        <td key={col} className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <NameAvatar name={contact.name} />
            <button
              onClick={() => setSelectedContact(contact)}
              className="text-xs font-semibold text-foreground hover:text-accent transition text-left"
            >
              {contact.name}
            </button>
          </div>
        </td>
      );
    case 'COUNTRY_CODE': {
      const { countryCode } = getPhoneDetails(contact.phone_number, (contact as any).country_code);
      return (
        <td key={col} className="px-3 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
          {countryCode}
        </td>
      );
    }
    case 'PHONE': {
      return (
        <td key={col} className="px-3 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
          {contact.phone_number}
        </td>
      );
    }


    case 'SOURCE':
      return (
        <td key={col} className="px-3 py-2.5 whitespace-nowrap">
          <SourceBadge source={contact.source || contact.attributes?.source || contact.custom_fields?.source || undefined} />
        </td>
      );
    case 'PHONE_NUMBER_ID':
      return (
        <td key={col} className="px-3 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
          {contact.phone_number_id || <span className="text-muted-foreground/60">—</span>}
        </td>
      );
    case 'STATUS':
      return (
        <td key={col} className="px-3 py-2.5">
          <StatusDropdownCell 
            contact={contact} 
            onStatusChange={onStatusChange || (() => {})}
            stages={pipelineStages}
          />
        </td>
      );
    case 'TAGS':
      return (
        <td key={col} className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {contact.tags && contact.tags.length > 0 ? (
              <>
                {contact.tags.slice(0, 2).map((t, i) => (
                  <span key={i} className="px-2 py-0.5 bg-muted border border-border text-foreground rounded-md text-[10px] font-medium">
                    {typeof t === 'string' ? t : (t as any)?.name}
                  </span>
                ))}
                {contact.tags.length > 2 && (
                  <span className="text-[10px] text-muted-foreground self-center">+{contact.tags.length - 2}</span>
                )}
              </>
            ) : <span className="text-xs text-muted-foreground/60">—</span>}
          </div>
        </td>
      );
    case 'OPT_IN': {
      const isOptedOut = (contact as any).is_opted_out === true || (contact as any).opt_in === false || (contact as any).is_opted_in === false;
      return (
        <td key={col} className="px-3 py-2.5 text-center">
          <button
            onClick={() => handleOptOutToggle(contact, !isOptedOut)}
            className={`inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold transition cursor-pointer ${
              isOptedOut
                ? 'bg-error/10 border-error/20 text-error dark:text-error hover:bg-error/20'
                : 'bg-primary/10 border-[var(--color-primary)]/20 text-[var(--color-primary)] dark:text-[var(--color-primary)] hover:bg-primary/20'
            }`}
            title={isOptedOut ? 'Click to Opt-In' : 'Click to Opt-Out'}
          >
            {isOptedOut ? (
              <>
                <X size={11} className="stroke-[2.5]" />
                <span>No</span>
              </>
            ) : (
              <>
                <Check size={11} className="stroke-[2.5]" />
                <span>Yes</span>
              </>
            )}
          </button>
        </td>
      );
    }
    case 'ASSIGNED_TO': {
      const assignedVal = Array.isArray(contact.assigned_to)
        ? contact.assigned_to[0]
        : contact.assigned_to;

      let displayName = '';
      if (assignedVal) {
        const found = acceptedTeamMembers.find(
          (m: any) => String(m.user_id || m.id || m.userId) === String(assignedVal)
        );
        if (found) {
          displayName = found.name || found.invitee_email || found.email || found.user?.name || found.user?.email || 'Team Member';
        } else if (typeof assignedVal === 'string' && !assignedVal.includes('-')) {
          displayName = assignedVal;
        }
      }

      return (
        <td key={col} className="px-3 py-2.5">
          {displayName ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold text-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-foreground font-medium">{displayName}</span>
            </div>
          ) : (
            <span className="px-2 py-0.5 bg-muted border border-border text-muted-foreground rounded text-[10px] font-medium">
              Not Assigned
            </span>
          )}
        </td>
      );
    }
    case 'EMAIL':
      return (
        <td key={col} className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">
          {contact.email || <span className="text-muted-foreground/60">—</span>}
        </td>
      );
    default: {
      const colDef = columnOptions.find(c => c.key === col);
      const val = colDef ? getCustomFieldValue(contact, colDef) : undefined;
      return (
        <td key={col} className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {val !== undefined && val !== null && val !== '' ? String(val) : <span className="text-muted-foreground/60">—</span>}
        </td>
      );
    }
  }
};

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── TOP ACTION BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-card">
        {/* Left: bulk actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleBroadcast}
            disabled={isPreparingBroadcast || isSelectingCount}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted bg-card border border-border transition h-8"
          >
            <Radio size={14} className="text-muted-foreground" /> {isPreparingBroadcast ? 'Preparing...' : 'Broadcast'}
          </button>

          <button
            onClick={() => router.push('/user/contacts/tags')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted bg-card border border-border transition h-8"
          >
            <Tag size={14} className="text-muted-foreground" /> Tags
          </button>

          {(selectedIds.length > 0 || selectAllPages) && (
            <span className="text-xs text-accent font-medium ml-1">
              {effectiveSelectedCount} selected
            </span>
          )}
          {/* Select all pages banner */}
          {allSelected && !allPagesSelected && pagination.total > contacts.length && (
            <span className="text-xs text-muted-foreground ml-2">
              All {contacts.length} contacts on this page selected.{" "}
              <button
                onClick={() => { setSelectAllPages(true); setExcludedIds([]); }}
                className="text-accent font-semibold hover:underline"
              >
                Select all {pagination.total} contacts
              </button>
            </span>
          )}
          {allPagesSelected && (
            <span className="text-xs text-muted-foreground ml-2">
              All {pagination.total} contacts selected
              {excludedIds.length > 0 && ` (${excludedIds.length} excluded)`}.{" "}
              <button
                onClick={() => { setSelectAllPages(false); setSelectedIds([]); setExcludedIds([]); }}
                className="text-destructive font-semibold hover:underline"
              >
                Clear selection
              </button>
            </span>
          )}
        </div>

        {/* Right: utility buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Refresh"
          >
            <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {[
            { icon: Upload, label: 'Import', onClick: () => setShowImportModal(true) },
            { icon: Download, label: 'Export', onClick: () => setShowExportModal(true) },
            { icon: List, label: 'Lists', onClick: () => router.push('/user/contacts/lists') },
          ].map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-card hover:bg-muted border border-border rounded-lg transition h-8"
            >
              <Icon size={14} className="text-muted-foreground" /> {label}
            </button>
          ))}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition h-8 shadow-xs"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </div>

      {/* ── SEARCH + FILTERS + COLUMNS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/40 focus-within:bg-card focus-within:border-foreground/30 transition h-8 min-w-[220px]">
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  fetchContacts(1, searchQuery);
                }
              }}
              className="bg-transparent text-xs text-foreground placeholder-muted-foreground/60 px-3 py-1.5 outline-none flex-1"
            />
            <button
              onClick={() => fetchContacts(1, searchQuery)}
              className="flex items-center gap-1.5 px-3 h-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border-l border-border transition cursor-pointer"
            >
              <Search size={13} /> Go
            </button>
          </div>

          {/* Phone Number Dropdown */}
          <div className="relative flex items-center">
            <button
              ref={phoneDropdownButtonRef}
              onClick={() => setShowPhoneDropdown(p => !p)}
              className="flex items-center justify-between w-[180px] px-3 h-8 text-xs font-medium text-foreground bg-card border border-border hover:bg-muted rounded-lg transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-2 truncate">
                <Phone size={13} className="text-muted-foreground shrink-0" />
                <span className="truncate">
                  {selectedPhoneNumberId === 'all' 
                    ? 'All Phones' 
                    : phoneNumbers.find(p => String(p.id) === selectedPhoneNumberId)?.display_phone_number 
                      || phoneNumbers.find(p => String(p.id) === selectedPhoneNumberId)?.displayPhone 
                      || phoneNumbers.find(p => String(p.id) === selectedPhoneNumberId)?.phone_number
                      || 'Selected Phone'}
                </span>
              </div>
              <ChevronDown size={13} className={`text-muted-foreground shrink-0 transition-transform ${showPhoneDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showPhoneDropdown && (
              <div
                ref={phoneDropdownRef}
                className="absolute top-full left-0 mt-1.5 w-[180px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="py-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => handlePhoneSelect('all')}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      selectedPhoneNumberId === 'all'
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="w-3.5 flex justify-center shrink-0">
                      {selectedPhoneNumberId === 'all' && <Check size={12} className="text-accent" />}
                    </div>
                    <span className="truncate">All Phones</span>
                  </button>
                  
                  {phoneNumbers.map((pn: any) => {
                    const id = String(pn.id);
                    const disp = pn.displayPhone || pn.display_phone_number || pn.phone_number || pn.number || id;
                    const isSelected = selectedPhoneNumberId === id;
                    
                    return (
                      <button
                        key={id}
                        onClick={() => handlePhoneSelect(id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="w-3.5 flex justify-center shrink-0">
                          {isSelected && <Check size={12} className="text-accent" />}
                        </div>
                        <span className="truncate">{disp}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {(selectedIds.length > 0 || selectAllPages) && (
            <div className="flex items-center gap-2">
              <div className="relative" ref={assignDropdownRef}>
                <button
                  onClick={() => setShowAssignDropdown(prev => !prev)}
                  disabled={assignLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted border border-border bg-card rounded-lg transition h-8 disabled:opacity-50"
                >
                  {assignLoading ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                  Assign To
                  <ChevronDown size={13} className={`transition-transform ${showAssignDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAssignDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-lg shadow-xl z-50 py-1 max-h-56 overflow-y-auto">
                    {acceptedTeamMembers.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No team members found</div>
                    ) : (
                      acceptedTeamMembers.map((member: any) => {
                        const mId = String(member.user_id || member.id || member.userId);
                        const mName = member.name || member.invitee_email || member.email || member.user?.name || member.user?.email || 'Team Member';
                        return (
                          <button
                            key={mId}
                            onClick={() => handleAssignMultiple(mId)}
                            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted flex items-center gap-2 transition cursor-pointer"
                          >
                            <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold text-foreground shrink-0">
                              {mName.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate font-medium">{mName}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Assign Tags Dropdown */}
              <div className="relative" ref={assignTagsDropdownRef}>
                <button
                  onClick={() => setShowAssignTagsDropdown(prev => !prev)}
                  disabled={assignTagsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted border border-border bg-card rounded-lg transition h-8 disabled:opacity-50"
                >
                  {assignTagsLoading ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} />}
                  Assign Tags
                  <ChevronDown size={13} className={`transition-transform ${showAssignTagsDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showAssignTagsDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-60 bg-card border border-border rounded-xl shadow-2xl z-50 p-2.5">
                    <div className="text-xs font-semibold text-foreground mb-2 px-1 flex items-center justify-between">
                      <span>Select Tags</span>
                      {selectedBulkTagIds.length > 0 && (
                        <span className="text-[11px] font-normal text-accent">{selectedBulkTagIds.length} selected</span>
                      )}
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 mb-2.5">
                      {availableTags.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                          No tags found
                        </div>
                      ) : (
                        availableTags.map((tag) => {
                          const tagIdStr = String(tag.id);
                          const isSelected = selectedBulkTagIds.includes(tagIdStr) || selectedBulkTagIds.includes(tag.name);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedBulkTagIds(prev => prev.filter(id => id !== tagIdStr && id !== tag.name));
                                } else {
                                  setSelectedBulkTagIds(prev => [...prev, tagIdStr]);
                                }
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                                isSelected ? 'bg-accent/10 text-accent font-medium' : 'text-foreground hover:bg-muted'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 ${
                                isSelected ? 'bg-accent border-accent text-primary-foreground' : 'border-border bg-card'
                              }`}>
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                              </div>
                              <span className="truncate">{tag.name}</span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-2 border-t border-border flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAssignTagsDropdown(false);
                          setSelectedBulkTagIds([]);
                        }}
                        className="px-2.5 py-1 text-xs border border-border text-muted-foreground rounded-md hover:bg-muted transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAssignTags(selectedBulkTagIds)}
                        disabled={assignTagsLoading || selectedBulkTagIds.length === 0}
                        className="px-3 py-1 text-xs bg-primary hover:opacity-90 text-primary-foreground rounded-md font-semibold transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {assignTagsLoading && <Loader2 size={11} className="animate-spin" />}
                        Apply Tags
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:text-destructive border border-destructive/30 hover:border-destructive/60 bg-card hover:bg-destructive/10 rounded-lg transition h-8 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete {effectiveSelectedCount} {effectiveSelectedCount === 1 ? 'Contact' : 'Contacts'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: filters + columns */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={handleSalesPipeline} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted border border-border bg-card rounded-lg transition h-8">
              Sales Pipeline
            </button>
          </div>
          <button
            onClick={() => setShowFiltersModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted border border-border bg-card rounded-lg transition h-8"
          >
            <Filter size={13} />
            Filters
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 bg-accent text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:text-destructive border border-destructive/30 hover:border-destructive/60 bg-card hover:bg-destructive/10 rounded-lg transition h-8"
            >
              <X size={13} />
              Clear Filters
            </button> 
          )}

          {/* Columns picker */}
          <div className="relative">
            <button
              ref={columnsButtonRef}
              onClick={() => setShowColumnsDropdown(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted border border-border bg-card rounded-lg transition h-8"
            >
              <Columns3 size={13} /> Columns
              <ChevronDown size={12} className={`transition-transform ${showColumnsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showColumnsDropdown && (
              <div
                ref={columnsRef}
                className="absolute z-50 mt-1 right-0 w-56 bg-card border border-border rounded-xl shadow-2xl p-2 max-h-72 overflow-y-auto"
              >
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={columnSearch}
                  onChange={e => setColumnSearch(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground placeholder-muted-foreground/60 px-2.5 py-1.5 rounded-lg text-xs mb-2 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleResetColumns}
                  className="w-full mb-2 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition"
                >
                  Reset columns
                </button>
                {(() => {
                  const filteredCols = columnOptions
                    .filter(c => c.label.toLowerCase().includes(columnSearch.toLowerCase()));

                  if (filteredCols.length === 0) {
                    return (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No columns available
                      </div>
                    );
                  }

                  return filteredCols.map(col => {
                    const isSelected = selectedColumns.includes(col.key);

                    return (
                      <div
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer hover:bg-muted rounded-lg transition"
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 ${
                          isSelected ? 'bg-foreground border-foreground text-primary-foreground' : 'border-border'
                        }`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-xs text-foreground truncate">{col.label}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ACTIVE FILTER BADGES BAR ── */}
      {activeFilterBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-muted/60 border-b border-border text-xs">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Active Filters:</span>
          {activeFilterBadges.map(badge => (
            <span
              key={badge.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border text-foreground font-medium text-[11px] shadow-2xs"
            >
              <span>{badge.label}</span>
              <button
                onClick={badge.remove}
                className="text-muted-foreground hover:text-foreground transition rounded p-0.5"
                title="Remove filter"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            onClick={handleClearFilters}
            className="text-xs text-destructive font-semibold hover:underline ml-2"
          >
            Clear All
          </button>
        </div>
      )}

      {/* ── TABLE (desktop) ── */}
      <div className="hidden md:block overflow-x-auto bg-card">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/70">
              <th className="w-8 px-3.5 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected || allPagesSelected}
                  disabled={isSelectingCount}
                  onChange={e => {
                    if (!e.target.checked) {
                      setSelectedIds([]);
                      setSelectAllPages(false);
                      setExcludedIds([]);
                    } else {
                      setSelectedIds(contacts.map(c => c.id));
                      setSelectAllPages(false);
                      setExcludedIds([]);
                    }
                  }}
                  className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                />
              </th>
              {selectedColumns.map(key => {
                const col = columnOptions.find(c => c.key === key);
                if (!col) return null;
                const Icon = col.icon;
                return (
                  <th key={key} className="px-3.5 py-3 font-semibold text-[11px] text-foreground/80 dark:text-muted-foreground uppercase tracking-wider text-left whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-foreground/70 dark:text-muted-foreground shrink-0 stroke-[1.8]" />
                      <span>{col.label}</span>
                    </div>
                  </th>
                );
              })}
              <th className="px-3.5 py-3 font-semibold text-[11px] text-foreground/80 dark:text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={selectedColumns.length + 2} className="py-8">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={selectedColumns.length + 2} className="py-8">
                  <EmptyState
                    message="No contacts found"
                    action={{ label: 'Create Contact', onClick: () => setShowCreateModal(true) }}
                  />
                </td>
              </tr>
            ) : (
              contacts.map(contact => (
                <tr
                  key={contact.id}
                  className={`border-b border-border hover:bg-muted/40 dark:hover:bg-card-foreground/5 transition-colors group ${
                    (selectAllPages ? !excludedIds.includes(contact.id) : selectedIds.includes(contact.id)) ? 'bg-accent/5 dark:bg-accent/10' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="w-8 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectAllPages ? !excludedIds.includes(contact.id) : selectedIds.includes(contact.id)}
                      disabled={isSelectingCount}
                      onChange={e => {
                        if (selectAllPages) {
                          if (!e.target.checked) {
                            setExcludedIds(prev => [...prev, contact.id]);
                          } else {
                            setExcludedIds(prev => prev.filter(id => id !== contact.id));
                          }
                        } else {
                          setSelectedIds(e.target.checked
                            ? [...selectedIds, contact.id]
                            : selectedIds.filter(id => id !== contact.id));
                        }
                      }}
                      className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                    />
                  </td>

                  {/* Dynamic columns */}
                  {selectedColumns.map(col => renderCell(col, contact, handleStatusUpdate))}

                  {/* Actions */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openWhatsApp(contact.phone_number)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-[var(--color-primary)] hover:bg-primary/10 transition"
                        title="WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={() => router.push(`/user/inbox?phone=${encodeURIComponent(contact.phone_number)}&name=${encodeURIComponent(contact.name)}`)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Inbox"
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        onClick={() => setContactToEdit(contact)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setContactToDelete(contact); setShowDeleteModal(true); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── PAGINATION ── */}
      {!isLoading && pagination.total_pages > 0 && (
        <div className="hidden md:block bg-card border-t border-border">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.total_pages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPrev={() => handlePageChange(pagination.page - 1)}
            onNext={() => handlePageChange(pagination.page + 1)}
            selectedCount={effectiveSelectedCount}
            isSelectingCount={isSelectingCount}
            onSelectCountChange={handleSelectCountChange}
            onLimitChange={(newLimit) => {
              setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
              fetchContacts(1, searchQuery, newLimit);
            }}
          />
        </div>
      )}

      {/* ── MOBILE CARDS ── */}
      <div className="md:hidden space-y-3 p-4">
        {isLoading ? (
          <LoadingSpinner />
        ) : contacts.length === 0 ? (
          <EmptyState
            message="No contacts found"
            action={{ label: 'Create Contact', onClick: () => setShowCreateModal(true) }}
          />
        ) : (
          <>
            {contacts.map(contact => (
              <div
                key={contact.id}
                className={`bg-card border rounded-xl p-4 space-y-3 transition ${
                  (selectAllPages ? !excludedIds.includes(contact.id) : selectedIds.includes(contact.id))
                    ? 'border-primary dark:border-primary'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={selectAllPages ? !excludedIds.includes(contact.id) : selectedIds.includes(contact.id)}
                      disabled={isSelectingCount}
                      onChange={e => {
                        if (selectAllPages) {
                          if (!e.target.checked) {
                            setExcludedIds(prev => [...prev, contact.id]);
                          } else {
                            setExcludedIds(prev => prev.filter(id => id !== contact.id));
                          }
                        } else {
                          setSelectedIds(e.target.checked
                            ? [...selectedIds, contact.id]
                            : selectedIds.filter(id => id !== contact.id));
                        }
                      }}
                      className="w-3.5 h-3.5 accent-foreground rounded mt-0.5 cursor-pointer"
                    />
                    <NameAvatar name={contact.name} />
                    <div>
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="text-xs font-semibold text-foreground hover:text-accent transition text-left"
                      >
                        {contact.name}
                      </button>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {contact.phone_number}
                      </p>
                    </div>
                  </div>
                </div>

                {contact.email && (
                  <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                )}

                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-muted border border-border text-foreground rounded-md text-[10px] font-medium">
                        {typeof t === 'string' ? t : (t as any)?.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <StatusBadge status={contact.status} stages={pipelineStages} />
                  <div className="flex gap-1">
                    <button
                      onClick={() => openWhatsApp(contact.phone_number)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-[var(--color-primary)] hover:bg-primary/10 transition"
                      title="WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <button
                      onClick={() => router.push(`/user/inbox?phone=${encodeURIComponent(contact.phone_number)}&name=${encodeURIComponent(contact.name)}`)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      title="Inbox"
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button
                      onClick={() => setContactToEdit(contact)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { setContactToDelete(contact); setShowDeleteModal(true); }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Mobile pagination */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Page {pagination.page} / {pagination.total_pages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg disabled:opacity-40 hover:bg-surface-muted dark:hover:bg-surface-raised transition"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.total_pages}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg disabled:opacity-40 hover:bg-surface-muted dark:hover:bg-surface-raised transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODALS ── */}
      {showCreateModal && (
        <CreateContactModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => fetchContacts(1, searchQuery)}
          stages={pipelineStages}
          availableTags={availableTags}
          acceptedTeamMembers={acceptedTeamMembers}
        />
      )}

      {showImportModal && (
        <ImportContacts
          onImportSuccess={() => { fetchContacts(1, searchQuery); }}
          onClose={() => { fetchContacts(1, searchQuery); setShowImportModal(false); }}
        />
      )}

       {showExportModal && <ExportContacts onClose={() => setShowExportModal(false)} />}

      {showFiltersModal && (
        <FiltersModal
          filters={filters}
          onFilterChange={handleFilterChange}
          onApply={handleApplyFilters}
          onClose={() => setShowFiltersModal(false)}
          onClear={handleClearFilters}
          availableTags={availableTags}
          stages={pipelineStages}
          acceptedTeamMembers={acceptedTeamMembers}
          contactLists={contactLists}
          columnOptions={columnOptions}
        />
      )}

      {showDeleteModal && contactToDelete && (
        <DeleteConfirmModal
          contact={contactToDelete}
          onConfirm={handleDeleteContact}
          onClose={() => {
            if (!isDeleting) {
              setShowDeleteModal(false);
              setContactToDelete(null);
            }
          }}
          isDeleting={isDeleting}
        />
      )}

      {showBulkDeleteModal && (
        <BulkDeleteConfirmModal
          count={effectiveSelectedCount}
          onConfirm={executeBulkDelete}
          onClose={() => {
            if (!isDeleting) setShowBulkDeleteModal(false);
          }}
          isDeleting={isDeleting}
        />
      )}

      {contactToEdit && (
        <EditContactModal
          contact={contactToEdit}
          phoneNumbers={phoneNumbers}
          onClose={() => setContactToEdit(null)}
          stages={pipelineStages}
          availableTags={availableTags}
          acceptedTeamMembers={acceptedTeamMembers}
          columnOptions={columnOptions}
          onSuccess={(updatedContact) => {
            setContacts(prev =>
              prev.map(contact =>
                contact.id === updatedContact.id
                  ? { ...contact, ...updatedContact }
                  : contact
              )
            );

            setSelectedContact(prev =>
              prev?.id === updatedContact.id
                ? { ...prev, ...updatedContact }
                : prev
            );

            void fetchContacts(pagination.page, searchQuery);
          }}
        />
      )}
      {/* ── CONTACT DETAILS SIDEBAR ── */}
      {selectedContact && (
        <ContactDetailsSidebar
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={() => fetchContacts(pagination.page, searchQuery)}
        />
      )}
    </div>
  );
}
