"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { Loader2, ChevronDown, Check } from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface CreateContactData {
  phone_number: string;
  phone_number_id: string;
  name: string;
  email?: string;
  country_code?: string;
  assigned_to?: string[];
  tag_ids?: string[];
  status?: string;
  is_opted_out?: boolean;
  attributes?: Record<string, string>;
  custom_fields?: Record<string, string>;
  notes?: string;
}

interface WabaPhoneNumber {
  id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  status: string;
}

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}

const Modal = ({ title, children, onClose }: ModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-surface dark:bg-card text-foreground rounded-[16px] w-full max-w-[740px] shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),0_2px_10px_rgba(36,28,20,0.05)] border-none flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-[30px] py-[22px] flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-primary to-primary">
          <div className="absolute w-[200px] h-[200px] rounded-full -top-[110px] -right-[50px] pointer-events-none" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)' }}></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            </div>
            <div className="font-display text-[19px] font-semibold tracking-[-0.01em] m-0" style={{ color: 'var(--color-primary-foreground)' }}>
              {title}
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

        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>
  );
};

export interface CountryOption {
  code: string;
  value: string;
  label: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "in", value: "91", label: "India (+91)" },
  { code: "sg", value: "65", label: "Singapore (+65)" },
  { code: "us", value: "1", label: "USA (+1)" },
  { code: "gb", value: "44", label: "UK (+44)" },
  { code: "au", value: "61", label: "Australia (+61)" },
  { code: "ae", value: "971", label: "UAE (+971)" },
  { code: "ca", value: "1", label: "Canada (+1)" },
  { code: "my", value: "60", label: "Malaysia (+60)" },
];

