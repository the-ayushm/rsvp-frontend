/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Upload,
  X,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Check,
  Search,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import axios from "axios";
import { waitForJob } from "@/lib/background-job";
import { createJobToast } from "@/lib/job-toast";
import { getImportJobStats, getImportCountItems, getImportResultSummary, normalizeImportJobSnapshot } from "../../utils/import-job-stats";
import { createImportPreviewForm, normalizeImportPreview, type ContactImportPreview } from "../../utils/import-preview";
import ImportPreviewDetails from "./ImportPreviewDetails";

interface ImportContactsProps {
  onImportSuccess: () => void;
  onClose: () => void;
}

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

interface WabaPhoneNumber {
  id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  status: string;
}
interface CustomDropdownOption {
  value: string;
  label: string;
  meta?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}
interface ContactColumn {
  id: string;
  label: string;
  type: string;
  visible: string | boolean;
}

const CustomDropdown = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  loading = false,
}: CustomDropdownProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between py-[11px] px-[14px] border-[1.5px] border-primary rounded-[8px] bg-surface-muted text-[14px] outline-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${open ? "border-border bg-surface shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)]" : ""}`}
      >
        <span
          className={`truncate flex items-center gap-2 ${!selected ? "text-muted-foreground" : "text-foreground font-medium"}`}
        >
          {loading ? "Loading..." : selected ? selected.label : placeholder}
          {selected?.meta && (
            <span className="text-muted-foreground font-normal">
              {" "}
              — {selected.meta}
            </span>
          )}
        </span>

        <ChevronDown
          size={16}
          className={`text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && !loading && (
        <div className="absolute z-[9999] mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-card text-foreground shadow-lg">
          {options.length === 0 ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">
              No WhatsApp numbers found
            </p>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
              >
                <span className="truncate">
                  {option.label}
                  {option.meta && (
                    <span className="text-muted-foreground"> - {option.meta}</span>
                  )}
                </span>

                {option.value === value && (
                  <Check size={15} className="text-[var(--color-primary)] shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

interface CountryCodeOption {
  code: string;
  iso: string;
  name: string;
  label: string;
  shortLabel: string;
  searchKey: string;
}

const COUNTRY_CODE_OPTIONS: CountryCodeOption[] = [
  { code: "91", iso: "in", name: "India", label: "India (+91)", shortLabel: "+91", searchKey: "india 91 in +91" },
  { code: "1", iso: "us", name: "United States", label: "United States (+1)", shortLabel: "+1", searchKey: "united states us usa 1 +1" },
  { code: "44", iso: "gb", name: "United Kingdom", label: "United Kingdom (+44)", shortLabel: "+44", searchKey: "united kingdom uk england 44 +44" },
  { code: "61", iso: "au", name: "Australia", label: "Australia (+61)", shortLabel: "+61", searchKey: "australia au 61 +61" },
  { code: "1", iso: "ca", name: "Canada", label: "Canada (+1)", shortLabel: "+1", searchKey: "canada ca 1 +1" },
  { code: "971", iso: "ae", name: "UAE", label: "UAE (+971)", shortLabel: "+971", searchKey: "uae dubai emirates 971 +971" },
  { code: "62", iso: "id", name: "Indonesia", label: "Indonesia (+62)", shortLabel: "+62", searchKey: "indonesia id 62 +62" },
  { code: "60", iso: "my", name: "Malaysia", label: "Malaysia (+60)", shortLabel: "+60", searchKey: "malaysia my 60 +60" },
  { code: "65", iso: "sg", name: "Singapore", label: "Singapore (+65)", shortLabel: "+65", searchKey: "singapore sg 65 +65" },
  { code: "55", iso: "br", name: "Brazil", label: "Brazil (+55)", shortLabel: "+55", searchKey: "brazil br 55 +55" },
  { code: "49", iso: "de", name: "Germany", label: "Germany (+49)", shortLabel: "+49", searchKey: "germany de 49 +49" },
  { code: "33", iso: "fr", name: "France", label: "France (+33)", shortLabel: "+33", searchKey: "france fr 33 +33" },
  { code: "39", iso: "it", name: "Italy", label: "Italy (+39)", shortLabel: "+39", searchKey: "italy it 39 +39" },
  { code: "34", iso: "es", name: "Spain", label: "Spain (+34)", shortLabel: "+34", searchKey: "spain es 34 +34" },
  { code: "92", iso: "pk", name: "Pakistan", label: "Pakistan (+92)", shortLabel: "+92", searchKey: "pakistan pk 92 +92" },
  { code: "880", iso: "bd", name: "Bangladesh", label: "Bangladesh (+880)", shortLabel: "+880", searchKey: "bangladesh bd 880 +880" },
  { code: "94", iso: "lk", name: "Sri Lanka", label: "Sri Lanka (+94)", shortLabel: "+94", searchKey: "sri lanka lk 94 +94" },
  { code: "977", iso: "np", name: "Nepal", label: "Nepal (+977)", shortLabel: "+977", searchKey: "nepal np 977 +977" },
  { code: "966", iso: "sa", name: "Saudi Arabia", label: "Saudi Arabia (+966)", shortLabel: "+966", searchKey: "saudi arabia sa 966 +966" },
  { code: "27", iso: "za", name: "South Africa", label: "South Africa (+27)", shortLabel: "+27", searchKey: "south africa za 27 +27" },
  { code: "234", iso: "ng", name: "Nigeria", label: "Nigeria (+234)", shortLabel: "+234", searchKey: "nigeria ng 234 +234" },
  { code: "254", iso: "ke", name: "Kenya", label: "Kenya (+254)", shortLabel: "+254", searchKey: "kenya ke 254 +254" },
  { code: "86", iso: "cn", name: "China", label: "China (+86)", shortLabel: "+86", searchKey: "china cn 86 +86" },
  { code: "81", iso: "jp", name: "Japan", label: "Japan (+81)", shortLabel: "+81", searchKey: "japan jp 81 +81" },
  { code: "82", iso: "kr", name: "South Korea", label: "South Korea (+82)", shortLabel: "+82", searchKey: "south korea kr 82 +82" },
  { code: "63", iso: "ph", name: "Philippines", label: "Philippines (+63)", shortLabel: "+63", searchKey: "philippines ph 63 +63" },
  { code: "66", iso: "th", name: "Thailand", label: "Thailand (+66)", shortLabel: "+66", searchKey: "thailand th 66 +66" },
  { code: "84", iso: "vn", name: "Vietnam", label: "Vietnam (+84)", shortLabel: "+84", searchKey: "vietnam vn 84 +84" },
  { code: "52", iso: "mx", name: "Mexico", label: "Mexico (+52)", shortLabel: "+52", searchKey: "mexico mx 52 +52" },
  { code: "54", iso: "ar", name: "Argentina", label: "Argentina (+54)", shortLabel: "+54", searchKey: "argentina ar 54 +54" },
  { code: "57", iso: "co", name: "Colombia", label: "Colombia (+57)", shortLabel: "+57", searchKey: "colombia co 57 +57" },
  { code: "7", iso: "ru", name: "Russia", label: "Russia (+7)", shortLabel: "+7", searchKey: "russia ru 7 +7" },
  { code: "90", iso: "tr", name: "Turkey", label: "Turkey (+90)", shortLabel: "+90", searchKey: "turkey tr 90 +90" },
  { code: "20", iso: "eg", name: "Egypt", label: "Egypt (+20)", shortLabel: "+20", searchKey: "egypt eg 20 +20" },
];

interface SearchableCountryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchableCountryDropdown = ({
  value,
  onChange,
  placeholder = "Select code",
}: SearchableCountryDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = COUNTRY_CODE_OPTIONS.find((opt) => opt.code === value);

  const filteredOptions = COUNTRY_CODE_OPTIONS.filter((opt) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.code.includes(q) ||
      opt.searchKey.includes(q)
    );
  });

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full h-[44px] flex items-center justify-between py-[11px] px-[12px] border-[1.5px] border-border rounded-[8px] bg-surface-muted text-[13.5px] outline-none transition-all duration-150 ${
          open ? "border-primary bg-surface shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)]" : ""
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              <img
                src={`https://flagcdn.com/w20/${selectedOption.iso.toLowerCase()}.png`}
                alt={selectedOption.name}
                className="w-4.5 h-3.5 object-cover rounded-[2px] shrink-0 border border-black/10"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span className="font-medium text-foreground">+{selectedOption.code}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-[9999] mt-1 left-0 w-[240px] rounded-xl border border-border bg-card text-foreground shadow-2xl p-2.5">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Search country or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-muted border border-border text-foreground placeholder-muted-foreground pl-8 pr-2.5 py-1.5 rounded-lg text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-border/30">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition ${
                !value ? "bg-surface-hover font-semibold text-primary-text" : "hover:bg-muted text-foreground"
              }`}
            >
              <span>No country code</span>
              {!value && <Check size={12} className="text-primary-text" />}
            </button>

            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground text-center">
                No matching country
              </p>
            ) : (
              filteredOptions.map((opt, idx) => (
                <button
                  key={`${opt.code}-${opt.iso}-${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(opt.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition ${
                    opt.code === value
                      ? "bg-surface-hover font-semibold text-primary-text"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <img
                      src={`https://flagcdn.com/w20/${opt.iso.toLowerCase()}.png`}
                      alt={opt.name}
                      className="w-4.5 h-3.5 object-cover rounded-[2px] shrink-0 border border-black/10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <span className="truncate">{opt.name}</span>
                    <span className="text-muted-foreground font-normal">(+{opt.code})</span>
                  </div>
                  {opt.code === value && (
                    <Check size={12} className="text-primary-text shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
interface TagOption {
  id: string | number;
  name: string;
}

interface MultiSelectTagsProps {
  options: TagOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

const MultiSelectTagsDropdown: React.FC<MultiSelectTagsProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select tags...",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const toggleTag = (tagVal: string) => {
    if (selectedValues.includes(tagVal)) {
      onChange(selectedValues.filter((v) => v !== tagVal));
    } else {
      onChange([...selectedValues, tagVal]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full min-h-[44px] flex items-center justify-between py-[9px] px-[12px] border-[1.5px] border-border rounded-[8px] bg-surface-muted text-[13.5px] outline-none transition-all duration-150 ${
          open ? "border-primary bg-surface shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)]" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1 pr-2">
          {selectedValues.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedValues.map((val) => {
              const tagObj = options.find(
                (o) => String(o.id) === String(val) || o.name === val
              );
              const tagName = tagObj ? tagObj.name : val;
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-hover border border-primary text-primary-text text-xs font-semibold"
                >
                  <span className="truncate max-w-[120px]">{tagName}</span>
                  <X
                    size={12}
                    className="cursor-pointer hover:text-error transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTag(val);
                    }}
                  />
                </span>
              );
            })
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-[9999] mt-1 left-0 w-full rounded-xl border border-border bg-card text-foreground shadow-2xl p-2.5">
          <div className="relative mb-2">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              autoFocus
              placeholder="Search tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-muted border border-border text-foreground placeholder-muted-foreground pl-8 pr-2.5 py-1.5 rounded-lg text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground text-center">
                No tags available
              </p>
            ) : (
              filteredOptions.map((tag) => {
                const tagVal = String(tag.id);
                const isSelected =
                  selectedValues.includes(tagVal) ||
                  selectedValues.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tagVal)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition ${
                      isSelected
                        ? "bg-surface-hover font-semibold text-primary-text"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-surface"
                        }`}
                      >
                        {isSelected && (
                          <Check size={10} className="stroke-[3]" />
                        )}
                      </div>
                      <span className="truncate">{tag.name}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ImportContacts: React.FC<ImportContactsProps> = ({
  onImportSuccess,
  onClose,
}) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>(
    {},
  );
  const [contactColumns, setContactColumns] = useState<ContactColumn[]>([]);
  const [contactColumnsLoading, setContactColumnsLoading] = useState(false);
  const [validationResults, setValidationResults] = useState<ContactImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewControllerRef = useRef<AbortController | null>(null);
  const previewUploadFileRef = useRef<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [listName, setListName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [phoneNumbers, setPhoneNumbers] = useState<WabaPhoneNumber[]>([]);
  const [phoneNumbersLoading, setPhoneNumbersLoading] = useState(false);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [availableTags, setAvailableTags] = useState<{ id: string | number; name: string }[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const pollingControllerRef = useRef<AbortController | null>(null);
  const dialogAttachedRef = useRef(true);

  useEffect(() => {
    dialogAttachedRef.current = true;
    return () => {
      dialogAttachedRef.current = false;
      previewControllerRef.current?.abort();
      // Imports and their global toast continue after the dialog is unmounted.
    };
  }, []);

  const normalizeHeader = (header: string) =>
    header
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, "");

  const findMatchingHeader = (
    headers: string[],
    aliases: string[],
  ): string | undefined => {
    const normalizedHeaders = headers.map((header) => ({
      original: header,
      normalized: normalizeHeader(header),
    }));

    const normalizedAliases = aliases.map(normalizeHeader);

    return normalizedHeaders.find(({ normalized }) =>
      normalizedAliases.includes(normalized),
    )?.original;
  };
  const PHONE_ALIASES = [
    "phone",
    "phone_number",
    "phonenumber",
    "mobile",
    "mobile_number",
    "mobilenumber",
    "contact",
    "contact_number",
    "contactnumber",
    "whatsapp",
    "whatsapp_number",
    "whatsappnumber",
    "number",
    "cell",
    "telephone",
  ];

  const NAME_ALIASES = [
    "name",
    "full_name",
    "fullname",
    "contact_name",
    "contactname",
  ];

  const EMAIL_ALIASES = ["email", "email_address", "emailaddress", "mail"];

  const wabaOptions: CustomDropdownOption[] = phoneNumbers.map((item) => ({
    value: item.id,
    label: item.display_phone_number,
    meta: item.verified_name,
  }));
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        setPhoneNumbersLoading(true);

        const response = await soft7AxiosInstance.get(
          "/admin/waba/phone-numbers",
        );

        if (response.data?.success) {
          setPhoneNumbers(response.data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch phone numbers:", error);
        toast.error("Failed to load WhatsApp numbers");
      } finally {
        setPhoneNumbersLoading(false);
      }
    };

    fetchPhoneNumbers();
  }, []);
  useEffect(() => {
    const fetchContactColumns = async () => {
      try {
        setContactColumnsLoading(true);

        const response = await soft7AxiosInstance.get("/admin/columns/");

        if (response.data?.success) {
          setContactColumns(response.data.data || []);
        } else {
          toast.error("Failed to load contact columns");
        }
      } catch (error) {
        console.error("Failed to fetch contact columns:", error);
        toast.error("Failed to load contact columns");
      } finally {
        setContactColumnsLoading(false);
      }
    };

    fetchContactColumns();
  }, []);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await soft7AxiosInstance.get("/admin/contacts/tags");
        if (response.data?.success) {
          setAvailableTags(response.data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    };

    fetchTags();
  }, []);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (uploadedFile: File) => {
    if (!listName.trim()) {
      toast.error("List name is required");
      return;
    }
    if (!selectedPhoneNumberId) {
      toast.error("Please select a WhatsApp Business Number");
      return;
    }

    if (uploadedFile.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit");
      return;
    }

    const fileExt = uploadedFile.name.split(".").pop()?.toLowerCase();

    if (fileExt === "xlsx" || fileExt === "xls") {
      setFileName(uploadedFile.name);
      parseExcel(uploadedFile);
    } else if (fileExt === "csv") {
      setFileName(uploadedFile.name);
      parseCSV(uploadedFile);
    } else {
      toast.error("Please upload a valid file (.xlsx, .xls, or .csv)");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      processFile(uploadedFile);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      processFile(droppedFiles[0]);
    }
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        const headers: string[] = [];
        if (jsonData.length > 0 && jsonData[0]) {
          Object.keys(jsonData[0]).forEach((key) => {
            if (typeof key === "string") {
              headers.push(key);
            }
          });
        }

        setCsvHeaders(headers);

        const rows = jsonData.map((row: ExcelRow) => {
          const rowData: Record<string, string> = {};
          headers.forEach((header) => {
            const value = row[header];
            rowData[header] =
              value !== null && value !== undefined ? String(value) : "";
          });
          return rowData;
        });

        setCsvData(rows);
        setFile(file);

        setFieldMappings({});

        setStep(2);
        toast.success(`Loaded ${rows.length} contacts from Excel`);
      } catch (error) {
        console.error("Excel parsing error:", error);
        toast.error("Failed to parse Excel file");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
          toast.error("CSV file is empty");
          return;
        }

        // Parse headers from first line
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));

        // Parse data rows
        const rows = lines.slice(1).map((line) => {
          const rowData: Record<string, string> = {};
          const values = parseCSVLine(line);
          headers.forEach((header, index) => {
            rowData[header] = values[index] || "";
          });
          return rowData;
        });

        if (rows.length === 0) {
          toast.error("CSV file has no data rows");
          return;
        }

        setCsvHeaders(headers);
        setCsvData(rows);
        setFile(file);

        setFieldMappings({});
        setStep(2);
        toast.success(`Loaded ${rows.length} contacts from CSV`);
      } catch (error) {
        console.error("CSV parsing error:", error);
        toast.error("Failed to parse CSV file");
      }
    };

    reader.readAsText(file);
  };

  // Helper function to parse CSV line correctly (handles quoted values)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim().replace(/^"|"$/g, ""));
    return result;
  };

  // Mapping is stored as: database column ID -> file column header
  const handleMappingChange = (columnId: string, fileHeader: string) => {
    setFieldMappings((prev) => {
      const next = { ...prev };

      // A database column can only be mapped to one file column.
      delete next[columnId];

      if (fileHeader) {
        // A file column can also only be used once.
        Object.keys(next).forEach((mappedColumnId) => {
          if (next[mappedColumnId] === fileHeader) {
            delete next[mappedColumnId];
          }
        });
        next[columnId] = fileHeader;
      }

      return next;
    });
  };

  const BASE_COMPULSORY_COLUMNS: ContactColumn[] = [
    { id: "name", label: "Name", type: "string", visible: true },
    { id: "phone", label: "Phone Number", type: "string", visible: true },
    { id: "email", label: "Email", type: "string", visible: true },
    { id: "status", label: "Status", type: "string", visible: true },
    { id: "tags", label: "Tags", type: "string", visible: true },
    { id: "opt_in", label: "Opt In", type: "string", visible: true },
    { id: "assigned_to", label: "Assigned To", type: "string[]", visible: true },
  ];

  const activeColumns = [
    ...BASE_COMPULSORY_COLUMNS,
    ...contactColumns.filter(c =>
      !BASE_COMPULSORY_COLUMNS.some(b => b.id.toLowerCase() === (c.id || "").toLowerCase() || b.label.toLowerCase() === (c.label || "").toLowerCase())
    )
  ];

  const visibleContactColumns = activeColumns.filter(
    (column) => column.visible === true || column.visible === "true" || String(column.visible) === "true",
  );

  const getColumnById = (columnId: string) =>
    activeColumns.find((column) => column.id === columnId);

  const normalizeColumnLabel = (label: string) =>
    (label || "")
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, "");

  // Auto-map file headers to database columns when Step 2 opens
  useEffect(() => {
    if (step === 2 && csvHeaders.length > 0 && activeColumns.length > 0 && Object.keys(fieldMappings).length === 0) {
      const initialMappings: Record<string, string> = {};
      const usedHeaders = new Set<string>();

      visibleContactColumns.forEach((col) => {
        const normColLabel = normalizeColumnLabel(col.label);

        // 1. Try exact or normalized match with csvHeaders
        let matchedHeader = csvHeaders.find(
          (h) => !usedHeaders.has(h) && normalizeColumnLabel(h) === normColLabel
        );

        // 2. Try alias matching if not matched
        if (!matchedHeader) {
          let aliases: string[] = [];
          if (normColLabel.includes("phone") || normColLabel.includes("mobile") || normColLabel.includes("number") || normColLabel.includes("contact")) {
            aliases = PHONE_ALIASES;
          } else if (normColLabel.includes("name")) {
            aliases = NAME_ALIASES;
          } else if (normColLabel.includes("email") || normColLabel.includes("mail")) {
            aliases = EMAIL_ALIASES;
          }

          if (aliases.length > 0) {
            matchedHeader = findMatchingHeader(
              csvHeaders.filter((h) => !usedHeaders.has(h)),
              aliases
            );
          }
        }

        if (matchedHeader) {
          initialMappings[col.id] = matchedHeader;
          usedHeaders.add(matchedHeader);
        }
      });

      if (Object.keys(initialMappings).length > 0) {
        setFieldMappings(initialMappings);
      }
    }
  }, [step, csvHeaders, contactColumns]);

  const getMappedFileHeaderForDatabaseColumn = (labels: string[]): string | undefined => {
    const normalizedLabels = labels.map(normalizeColumnLabel);
    // 1. Find by database column label
    const databaseColumn = activeColumns.find((column) => {
      const norm = normalizeColumnLabel(column.label);
      return normalizedLabels.some((l) => norm.includes(l) || l.includes(norm));
    });

    if (databaseColumn && fieldMappings[databaseColumn.id]) {
      return fieldMappings[databaseColumn.id];
    }

    // 2. Check if any mapped file header in fieldMappings matches aliases
    for (const [colId, fileHeader] of Object.entries(fieldMappings)) {
      if (fileHeader && normalizedLabels.some((l) => normalizeColumnLabel(fileHeader).includes(l))) {
        return fileHeader;
      }
    }

    // 3. Fallback: check csvHeaders directly
    return findMatchingHeader(csvHeaders, labels);
  };

  const mappedPhoneHeader = getMappedFileHeaderForDatabaseColumn(PHONE_ALIASES);
  const mappedNameHeader = getMappedFileHeaderForDatabaseColumn(NAME_ALIASES);
  const mappedEmailHeader = getMappedFileHeaderForDatabaseColumn(EMAIL_ALIASES);

  const phoneColumn = fieldMappings["phone"] || mappedPhoneHeader || csvHeaders.find((h) => /phone|mobile|number|contact/i.test(h)) || "";
  const nameColumn = fieldMappings["name"] || mappedNameHeader || csvHeaders.find((h) => /name|contact/i.test(h)) || csvHeaders[0] || "";
  const emailColumn = fieldMappings["email"] || mappedEmailHeader || csvHeaders.find((h) => /email|mail/i.test(h)) || "";

  const hasRequiredMappings = Boolean(
    phoneColumn && nameColumn
  );

  useEffect(() => {
    if (previewControllerRef.current) {
      previewControllerRef.current.abort();
      previewControllerRef.current = null;
      setIsProcessing(false);
    }
    previewUploadFileRef.current = null;
    setValidationResults(null);
    setPreviewError(null);
    setStep((current) => current === 3 ? 2 : current);
  }, [file, csvData, fieldMappings, countryCode, selectedPhoneNumberId, phoneColumn, nameColumn, emailColumn]);

  const validateData = async () => {
    if (isProcessing || previewControllerRef.current) return;
    if (!file || !hasRequiredMappings) {
      toast.error("Choose a file and map its phone and name columns before generating the preview.");
      return;
    }
    const controller = new AbortController();
    previewControllerRef.current = controller;
    previewUploadFileRef.current = null;
    setValidationResults(null);
    setPreviewError(null);
    setIsProcessing(true);
    const toastId = toast.loading("Generating contact preview...");

    try {
      const uploadFile = getUploadFile();
      if (!uploadFile) throw new Error("Choose a file before generating the preview.");
      const form = createImportPreviewForm(uploadFile, { phone: phoneColumn, name: nameColumn });
      const response = await soft7AxiosInstance.post("/admin/contacts/import/preview", form, { signal: controller.signal });
      if (controller.signal.aborted || previewControllerRef.current !== controller) {
        toast.dismiss(toastId);
        return;
      }
      const preview = normalizeImportPreview(response.data);
      previewUploadFileRef.current = uploadFile;
      setValidationResults(preview);
      setStep(3);
      toast.success("Preview ready. Review the contacts before importing.", { id: toastId });
    } catch (error) {
      if (controller.signal.aborted) {
        toast.dismiss(toastId);
        return;
      }
      const message = getBackendErrorMessage(error);
      setPreviewError(message);
      toast.error(message, { id: toastId });
    } finally {
      if (previewControllerRef.current === controller) {
        previewControllerRef.current = null;
        setIsProcessing(false);
      }
    }
  };

  const getUploadFile = (): File | null => {
    if (!file) return null;

    if (csvData.length === 0 || csvHeaders.length === 0) {
      return file;
    }

    // Convert parsed & normalized rows to an in-memory xlsx file before upload
    // to guarantee 100% header alignment with column_mappings sent to backend.
    const worksheet = XLSX.utils.json_to_sheet(csvData, { header: csvHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    const workbookArray = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([workbookArray], `${baseName}.xlsx`, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  };

  // Track imports with their own endpoint; media jobs use /image-upload/jobs/:id.
  const startPolling = (
    id: string,
    controller: AbortController,
    notification: ReturnType<typeof createJobToast>,
  ) => {
    let latestStats = getImportJobStats({});
    notification.update({
      status: "queued", stage: "queued", progress: 0,
      estimatedRemainingSeconds: null, result: null, errorMessage: null, raw: {},
    });

    void (async () => {
      try {
        const completed = await waitForJob(`/admin/contacts/import/${encodeURIComponent(id)}/status`, {
          signal: controller.signal,
          intervalMs: 3000,
          normalizeStatus: normalizeImportJobSnapshot,
          onRetry: notification.reconnecting,
          onStatus: (job) => {
            latestStats = getImportJobStats(job.raw, latestStats);
            notification.update(job, getImportCountItems(latestStats));
          },
        });
        latestStats = getImportJobStats(completed.raw, latestStats);
        notification.complete(`Import complete! ${getImportResultSummary(latestStats)}`, getImportCountItems(latestStats));
        onImportSuccess();
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = getBackendErrorMessage(error);
        notification.fail(message);
      } finally {
        if (pollingControllerRef.current === controller) pollingControllerRef.current = null;
        if (dialogAttachedRef.current && !controller.signal.aborted) setIsProcessing(false);
      }
    })();
  };

  const getBackendErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (typeof data === "string" && data.trim()) {
        return data;
      }

      const backendMessage =
        data?.message ||
        data?.error ||
        data?.detail ||
        data?.errors?.[0]?.message;

      if (backendMessage) return backendMessage;

      if (status === 403) {
        return "You don't have permission to perform this import (403 Forbidden).";
      }
      if (status === 401) {
        return "Your session has expired. Please log in again.";
      }

      return error.message || "Failed to import contacts";
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Failed to import contacts";
  };

  const handleImport = async () => {
    if (isProcessing || pollingControllerRef.current) return;
    if (!validationResults) {
      toast.error("Please validate data before importing");
      return;
    }

    if (validationResults.importableCount === 0) {
      toast.error("The preview contains no importable contacts. Fix the file or its column mappings first.");
      return;
    }
    if (!selectedPhoneNumberId) {
      toast.error("Please select WhatsApp Business Number");
      return;
    }
    if (!listName.trim()) {
      toast.error("List name is required");
      return;
    }
    const uploadFile = previewUploadFileRef.current;
    if (!uploadFile) {
      toast.error("Generate a fresh preview before importing this file.");
      return;
    }
    setIsProcessing(true);
    const controller = new AbortController();
    pollingControllerRef.current = controller;
    const notification = createJobToast(`Import: ${listName}`);
    let queued = false;
    try {
      const formData = createImportPreviewForm(uploadFile, { phone: phoneColumn, name: nameColumn });
      formData.append("list_name", listName);

      if (emailColumn) formData.append("email_column", emailColumn);
      formData.append("column_mappings", JSON.stringify(fieldMappings));
      formData.append("phone_number_id", selectedPhoneNumberId);
      if (countryCode) {
        formData.append("country_code", `+${countryCode}`);
      }
      if (selectedTagIds.length > 0) {
        formData.append("tag_ids", selectedTagIds.join(","));
        formData.append("tag_id", selectedTagIds[0] || "");
        formData.append("tags", selectedTagIds.join(","));
      }

      console.log("📤 Uploading import file...", {
        listName,
        phoneColumn,
        nameColumn,
        emailColumn,
        columnMappings: fieldMappings,
        totalRows: csvData.length,
        tags: selectedTagIds,
      });

      // The prepared upload and global notification continue after the dialog closes.
      resetAndClose();
      const response = await soft7AxiosInstance.post(
        "/admin/contacts/import",
        formData,
        {
          signal: controller.signal,
          onUploadProgress: ({ loaded, total }) => notification.update({
            status: "uploading", stage: total && loaded >= total ? "processing" : "uploading",
            progress: total ? Math.min(100, Math.round(loaded / total * 100)) : null,
            estimatedRemainingSeconds: null, result: null, errorMessage: null, raw: {},
          }),
        },
      );
      const result = response.data;
      if (result?.success === false) {
        throw new Error(result.message || "Failed to import contacts");
      }
      console.log("📥 Import API response:", result);

      // ── Async / queued job ──
      const jobData = result?.data;
      if (jobData?.job_id) {
        queued = true;
        startPolling(jobData.job_id, controller, notification);
        return;
      }

      notification.complete(`Successfully imported ${csvData.length} contacts!`);
      onImportSuccess();
    } catch (error) {
      if (controller.signal.aborted) return;
      const errorMessage = getBackendErrorMessage(error);

      console.error("Import failed:", error);
      notification.fail(errorMessage);
    } finally {
      if (!queued) {
        if (pollingControllerRef.current === controller) pollingControllerRef.current = null;
        if (dialogAttachedRef.current) setIsProcessing(false);
      }
    }
  };

  const resetAndClose = () => {
    // Closing the dialog detaches its UI, without cancelling the backend job.
    dialogAttachedRef.current = false;
    previewControllerRef.current?.abort();
    previewControllerRef.current = null;
    previewUploadFileRef.current = null;
    onClose();
  };
  const handleContinueToMapping = () => {
    if (!listName.trim()) {
      toast.error("List name is required");
      return;
    }

    if (!selectedPhoneNumberId) {
      toast.error("Please select a WhatsApp Business Number");
      return;
    }

    if (!file || csvData.length === 0) {
      toast.error("Please upload a contact file");
      return;
    }

    setStep(2);
  };
  return (
    <div className="fixed inset-0 import-modal bg-black/50 dark:bg-black/70 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
      <div className="import-export-modal rounded-[16px] w-full max-w-[720px] max-h-[95vh] overflow-y-auto transform transition-all duration-300 scale-100 bg-surface dark:bg-card text-foreground shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),0_2px_10px_rgba(36,28,20,0.05)] border-none">
        <div className="p-8 text-foreground">
          {/* Header */}
          <div
            className="px-8 py-[26px] pb-6 flex items-start justify-between shrink-0 relative overflow-hidden -mx-8 -mt-8 mb-0"
            style={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary) 100%)",
            }}
          >
            <div
              className="absolute w-[220px] h-[220px] rounded-full -top-[120px] -right-[60px] pointer-events-none"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)" }}
            ></div>

            <div className="flex items-start gap-[14px] relative z-10">
              <div
                className="w-[42px] h-[42px] rounded-[12px] flex items-center justify-center shrink-0 mt-[2px]"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-white"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-[22px] font-semibold tracking-tight mb-[5px] text-white">
                  Import contacts
                </h1>
                <p className="text-white/85 text-[14px] max-w-[42ch] leading-relaxed m-0">
                  Bring in your contact list from an Excel or CSV file and map
                  it to your WhatsApp campaigns.
                </p>
              </div>
            </div>
            <button
              onClick={resetAndClose}
              className="w-[34px] h-[34px] shrink-0 rounded-full border-none flex items-center justify-center text-white transition-colors relative z-10 hover:opacity-80"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)" }}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Stepper */}
          <div
            className="flex items-center px-8 py-[18px] gap-1 shrink-0 border-b border-border -mx-8 mb-6"
            style={{ backgroundColor: "var(--color-surface-hover)" }}
          >
            {/* Step 1 */}
            <div className="flex items-center gap-[11px] flex-1">
              <div
                className={`w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold border-[1.5px] transition-all duration-200 ${step === 1 ? "bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.18)]" : step > 1 ? "bg-primary border-border text-primary-foreground" : "bg-card border-border text-muted-foreground"}`}
              >
                {step > 1 ? <Check size={14} /> : "1"}
              </div>
              <div className="leading-tight">
                <div
                  className={`text-[13.5px] font-semibold ${step === 1 ? "text-primary-text" : "text-foreground dark:text-white"}`}
                >
                  Upload file
                </div>
                <div className="text-[12px] text-muted-foreground mt-[1px]">
                  .xlsx, .xls or .csv
                </div>
              </div>
            </div>
            <div
              className={`h-[2px] w-7 flex-shrink-0 mx-0.5 rounded-[2px] ${step >= 2 ? "bg-primary" : "bg-surface-active"}`}
            ></div>

            {/* Step 2 */}
            <div className="flex items-center gap-[11px] flex-1">
              <div
                className={`w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold border-[1.5px] transition-all duration-200 ${step === 2 ? "bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.18)]" : step > 2 ? "bg-primary border-border text-primary-foreground" : "bg-card border-border text-muted-foreground"}`}
              >
                {step > 2 ? <Check size={14} /> : "2"}
              </div>
              <div className="leading-tight">
                <div
                  className={`text-[13.5px] font-semibold ${step === 2 ? "text-primary-text" : "text-foreground dark:text-white"}`}
                >
                  Map columns
                </div>
                <div className="text-[12px] text-muted-foreground mt-[1px]">
                  Match file to database
                </div>
              </div>
            </div>
            <div
              className={`h-[2px] w-7 flex-shrink-0 mx-0.5 rounded-[2px] ${step >= 3 ? "bg-primary" : "bg-surface-active"}`}
            ></div>

            {/* Step 3 */}
            <div className="flex items-center gap-[11px] flex-1">
              <div
                className={`w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold border-[1.5px] transition-all duration-200 ${step >= 3 ? "bg-primary border-primary text-primary-foreground shadow-[0_0_0_4px_rgba(var(--color-primary-rgb),0.18)]" : "bg-card border-border text-muted-foreground"}`}
              >
                3
              </div>
              <div className="leading-tight">
                <div
                  className={`text-[13.5px] font-semibold ${step >= 3 ? "text-primary-text" : "text-foreground dark:text-white"}`}
                >
                  Import
                </div>
                <div className="text-[12px] text-muted-foreground mt-[1px]">
                  Verify & confirm
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Upload File */}
          {step === 1 && (
            <div className="pt-2 px-8 -mx-8 pb-2">
              <div
                className="flex gap-3 px-4 py-[14px] rounded-[11px] mb-[26px]"
                style={{ backgroundColor: "var(--color-surface-hover)" }}
              >
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[14px] h-[14px] text-white"
                  >
                    <line x1="12" y1="8" x2="12" y2="12.5" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="text-[13.5px] leading-relaxed text-primary-text m-0 pt-[3px]">
                  <strong className="text-primary-text">Before you upload:</strong>{" "}
                  keep the file under 10MB and include the headers you want to
                  import. You will map each file column to a database column in
                  the next step.
                </div>
              </div>

              {/* List Name */}
              <div className="mb-[22px]">
                <label className="block text-[13.5px] font-semibold mb-[7px] text-foreground">
                  List name
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-[13px] top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="e.g. Diwali Campaign — Leads"
                    className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted py-[11px] pl-[38px] pr-[14px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                  />
                </div>
                <div className="text-[12px] text-muted-foreground mt-[6px]">
                  This is how you'll find this list later in your contacts.
                </div>
              </div>

              {/* Country Code and WABA Number */}
              <div className="grid grid-cols-[145px_1fr] gap-3 mb-[10px]">
                <div>
                  <label className="block text-[13.5px] font-semibold mb-[7px] text-foreground">
                    Country code
                  </label>
                  <SearchableCountryDropdown
                    value={countryCode}
                    onChange={setCountryCode}
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold mb-[7px] text-foreground">
                    WhatsApp Business number{" "}
                    <span className="text-primary-text ml-[2px]">*</span>
                  </label>
                  <CustomDropdown
                    value={selectedPhoneNumberId}
                    onChange={setSelectedPhoneNumberId}
                    options={wabaOptions}
                    placeholder="Select WhatsApp Number"
                    loading={phoneNumbersLoading}
                  />
                </div>
              </div>
              <div className="text-[12px] text-muted-foreground mb-[22px]">
                Select a country code to add it to numbers that need one, or leave it blank to import without adding a country code.
              </div>

              {/* Tags */}
              <div className="mb-[22px]">
                <label className="block text-[13.5px] font-semibold mb-[7px] text-foreground">
                  Tags (Optional)
                </label>
                <MultiSelectTagsDropdown
                  options={availableTags}
                  selectedValues={selectedTagIds}
                  onChange={setSelectedTagIds}
                  placeholder="Select tags to attach to imported contacts..."
                />
                <div className="text-[12px] text-muted-foreground mt-[6px]">
                  Selected tags will be automatically added to all contacts in this import.
                </div>
              </div>

              {/* File Dropzone */}
              <div className="mb-[26px]">
                <label className="block text-[13.5px] font-semibold mb-[7px] text-foreground">
                  File
                </label>
                <div
                  className={`border-[1.5px] border-dashed rounded-[11px] px-5 py-[32px] text-center transition-all duration-150 cursor-pointer ${
                    isDragging
                      ? "border-primary bg-surface-hover -translate-y-[1px]"
                      : "border-primary hover:border-primary hover:bg-surface-hover hover:-translate-y-[1px]"
                  }`}
                  style={{
                    background: isDragging
                      ? undefined
                      : "linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-hover) 100%)",
                  }}
                  onClick={() => document.getElementById("fileInput")?.click()}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className="w-[48px] h-[48px] mx-auto mb-[14px] rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(var(--color-primary-rgb),0.45)]"
                      style={{
                        background: "linear-gradient(135deg, var(--color-primary), var(--color-primary))",
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-[21px] h-[21px]"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <h3 className="text-[14.5px] font-semibold mb-[4px] text-foreground">
                      {isDragging
                        ? "Drop your file here"
                        : "Drag your file here, or browse"}
                    </h3>
                    <p className="text-[12.5px] text-muted-foreground mb-[16px]">
                      We'll read the file headers on the next step
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById("fileInput")?.click();
                      }}
                      className="inline-block px-[18px] py-[9px] rounded-[8px] bg-surface border-[1.5px] border-primary text-[13px] font-semibold text-primary-text transition-colors hover:bg-surface-hover"
                    >
                      Choose file
                    </button>
                    <div className="flex justify-center gap-2 mt-[18px] flex-wrap pointer-events-none">
                      <span className="text-[11.5px] px-[11px] py-[4px] rounded-[20px] bg-surface border border-border text-muted-foreground font-semibold tracking-[0.02em]">
                        .XLSX
                      </span>
                      <span className="text-[11.5px] px-[11px] py-[4px] rounded-[20px] bg-surface border border-border text-muted-foreground font-semibold tracking-[0.02em]">
                        .XLS
                      </span>
                      <span className="text-[11.5px] px-[11px] py-[4px] rounded-[20px] bg-surface border border-border text-muted-foreground font-semibold tracking-[0.02em]">
                        .CSV
                      </span>
                      <span className="text-[11.5px] px-[11px] py-[4px] rounded-[20px] bg-surface border border-border text-muted-foreground font-semibold tracking-[0.02em]">
                        Up to 10MB
                      </span>
                    </div>
                  </div>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {fileName && (
                  <div className="mt-6 p-4 bg-surface border border-border rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[14px] text-foreground font-medium">
                        {fileName}
                      </span>
                      <span className="ml-3 text-[11.5px] px-2 py-1 rounded-[20px] bg-primary-light text-[var(--color-primary-hover)] border border-[var(--color-primary-hover)]/20">
                        {fileName.toLowerCase().endsWith(".csv")
                          ? "CSV File"
                          : "Excel File"}
                      </span>
                    </div>
                    <span className="text-[13px] text-muted-foreground">
                      {file?.size ? (file.size / 1024).toFixed(2) : 0} KB
                    </span>
                  </div>
                )}
              </div>

              {/* Step 1 Footer */}
              <div className="flex justify-end gap-[10px] mt-2 pt-[18px] border-t border-border -mx-8 px-8 mb-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-[22px] py-[12px] rounded-[8px] text-[14px] font-semibold bg-surface border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinueToMapping}
                  disabled={!file || csvData.length === 0}
                  className="px-[22px] py-[12px] rounded-[8px] text-[14px] font-semibold text-white shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)] hover:brightness-105 hover:-translate-y-px transition-all duration-150 disabled:bg-primary-soft disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none disabled:hover:brightness-100"
                  style={{
                    background:
                      !file || csvData.length === 0
                        ? "var(--color-surface-active)"
                        : "var(--color-primary)",
                  }}
                >
                  Continue to mapping
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Map Fields */}
          {step === 2 && (
            <div className="import-step-card rounded-2xl p-6 sm:p-8 bg-card text-foreground border border-border shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 text-foreground">
                  Map Variables
                </h2>
                <p className="text-muted-foreground text-sm">
                  Select the file column that should be imported into each
                  database column.
                </p>
              </div>
              {contactColumnsLoading ? (
                <div className="rounded-xl border border-border bg-muted px-4 py-8 text-center">
                  <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary-soft border-t-primary" />
                  <p className="text-sm text-muted-foreground">
                    Loading database columns...
                  </p>
                </div>
              ) : visibleContactColumns.length === 0 ? (
                <div className="rounded-xl border border-error-border bg-error-bg px-4 py-6 text-center">
                  <p className="text-sm font-medium text-error">
                    No visible database columns are available.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <div className="min-w-[620px]">
                    <div className="grid grid-cols-[1fr_260px] gap-4 bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <div>Database Column</div>
                      <div>File Column</div>
                    </div>

                    <div className="divide-y divide-border">
                      {visibleContactColumns.map((column) => {
                        const selectedFileHeader =
                          fieldMappings[column.id] || "";

                        return (
                          <div
                            key={column.id}
                            className="grid grid-cols-[1fr_260px] gap-4 items-center px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {column.label}
                              </div>
                            </div>

                            <select
                              disabled={isProcessing}
                              value={selectedFileHeader}
                              onChange={(e) =>
                                handleMappingChange(column.id, e.target.value)
                              }
                              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                            >
                              <option value="">Select</option>
                              {csvHeaders.map((header) => (
                                <option key={header} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isProcessing}
                  className="px-[22px] py-[12px] rounded-[8px] text-[14px] font-semibold bg-card border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={validateData}
                  disabled={
                    !hasRequiredMappings ||
                    isProcessing ||
                    contactColumnsLoading
                  }
                  className="px-6 py-2 bg-primary rounded-xl hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-primary-foreground font-medium shadow-lg"
                >
                  {isProcessing ? "Generating preview..." : "Verify Data"}
                  {!isProcessing && <ArrowRight size={16} />}
                </button>
              </div>
              {previewError && <p role="alert" className="mt-4 rounded-xl p-3 border border-error-border bg-error-bg text-sm text-error">{previewError}</p>}
            </div>
          )}

          {/* Step 3: Import */}
          {step === 3 && validationResults && (
            <div className="import-step-card rounded-2xl p-6 sm:p-8 bg-card text-foreground border border-border shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 text-foreground">
                  Ready to Import
                </h2>
                <p className="text-sm">
                  <span className="text-[var(--color-primary)] dark:text-[var(--color-primary)] font-semibold">
                    {validationResults.importableCount.toLocaleString()} contacts ready to import
                  </span>
                  {validationResults.totalRows -
                    validationResults.importableCount >
                    0 && (
                    <>
                      ,{" "}
                      <span className="text-error dark:text-error font-semibold">
                        {(validationResults.totalRows - validationResults.importableCount).toLocaleString()}{" "}
                        are not importable
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl p-6 bg-muted border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Total Contacts
                  </h3>
                  <p className="font-display text-3xl font-bold text-foreground">
                    {validationResults.totalRows.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl p-6 bg-muted border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Valid Contacts
                  </h3>
                  <p className="font-display text-3xl font-bold text-[var(--color-primary)] dark:text-[var(--color-primary)]">
                    {validationResults.validCount.toLocaleString()}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                Phone column: {validationResults.selectedPhoneColumn || phoneColumn}{" · "}Name column: {nameColumn}
              </p>
              <ImportPreviewDetails preview={validationResults} />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {Object.keys(fieldMappings).length} of {csvHeaders.length}{" "}
                    file columns mapped
                  </span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto items-center">
                  <button
                    onClick={() => setStep(2)}
                    disabled={isProcessing}
                    className="px-[22px] py-[12px] rounded-[8px] text-[14px] font-semibold bg-card border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={
                      isProcessing ||
                      validationResults.importableCount === 0
                    }
                    className="flex-1 sm:flex-none px-6 py-2 bg-primary rounded-xl hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-primary-foreground font-medium shadow-lg"
                  >
                    {isProcessing
                      ? "Importing..."
                      : `Import ${validationResults.importableCount.toLocaleString()} Contacts`}
                    {!isProcessing && <ArrowRight size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default ImportContacts;
