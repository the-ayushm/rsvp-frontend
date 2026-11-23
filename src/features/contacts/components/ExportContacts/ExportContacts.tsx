"use client";

import { useState, useRef, useEffect } from "react";
import { FileSpreadsheet, FileText, Loader2, X, Download, Plus, ChevronDown, Check } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface ApiContact {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  source?: string | null;
  assigned_to?: string[] | null;
  status?: string | null;
  notes?: string | null;
  message_count?: number;
  failed_count?: number;
  is_valid?: boolean;
  invalid_reason?: string | null;
  attributes?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_contacted_at?: string | null;
  tags?: Array<string | { id?: string; name?: string; label?: string }>;
  [key: string]: unknown;
}

interface ExportContactsProps {
  onClose: () => void;
}

const CONTACTS_API = "/admin/contacts";
const PAGE_LIMIT = 500;

const formatTags = (tags?: ApiContact["tags"]): string => {
  if (!Array.isArray(tags)) return "";

  return tags
    .map((tag) => {
      if (typeof tag === "string") return tag;
      return tag?.name || tag?.label || "";
    })
    .filter(Boolean)
    .join(", ");
};

interface ExportColumnDef {
  id: string;
  header: string;
  getValue: (contact: ApiContact) => string | number;
}

const ALL_EXPORT_COLUMNS: ExportColumnDef[] = [
  { id: "name", header: "Name", getValue: (contact) => contact.name || "" },
  { id: "phone", header: "Phone Number", getValue: (contact) => contact.phone_number || "" },
  { id: "email", header: "Email", getValue: (contact) => contact.email || "" },
  { id: "tags", header: "Tags", getValue: (contact) => formatTags(contact.tags) },
  { id: "source", header: "Source", getValue: (contact) => contact.source || "" },
  { id: "status", header: "Status", getValue: (contact) => contact.status || "" },
  { id: "assigned", header: "Assigned To",  getValue: (contact) => (contact.assigned_to || []).join(", "), },
  { id: "message_count", header: "Message Count", getValue: (contact) => contact.message_count || 0 },
  { id: "created_at", header: "Created At", getValue: (contact) => contact.created_at || "" },
];

const DEFAULT_SELECTED_KEYS = ["name", "phone", "email"];

const csvEscape = (value: string | number): string => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

async function fetchAllContacts(): Promise<ApiContact[]> {
  const collected: ApiContact[] = [];
  let currentPage = 1;
  let totalPages: number | null = null;

  while (totalPages === null || currentPage <= totalPages) {
    const { data: result } = await soft7AxiosInstance.get(CONTACTS_API, {
      params: { page: currentPage, limit: PAGE_LIMIT, sortBy: 'created_at', sortOrder: 'desc' },
    });

    const contacts: ApiContact[] =
      result?.data?.contacts ??
      result?.data?.data ??
      result?.data ??
      [];

    collected.push(...contacts);

    const pagination =
      result?.data?.pagination ??
      result?.pagination ??
      result?.meta ??
      {};

    if (totalPages === null) {
      if (pagination?.total_pages) {
        totalPages = Number(pagination.total_pages);
      } else if (pagination?.total) {
        totalPages = Math.ceil(Number(pagination.total) / PAGE_LIMIT);
      } else if (contacts.length < PAGE_LIMIT) {
        totalPages = currentPage;
      }
    }

    if (contacts.length === 0 || currentPage >= 2000) break;
    currentPage += 1;
  }

  return collected;
}

const ModalWrapper = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
    <div className="bg-surface dark:bg-card text-foreground w-full max-w-2xl rounded-[16px] shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),0_2px_10px_rgba(36,28,20,0.05)] flex flex-col max-h-[90vh] overflow-hidden">
      
      <div className="px-8 py-[26px] pb-6 flex items-start justify-between relative overflow-hidden bg-gradient-to-br from-primary to-primary">
        <div className="absolute w-[220px] h-[220px] rounded-full -top-[120px] -right-[60px] pointer-events-none" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)' }}></div>
          
          <div className="flex items-start gap-[14px] relative z-10">
            <div className="w-[42px] h-[42px] rounded-[12px] flex items-center justify-center shrink-0 mt-[2px]" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
            </div>
            <div>
              <h1 className="font-display text-[22px] font-semibold tracking-tight mb-[5px] text-white">Export contacts</h1>
              <p className="text-white/85 text-[14px] max-w-[42ch] leading-relaxed m-0">
                Download your contacts to a CSV file for external use.
              </p>
            </div>
          </div>
        <button 
          onClick={onClose} 
          className="w-[34px] h-[34px] shrink-0 rounded-full border-none flex items-center justify-center text-white transition-colors relative z-10 hover:opacity-80"
          style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)' }}
        >
          <X size={15} />
        </button>
      </div>
    
      {children}
    </div>
  </div>
);