export const CustomCountrySelect = ({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cleanVal = value.toString().replace(/[^\d]/g, "");
  const selected = COUNTRY_OPTIONS.find((c) => c.value === cleanVal) || {
    code: "",
    value: cleanVal,
    label: cleanVal ? `(+${cleanVal})` : "Select country code",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] disabled:opacity-50"
      >
        <span className="flex items-center gap-2.5 truncate">
          {selected.code && <img
            src={`https://flagcdn.com/w20/${selected.code.toLowerCase()}.png`}
            alt={selected.label}
            className="w-[20px] h-[14px] object-cover rounded-[2px] shadow-sm shrink-0 border border-black/10"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />}
          <span className="font-medium">{selected.label}</span>
        </span>
        <ChevronDown size={15} className={`text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface dark:bg-surface-active border-[1.5px] border-border rounded-[8px] shadow-lg max-h-56 overflow-y-auto py-1">
          {COUNTRY_OPTIONS.map((c) => {
            const isSelected = c.value === cleanVal;
            return (
              <button
                key={`${c.code}-${c.value}`}
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs sm:text-sm text-left transition ${
                  isSelected ? "bg-surface-hover dark:bg-border-strong font-semibold text-primary-text" : "text-foreground hover:bg-surface-muted dark:hover:bg-border-strong"
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <img
                    src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`}
                    alt={c.label}
                    className="w-[20px] h-[14px] object-cover rounded-[2px] shadow-sm shrink-0 border border-black/10"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <span>{c.label}</span>
                </span>
                {isSelected && <Check size={14} className="text-primary-text shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const CreateContactModal = ({
  onClose,
  onSuccess,
  stages = [],
  availableTags = [],
  acceptedTeamMembers = [],
}: {
  onClose: () => void;
  onSuccess: () => void;
  stages?: { id: string; name: string }[];
  availableTags?: { id: string | number; name: string }[];
  acceptedTeamMembers?: any[];
}) => {
  const [formData, setFormData] = useState<CreateContactData>({
    phone_number: "",
    phone_number_id: "",
    name: "",
    email: "",
    country_code: "91",
    assigned_to: [],
    tag_ids: [],
    status: "",
    is_opted_out: false,
    attributes: {},
    notes: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<WabaPhoneNumber[]>([]);
  const [isLoadingPhoneNumbers, setIsLoadingPhoneNumbers] = useState(true);
  const [phoneNumbersError, setPhoneNumbersError] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const response = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
        if (response.data?.success && Array.isArray(response.data.data)) {
          const list: WabaPhoneNumber[] = response.data.data;
          setPhoneNumbers(list);
          if (list.length > 0) {
            setFormData((p) => ({ ...p, phone_number_id: p.phone_number_id || list[0].id }));
          }
        } else {
          setPhoneNumbersError("Unable to load WhatsApp phone numbers. Please reopen this form to retry.");
        }
      } catch (error) {
        console.error("Failed to fetch phone numbers:", error);
        setPhoneNumbersError("Unable to load WhatsApp phone numbers. Please reopen this form to retry.");
      } finally {
        setIsLoadingPhoneNumbers(false);
      }
    };
    fetchPhoneNumbers();
  }, []);

  const validateEmail = (email?: string | null) => {
    if (!email || !email.trim()) return { isValid: true, message: "" };
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(email.trim())) {
      return { isValid: false, message: "Invalid email format (e.g. name@example.com)" };
    }
    return { isValid: true, message: "✓ Valid email format" };
  };

  const validatePhoneNumber = (phone?: string | null, countryCode: string = "91") => {
    if (!phone || !phone.trim()) {
      return { isValid: false, message: "Phone number is required" };
    }
    const rawDigits = phone.replace(/[^\d]/g, "");
    if (!rawDigits) {
      return { isValid: false, message: "Please enter phone digits" };
    }
    const code = (countryCode || "91").toString().replace(/[^\d]/g, "");
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

  const phoneValidation = validatePhoneNumber(formData.phone_number, formData.country_code || "91");
  const emailValidation = validateEmail(formData.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoadingPhoneNumbers || !phoneNumbers.some((number) => number.id === formData.phone_number_id)) {
      toast.error("Please select a WhatsApp phone number");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!phoneValidation.isValid) {
      toast.error(phoneValidation.message.replace(/^✗\s*/, ""));
      return;
    }
    if (formData.email && !emailValidation.isValid) {
      toast.error(emailValidation.message);
      return;
    }
    if (!formData.status) {
      toast.error("Please select a status");
      return;
    }

    const rawDigits = (formData.phone_number || "").replace(/[^\d]/g, "");
    const e164Phone = formData.phone_number.startsWith("+")
      ? formData.phone_number
      : `+${formData.country_code || "91"}${rawDigits}`;

    setIsLoading(true);
    try {
      const response = await soft7AxiosInstance.post("/admin/contacts", {
        ...formData,
        name: formData.name.trim(),
        email: formData.email?.trim() || "",
        phone_number: e164Phone,
        country_code: formData.country_code || "91",
        phone_number_id: formData.phone_number_id,
        assigned_to: formData.assigned_to || [],
        tag_ids: formData.tag_ids || [],
        status: formData.status,
        is_opted_out: !!formData.is_opted_out,
        custom_fields: formData.custom_fields || {},
      });
      if (response.data.success) {
        toast.success("Contact created successfully");
        onSuccess();
        onClose();
      }
    } catch (error: unknown) {
      toast.error(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to create contact"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const assignedOptions = [
    { value: "", label: "Unassigned" },
    ...acceptedTeamMembers.map((m: any) => {
      const id = String(m.user_id || m.id || m.userId || "");
      const name = m.name || m.invitee_email || m.email || m.user?.name || m.user?.email || "Team Member";
      return { value: id, label: name };
    }),
  ];

  return (
    <Modal title="Add new contact" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-[30px] pt-[26px] pb-[16px]">
          {/* Section Header */}
          <div className="flex items-center gap-[10px] text-[12px] font-bold tracking-[0.06em] text-primary-text uppercase mb-[18px]">
            <div className="w-[16px] h-[2.5px] rounded-[2px] bg-primary shrink-0" /> Primary details
          </div>

          {/* 1. Name & 2. Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-[18px]">
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Name <span className="text-primary-text ml-[2px]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
                className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Email
              </label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={formData.email || ""}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value.trimStart() }))}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-[18px]">
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Country Code <span className="text-primary-text ml-[2px]">*</span>
              </label>
              <CustomCountrySelect
                value={formData.country_code || "91"}
                onChange={(val) => setFormData((p) => ({ ...p, country_code: val }))}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Phone Number <span className="text-primary-text ml-[2px]">*</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={formData.phone_number}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d+]/g, "");
                  setFormData((p) => ({ ...p, phone_number: val }));
                }}
                required
                className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
              />
              {formData.phone_number && (
                <p className={`text-[11px] font-medium mt-1 ${phoneValidation.isValid ? "text-[var(--color-primary-hover)]" : "text-error"}`}>
                  {phoneValidation.message}
                </p>
              )}
            </div>
          </div>

          <div className="mb-[18px]">
            <label htmlFor="contact-phone-number-id" className="block text-[13px] font-semibold text-foreground mb-[7px]">
              WhatsApp Phone Number ID <span className="text-primary-text ml-[2px]">*</span>
            </label>
            <div className="relative">
              <select
                id="contact-phone-number-id"
                name="phone_number_id"
                value={formData.phone_number_id}
                onChange={(e) => setFormData((p) => ({ ...p, phone_number_id: e.target.value }))}
                required
                disabled={isLoading || isLoadingPhoneNumbers || phoneNumbers.length === 0}
                aria-describedby="contact-phone-number-id-help"
                className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="" disabled>
                  {isLoadingPhoneNumbers ? "Loading phone numbers..." : phoneNumbers.length === 0 ? "No phone numbers available" : "Select a WhatsApp phone number..."}
                </option>
                {phoneNumbers.map((number) => (
                  <option key={number.id} value={number.id}>
                    {number.display_phone_number} — {number.verified_name} (ID: {number.phone_number_id})
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <p id="contact-phone-number-id-help" className={`text-[11px] mt-1 ${phoneNumbersError ? "text-red-500" : "text-muted-foreground"}`}>
              {phoneNumbersError || (!isLoadingPhoneNumbers && phoneNumbers.length === 0 ? "Add a WhatsApp business phone number before creating a contact." : "Select the WhatsApp business number to associate with this contact.")}
            </p>
          </div>

          {/* 5. Assigned To & 6. Assigned Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-[18px]">
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Assigned To
              </label>
              <div className="relative">
                <select
                  value={formData.assigned_to && formData.assigned_to[0] ? formData.assigned_to[0] : ""}
                  onChange={(e) => setFormData((p) => ({ ...p, assigned_to: e.target.value ? [e.target.value] : [] }))}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                >
                  {assignedOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Assigned Tags
              </label>
              <div className="relative" ref={tagDropdownRef}>
                <button
                  type="button"
                  onClick={() => setTagDropdownOpen((p) => !p)}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] flex items-center justify-between text-left"
                >
                  <span className="truncate">
                    {formData.tag_ids && formData.tag_ids.length > 0
                      ? formData.tag_ids
                          .map((id) => availableTags.find((t) => String(t.id) === String(id) || t.name === id)?.name || id)
                          .join(", ")
                      : <span className="text-muted-foreground">Select tags...</span>}
                  </span>
                  <ChevronDown size={15} className={`text-muted-foreground transition-transform ${tagDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {tagDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-surface dark:bg-surface-active border-[1.5px] border-border rounded-[8px] shadow-lg max-h-[160px] overflow-y-auto">
                    {availableTags.length > 0 ? (
                      availableTags.map((tag) => {
                        const tagIdStr = String(tag.id);
                        const isSelected = formData.tag_ids?.some((t) => String(t) === tagIdStr || t === tag.name);
                        return (
                          <label
                            key={tagIdStr}
                            className="flex items-center gap-[10px] px-[14px] py-[10px] hover:bg-surface-muted dark:hover:bg-border-strong cursor-pointer transition-colors border-b border-border last:border-0"
                            onClick={(e) => {
                              e.preventDefault();
                              setFormData((prev) => ({
                                ...prev,
                                tag_ids: isSelected
                                  ? (prev.tag_ids || []).filter((t) => String(t) !== tagIdStr && t !== tag.name)
                                  : [...(prev.tag_ids || []), tagIdStr],
                              }));
                            }}
                          >
                            <div className={`w-[16px] h-[16px] shrink-0 rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-surface"}`}>
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                            <span className="text-[14px] text-foreground truncate">{tag.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="px-[14px] py-[10px] text-[13px] text-muted-foreground">No tags available</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 7. Status & 8. Opt-Out */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-[18px]">
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Status <span className="text-primary-text ml-[2px]">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.status || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  required
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                >
                  <option value="">Select status...</option>
                  {stages.length > 0 ? (
                    stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="new_lead">New Lead</option>
                      <option value="demo">Demo</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="convert">Convert</option>
                    </>
                  )}
                </select>
                <ChevronDown size={15} className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Opt-Out <span className="text-muted-foreground font-normal">(true, false)</span>
              </label>
              <div className="relative">
                <select
                  value={formData.is_opted_out ? "true" : "false"}
                  onChange={(e) => setFormData((p) => ({ ...p, is_opted_out: e.target.value === "true" }))}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] pr-[34px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                >
                  <option value="false">False (Opted In)</option>
                  <option value="true">True (Opted Out)</option>
                </select>
                <ChevronDown size={15} className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="mb-[18px]">
            <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
              Notes
            </label>
            <textarea
              rows={3}
              placeholder="Optional notes..."
              value={formData.notes || ""}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              className="w-full min-h-[78px] rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground resize-y"
            />
          </div>
        </div>

        <div className="flex justify-between items-center px-[30px] pt-[16px] pb-[24px] border-t border-border shrink-0 bg-surface dark:bg-card">
          <p className="text-[12px] text-muted-foreground m-0">
            Fields marked <span className="text-primary-text font-semibold">*</span> are required
          </p>
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={onClose}
              className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold bg-surface border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150 flex items-center gap-[7px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isLoadingPhoneNumbers || !formData.phone_number_id || !phoneValidation.isValid || (!!formData.email && !emailValidation.isValid)}
              className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold text-white transition-all duration-150 flex items-center gap-[7px] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 hover:-translate-y-[1px] shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)]"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create contact
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