export const ExportContacts = ({ onClose }: ExportContactsProps) => {
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "excel">("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [availableColumns, setAvailableColumns] = useState<ExportColumnDef[]>(ALL_EXPORT_COLUMNS);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(DEFAULT_SELECTED_KEYS);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [pipelineStages, setPipelineStages] = useState<any[]>([]);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/pipeline");
        if (res.data?.success && Array.isArray(res.data.data)) {
          setPipelineStages(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch pipeline stages for export:", err);
      }
    };
    fetchStages();
  }, []);

  // Fetch custom columns created by user via backend API on mount
  useEffect(() => {
    const fetchCustomColumns = async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/columns/");
        if (res.data.success && Array.isArray(res.data.data)) {
          const fetched: any[] = res.data.data;
          const extraCols: ExportColumnDef[] = [];

          fetched.forEach((col: any) => {
            const label = col.label || "";
            if (!label) return;
            const isVis = col.visible === true || String(col.visible).toLowerCase() === "true" || col.visible === 1;
            if (!isVis) return;

            const norm = label.toLowerCase().trim();
            const isBase = [
              "name", "phone", "phone number", "phone_number", "email", "tags", "tag",
              "source", "status", "assigned to", "assigned_to", "assigned",
              "message count", "message_count", "created at", "created_at", "created"
            ].includes(norm);

            if (!isBase) {
              const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
              if (!extraCols.some((c) => c.id === id)) {
                extraCols.push({
                  id,
                  header: label,
                  getValue: (contact) => {
                    const fields = {
                      ...(contact.attributes && typeof contact.attributes === "object" ? contact.attributes : {}),
                      ...(contact.custom_fields && typeof contact.custom_fields === "object" ? contact.custom_fields : {}),
                    };
                    if (fields[label] !== undefined && fields[label] !== null) {
                      return String(fields[label] ?? "");
                    }
                    const n = label.toLowerCase().replace(/[\s_-]+/g, "");
                    for (const [k, v] of Object.entries(fields)) {
                      if (k.toLowerCase().replace(/[\s_-]+/g, "") === n) {
                        return String(v ?? "");
                      }
                    }
                    return "";
                  },
                });
              }
            }
          });

          if (extraCols.length > 0) {
            setAvailableColumns((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const newUnique = extraCols.filter((c) => !existingIds.has(c.id));
              return [...prev, ...newUnique];
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch custom columns for export:", err);
      }
    };

    fetchCustomColumns();
  }, []);

  const toggleFieldKey = (key: string) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDownload = async () => {
    setIsExporting(true);
    setProgress("Fetching contacts...");

    try {
      const contacts = await fetchAllContacts();

      if (contacts.length === 0) {
        toast.error("No contacts available to export");
        setIsExporting(false);
        return;
      }

      // Dynamically extract any user-created attributes/custom_fields from fetched contacts
      const updatedAvailable = [...availableColumns];
      contacts.forEach((contact) => {
        const merged = {
          ...(contact.attributes && typeof contact.attributes === "object" ? contact.attributes : {}),
          ...(contact.custom_fields && typeof contact.custom_fields === "object" ? contact.custom_fields : {}),
        };
        Object.keys(merged).forEach((attrKey) => {
          if (!attrKey) return;
          const norm = attrKey.toLowerCase().trim();
          const exists = updatedAvailable.some(
            (c) => c.header.toLowerCase().trim() === norm
          );
          if (!exists) {
            const id = `attr_${attrKey.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
            updatedAvailable.push({
              id,
              header: attrKey,
              getValue: (c) => {
                const cFields = {
                  ...(c.attributes && typeof c.attributes === "object" ? c.attributes : {}),
                  ...(c.custom_fields && typeof c.custom_fields === "object" ? c.custom_fields : {}),
                };
                return String(cFields[attrKey] ?? "");
              },
            });
          }
        });
      });
      setAvailableColumns(updatedAvailable);

      const activeColumns = updatedAvailable.filter((col) =>
        selectedFieldKeys.includes(col.id)
      );

      if (activeColumns.length === 0) {
        toast.error("Please select at least one field to export");
        setIsExporting(false);
        return;
      }

      setContactCount(contacts.length);
      setProgress(`Preparing ${contacts.length} contacts...`);

      const date = new Date().toISOString().split("T")[0];
      const headers = activeColumns.map((column) => column.header);
      const rows = contacts.map((contact) =>
        activeColumns.map((column) => {
          let value = column.getValue(contact);
          if (column.id === "status" || column.header === "Status") {
            const rawStat = String(value || "");
            const foundStage = pipelineStages.find(
              (s: any) => String(s.id) === rawStat || (s.name && s.name.toLowerCase() === rawStat.toLowerCase())
            );
            if (foundStage) {
              value = foundStage.name;
            }
          }
          // Handle phone numbers and names to prevent Excel from interpreting as formula
          if (column.header === "Phone Number" && typeof value === "string" && value) {
            return `="${value}"`;
          }
          return value;
        })
      );

      if (selectedFormat === "csv") {
        const csv = [
          headers.map(csvEscape).join(","),
          ...rows.map((row) => row.map(csvEscape).join(",")),
        ].join("\n");

        downloadBlob(
          new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }),
          `contacts-${date}.csv`
        );

        toast.success(`Exported ${contacts.length} contacts as CSV`);
      } else {
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        worksheet["!cols"] = headers.map((header, index) => ({
          wch: Math.min(
            60,
            Math.max(header.length, ...rows.map((row) => String(row[index] ?? "").length))
          ),
        }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

        downloadBlob(
          new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          `contacts-${date}.xlsx`
        );

        toast.success(`Exported ${contacts.length} contacts as Excel`);
      }

      setTimeout(() => {
        setContactCount(null);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export contacts");
    } finally {
      setIsExporting(false);
      setProgress("");
    }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Export your contacts in CSV or Excel format. Choose the fields you wish to include in the exported file:
        </p>

        {/* Export Fields Selector */}
        <div className="mb-6 p-3.5 bg-muted rounded-xl border border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Export Fields ({selectedFieldKeys.length} selected)
            </p>

            {/* Dropdown to add/select fields */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown((p) => !p)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-primary-text bg-surface-hover hover:bg-primary-light border border-primary rounded-lg transition"
              >
                <Plus size={13} />
                Select Fields
                <ChevronDown size={12} className={`transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </button>

              {showDropdown && (
                <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border border-border bg-card text-foreground shadow-xl p-2 max-h-60 overflow-y-auto">
                  <div className="text-[11px] font-semibold text-muted-foreground px-2.5 py-1 mb-1 border-b border-border">
                    Available Export Fields
                  </div>
                  {availableColumns.map((col) => {
                    const isSelected = selectedFieldKeys.includes(col.id);
                    const isDefault = DEFAULT_SELECTED_KEYS.includes(col.id);

                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => toggleFieldKey(col.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left hover:bg-muted transition"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition shrink-0 ${
                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                          }`}>
                            {isSelected && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-foreground font-medium">{col.header}</span>
                        </div>
                        {isDefault && (
                          <span className="text-[10px] text-warning bg-warning-bg/80 px-1.5 py-0.5 rounded font-medium">
                            Default
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Active Field Chips */}
          <div className="flex flex-wrap gap-2">
            {availableColumns.filter((col) => selectedFieldKeys.includes(col.id)).map((col) => {
              const isDefault = DEFAULT_SELECTED_KEYS.includes(col.id);
              return (
                <span
                  key={col.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    isDefault
                      ? "bg-surface-hover text-primary-text border-primary"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  {col.header}
                  <button
                    type="button"
                    onClick={() => toggleFieldKey(col.id)}
                    className="hover:text-destructive transition p-0.5"
                    title={`Remove ${col.header}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {/* CSV Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedFormat === "csv"
                ? "border-accent bg-accent/5"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <input
              type="radio"
              name="format"
              checked={selectedFormat === "csv"}
              onChange={() => setSelectedFormat("csv")}
              className="mt-0.5 w-4 h-4 accent-accent"
              disabled={isExporting}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={18} className="text-accent" />
                <p className="font-semibold text-sm text-foreground">CSV Format</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Comma-separated values, works with Excel, Google Sheets, and any spreadsheet app
              </p>
            </div>
          </label>

          {/* Excel Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedFormat === "excel"
                ? "border-accent bg-accent/5"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <input
              type="radio"
              name="format"
              checked={selectedFormat === "excel"}
              onChange={() => setSelectedFormat("excel")}
              className="mt-0.5 w-4 h-4 accent-accent"
              disabled={isExporting}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet size={18} className="text-accent" />
                <p className="font-semibold text-sm text-foreground">Excel Format</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Microsoft Excel .xlsx file with auto-sized columns and proper formatting
              </p>
            </div>
          </label>
        </div>

        {/* Progress Indicator */}
        {isExporting && (
          <div className="mt-6 p-3 bg-muted rounded-lg border border-border">
            <div className="flex items-center gap-3 text-sm">
              <Loader2 size={16} className="animate-spin text-accent" />
              <span className="text-muted-foreground">{progress}</span>
            </div>
            {contactCount && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden border border-border">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-300 animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-white border border-border rounded-lg hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="px-5 py-2 text-xs font-semibold bg-primary hover:opacity-90 text-primary-foreground rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={14} />
                Download {selectedFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};