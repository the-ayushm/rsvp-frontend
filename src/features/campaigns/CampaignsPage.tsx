/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useEffect, useState, useCallback, useMemo, MouseEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import CampaignsTopbar from "@/features/campaigns/components/CampaignsTopbar/CampaignsTopbar";
import { EditCampaignForm } from "@/features/campaigns/components/EditCampaignForm/EditCampaignForm";
import {
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Edit2,
  Trash2,
  BarChart3,
  ChevronDown,
  RefreshCcw,
  Plus,
  Download,
  Upload,
  Search,
  X,
  Check,
  Columns3,
  SlidersHorizontal,
  Calendar,
  MessageCircle,
  User,
  Tag,
  AtSign,
  Hash,
  Radio,
  Users,
  Clock,
  Play,
  PauseCircle
} from "lucide-react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";
import { MouseEvent as ReactMouseEvent } from "react";

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  description?: string | null;
};

type ColumnKey = string;
type SortField = "name" | "type" | "status" | "startDate" | "totalRecipients";
type SortOrder = "asc" | "desc";
type SortState = { field: SortField; order: SortOrder };

const FIELD_MAP: Record<SortField, string> = {
  name: "Campaign Name",
  type: "Type",
  status: "Status",
  startDate: "Start Date",
  totalRecipients: "Total Recipients",
};

interface CampaignFilters {
  status: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  createdAt: "all" | "newest" | "oldest";
}

// ─── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status?: string }) => {
  const safeStatus = status || "Draft";
  const getStatusClasses = (s: string) => {
    switch (s.toLowerCase()) {
      case "active":
        return "bg-primary-subtle text-accent-brand border-theme-accent-subtle";
      case "completed":
        return "bg-primary-subtle text-accent-brand border-theme-accent-subtle";
      case "scheduled":
        return "bg-muted text-foreground border-theme";
      case "paused":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground border-theme";
    }
  };
  return (
    <span className={`badge-pill border text-[11px] font-medium ${getStatusClasses(safeStatus)}`}>
      {safeStatus}
    </span>
  );
};

// ─── Type Badge ──────────────────────────────────────────────────────────────
const TypeBadge = ({ type }: { type?: string }) => {
  const safeType = type || "Standard";
  const getTypeClasses = (t: string) => {
    switch (t.toLowerCase()) {
      case "broadcast":
        return "bg-primary-subtle text-accent-brand border-theme-accent-subtle";
      case "sequence":
        return "bg-muted text-foreground border-theme";
      default:
        return "bg-muted text-muted-foreground border-theme";
    }
  };
  return (
    <span className={`badge-pill border text-[11px] font-medium capitalize ${getTypeClasses(safeType)}`}>
      {safeType}
    </span>
  );
};

// ─── Format Date ─────────────────────────────────────────────────────────────
const formatDate = (iso: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 24 && hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    if (hours < 1 && diff > 0) return `${Math.floor(diff / 60000)} min ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "-";
  }
};

// ─── Modal Wrapper ───────────────────────────────────────────────────────────
const ModalWrapper = ({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150" style={{ backgroundColor: "var(--background)", opacity: 1 }}>
      <div className="px-5 py-4 flex justify-between items-center border-b border-border bg-muted/40">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Filters Modal ───────────────────────────────────────────────────────────
const FiltersModal = ({
  filters,
  onFilterChange,
  onApply,
  onClose,
  onClear,
}: {
  filters: CampaignFilters;
  onFilterChange: (key: string, value: unknown) => void;
  onApply: () => void;
  onClose: () => void;
  onClear: () => void;
}) => {
  const statusOptions = ["all", "active", "scheduled", "paused", "completed"];
  const typeOptions = ["all", "broadcast", "sequence"];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl w-full max-w-md shadow-2xl border border-theme overflow-hidden animate-in fade-in zoom-in-95 duration-150" 
        style={{ backgroundColor: "var(--background)", opacity: 1 }}
      >
        <div 
          className="px-5 py-4 border-b border-theme flex justify-between items-center"
          style={{ backgroundColor: "#eaf1ee" }}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-accent" />
            <h2 className="text-base font-semibold text-theme-main">Filter Campaigns</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-theme-muted hover:text-theme-main rounded-lg hover:bg-black/5 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4" style={{ backgroundColor: "var(--background)" }}>
          <div>
            <label className="block text-xs font-bold text-theme-main mb-1.5 uppercase tracking-wider">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
              className="form-input-base text-theme-main font-medium"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-main mb-1.5 uppercase tracking-wider">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => onFilterChange("type", e.target.value)}
              className="form-input-base text-theme-main font-medium"
            >
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-main mb-1.5 uppercase tracking-wider">
              Created At
            </label>
            <select
              value={filters.createdAt}
              onChange={(e) => onFilterChange("createdAt", e.target.value)}
              className="form-input-base text-theme-main font-medium"
            >
              <option value="all">All</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-main mb-1.5 uppercase tracking-wider">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                placeholder="From"
                value={filters.dateFrom}
                onChange={(e) => onFilterChange("dateFrom", e.target.value)}
                className="form-input-base text-theme-main font-medium"
              />
              <input
                type="date"
                placeholder="To"
                value={filters.dateTo}
                onChange={(e) => onFilterChange("dateTo", e.target.value)}
                className="form-input-base text-theme-main font-medium"
              />
            </div>
          </div>
        </div>

        <div 
          className="px-5 py-3.5 border-t border-theme flex justify-between items-center"
          style={{ backgroundColor: "#eaf1ee" }}
        >
          <button
            onClick={onClear}
            className="btn btn-secondary btn-sm"
          >
            Clear All
          </button>
          <button
            onClick={onApply}
            className="btn btn-primary btn-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Columns Dropdown ────────────────────────────────────────────────────────
const ColumnsDropdown = ({
  visibleColumns,
  setVisibleColumns,
  showDropdown,
  setShowDropdown,
}: {
  visibleColumns: string[];
  setVisibleColumns: (cols: string[]) => void;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
}) => {
  const columnsRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [columnSearch, setColumnSearch] = useState("");

  const columnOptions = [
  { field: "name", label: "Campaign Name" },
  { field: "type", label: "Type" },
  { field: "status", label: "Status" },
  { field: "startDate", label: "Start Date" },
  { field: "totalRecipients", label: "Total Recipients" },
];

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        showDropdown &&
        columnsRef.current &&
        !columnsRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown, setShowDropdown]);

  const toggleColumn = (field: string) => {
    setVisibleColumns(
      visibleColumns.includes(field)
        ? visibleColumns.filter((f) => f !== field)
        : [...visibleColumns, field]
    );
  };

  const resetColumns = () => {
  setVisibleColumns(["name", "type", "status", "startDate", "totalRecipients"]);
  setColumnSearch("");
};

  const filteredOptions = columnOptions.filter((opt) =>
    opt.label.toLowerCase().includes(columnSearch.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn btn-secondary btn-sm"
      >
        <Columns3 size={13} />
        <span>Columns</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
        />
      </button>

      {showDropdown && (
        <div
          ref={columnsRef}
          className="absolute z-50 mt-1 right-0 w-56 bg-card border border-theme rounded-xl shadow-2xl p-2.5 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        >
          <input
            type="text"
            placeholder="Search columns..."
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            className="form-input-base text-xs py-1.5 px-2.5 mb-2"
          />
          <button
            onClick={resetColumns}
            className="w-full mb-2 btn btn-secondary btn-sm text-[11px] py-1"
          >
            Reset All
          </button>
          <div className="space-y-1">
            {filteredOptions.map(({ field, label }) => (
              <label
                key={field}
                className="flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer hover:bg-muted/60 rounded-lg transition"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(field)}
                  onChange={() => toggleColumn(field)}
                  className="w-4 h-4 rounded border-theme accent-terracotta cursor-pointer"
                  style={{ accentColor: "var(--terracotta)" }}
                />
                <span className="text-xs text-foreground font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sort Icon Helper ─────────────────────────────────────────────────────────
const SortIcon = ({ field, sorts }: { field: string; sorts: SortState[] }) => {
  const active = sorts.find((s) => s.field === field);
  return (
    <span className="inline-flex flex-col items-center justify-center ml-1 gap-px">
      <ArrowUp
        size={9}
        className={
          active?.order === "asc"
            ? "text-accent-brand font-bold"
            : "text-muted-foreground/40"
        }
      />
      <ArrowDown
        size={9}
        className={
          active?.order === "desc"
            ? "text-accent-brand font-bold"
            : "text-muted-foreground/40"
        }
      />
    </span>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPrev,
  onNext,
  onRowsPerPageChange,
  selectedCount,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPrev: () => void;
  onNext: () => void;
  onRowsPerPageChange: (newSize: number) => void;
  selectedCount: number;
}) => {
  const [isCustomRows, setIsCustomRows] = useState(false);
  const [customInput, setCustomInput] = useState(itemsPerPage.toString());

  useEffect(() => {
    setCustomInput(itemsPerPage.toString());
  }, [itemsPerPage]);

  const handleApplyCustom = () => {
    let num = parseInt(customInput, 10);
    if (isNaN(num) || num < 10) num = 10;
    if (num > 100) num = 100;
    setCustomInput(num.toString());
    setIsCustomRows(false);
    onRowsPerPageChange(num);
  };

  const rowsOptions = [10, 20, 30, 50, 100];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-theme bg-card text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <span className="badge-pill badge-accent font-medium">
            {selectedCount} selected
          </span>
        )}
        <span>
          Showing <strong className="text-foreground">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</strong> to{" "}
          <strong className="text-foreground">{Math.min(totalItems, currentPage * itemsPerPage)}</strong> of{" "}
          <strong className="text-foreground">{totalItems}</strong> campaigns
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          {isCustomRows ? (
            <div className="flex items-center gap-1 bg-card border border-theme rounded-md px-1.5 py-0.5 shadow-xs">
              <input
                type="number"
                min={10}
                max={100}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onBlur={handleApplyCustom}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyCustom();
                  if (e.key === "Escape") setIsCustomRows(false);
                }}
                autoFocus
                placeholder="10-100"
                className="w-12 bg-transparent text-foreground font-semibold text-xs text-center outline-none"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                className="text-[10px] font-bold text-accent hover:opacity-80 transition"
              >
                OK
              </button>
            </div>
          ) : (
            <select
              value={rowsOptions.includes(itemsPerPage) ? itemsPerPage : "custom_val"}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setIsCustomRows(true);
                } else if (e.target.value !== "custom_val") {
                  onRowsPerPageChange(Number(e.target.value));
                }
              }}
              className="w-[58px] bg-card border border-theme rounded-md px-1 py-0.5 text-xs text-foreground focus:outline-none focus:border-theme-accent cursor-pointer"
            >
              {rowsOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {!rowsOptions.includes(itemsPerPage) && (
                <option value="custom_val">{itemsPerPage}</option>
              )}
              <option value="custom">Custom...</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={currentPage <= 1}
            className="btn btn-secondary btn-sm py-1 px-2.5"
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-medium text-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={currentPage >= totalPages}
            className="btn btn-secondary btn-sm py-1 px-2.5"
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [viewMode, setViewMode] = useState<"view" | "edit" | null>(null);
  const [page, setPage] = useState(1);

  // Single-active-sort; default: newest first (startDate desc)
  const [sorts, setSorts] = useState<SortState[]>([{ field: "startDate", order: "desc" }]);

 const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>([
  "name", "type", "status", "startDate", "totalRecipients",
]);
  const [pageSize, setPageSize] = useState(20);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [filters, setFilters] = useState<CampaignFilters>({
    status: "all",
    type: "all",
    dateFrom: "",
    dateTo: "",
    createdAt: "all",
  });

  const queryClient = useQueryClient();

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data, isLoading: loading, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["campaigns", { search, page, pageSize, filters }],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy: "created_at",
        sortOrder: "desc",
      });

      if (search) queryParams.append("search", search);
      if (filters.status !== "all") queryParams.append("status", filters.status);
      if (filters.type !== "all") queryParams.append("type", filters.type);
      if (filters.dateFrom) queryParams.append("date_from", filters.dateFrom);
      if (filters.dateTo) queryParams.append("date_to", filters.dateTo);

      const res = await soft7AxiosInstance.get(`/admin/campaigns?${queryParams.toString()}`);
      return res.data;
    },
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    placeholderData: (previousData) => previousData,
  });

  const campaigns: Campaign[] = Array.isArray(data?.data?.campaigns)
    ? data.data.campaigns
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
    ? data
    : [];

  const pagination = data?.data?.pagination ?? data?.pagination ?? {};
  const total = Number(pagination.total ?? campaigns.length);
  const totalPages = Number(
    pagination.total_pages ?? pagination.totalPages ?? Math.ceil(total / pageSize)
  ) || 1;
  const paginatedCampaigns = campaigns;

  const activeFiltersCount = [
    filters.status !== "all",
    filters.type !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) =>
      await soft7AxiosInstance.delete(`/admin/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted successfully!");
    },
    onError: (error) => {
      console.error("Delete failed:", error);
      toast.error("Could not delete campaign.");
    },
  });

  async function deleteCampaign(id: string) {
    toast(
      (t) => (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Delete this campaign permanently?</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                deleteCampaignMutation.mutate(id);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 5000 }
    );
  }

  const updateContactMutation = useMutation({
    mutationFn: async (updated: Partial<Campaign>) => {
      const { data } = await soft7AxiosInstance.patch(`/user/campaigns/api/${selected?.id}`, updated);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setViewMode(null);
      setSelected(null);
      toast.success("Campaign updated successfully!");
    },
    onError: (error) => {
      console.error("Update failed:", error);
      toast.error("Failed to update campaign.");
    },
  });

  async function updateCampaign(updated: Partial<Campaign>) {
    if (!selected) return;
    updateContactMutation.mutate(updated);
  }

  // ── Start Campaign ─────────────────────────────────────────────────────────
  const startCampaignMutation = useMutation({
    mutationFn: async (id: string) =>
      await soft7AxiosInstance.post(`/admin/campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign started successfully!");
    },
    onError: (error) => {
      console.error("Start failed:", error);
      toast.error("Could not start campaign.");
    },
  });

  // ── Pause Campaign ─────────────────────────────────────────────────────────
  const pauseCampaignMutation = useMutation({
    mutationFn: async (id: string) =>
      await soft7AxiosInstance.post(`/admin/campaigns/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign paused successfully!");
    },
    onError: (error) => {
      console.error("Pause failed:", error);
      toast.error("Could not pause campaign.");
    },
  });


  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    await refetch();
    setRefreshMessage("Refreshed successfully!");
    setTimeout(() => setRefreshMessage(""), 3000);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  const handleFilterChange = (key: string, value: unknown) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleApplyFilters = () => {
    setShowFilters(false);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ status: "all", type: "all", dateFrom: "", dateTo: "", createdAt: "all" });
    setShowFilters(false);
    setPage(1);
  };

  const handleRowsPerPageChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  /**
   * Toggle sort for a column.
   * Cycle: no sort → asc → desc → asc …
   * Only one column is active at a time.
   */
  const handleSort = (field: SortField) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.field === field);
      if (!existing) return [{ field, order: "asc" }];
      if (existing.order === "asc") return [{ field, order: "desc" }];
      // desc → back to asc (no "unsorted" state to keep UX simple)
      return [{ field, order: "asc" }];
    });
    setPage(1);
  };

  // ── Column Value Renderer ──────────────────────────────────────────────────
  const getColumnValue = (campaign: Campaign, col: string) => {
    switch (col) {
      case "name":
        return (
          <button
            onClick={() => {
              setSelected(campaign);
              setViewMode("view");
            }}
            className="text-theme-main hover:text-accent-brand font-medium text-xs text-left cursor-pointer bg-transparent border-0 p-0 outline-none hover:underline truncate max-w-[240px] block transition-colors"
          >
            {campaign.name}
          </button>
        );
      case "type":
        return <TypeBadge type={campaign.type} />;
      case "status":
        return <StatusBadge status={campaign.status} />;
      case "startDate":
        return (
          <span className="text-muted-foreground whitespace-nowrap text-xs">
            {formatDate(campaign.scheduled_at)}
          </span>
        );
      case "totalRecipients":
        return (
          <span className="font-semibold text-accent-brand text-xs">
            {(campaign.total_recipients ?? 0).toLocaleString()}
          </span>
        );
      default:
        return "-";
    }
  };

  // ── Column Icon Map ────────────────────────────────────────────────────────
  const colIcon: Record<string, React.ReactNode> = {
    name: <User size={13} className="text-muted-foreground" />,
    type: <Hash size={13} className="text-muted-foreground" />,
    status: <Tag size={13} className="text-muted-foreground" />,
    startDate: <Calendar size={13} className="text-muted-foreground" />,
    totalRecipients: <Users size={13} className="text-muted-foreground" />,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-theme-canvas text-theme-main">
      {/* ── TOP ACTION BAR ─────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme bg-theme-card">
          <div className="flex items-center gap-1" />

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg border border-theme bg-theme-card hover:bg-theme-muted text-theme-muted hover:text-theme-main"
              title="Refresh"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => (window.location.href = "/user/campaigns/create")}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={13} /> Create Campaign
            </button>
          </div>
        </div>
      </div>

      {/* ── SEARCH + FILTERS + COLUMNS ─────────────────────────────────────── */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-theme bg-theme-card gap-3">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-theme rounded-lg overflow-hidden bg-theme-card h-8">
              <input
                type="text"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-sm text-theme-main placeholder-muted-foreground px-3 py-1.5 outline-none w-52"
              />
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 px-3 h-full text-xs font-medium text-theme-muted hover:text-theme-main hover:bg-theme-muted border-l border-theme"
              >
                <Search size={12} /> Submit
              </button>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-theme-muted hover:text-theme-main border border-theme hover:border-theme bg-theme-card hover:bg-theme-muted rounded-lg h-8"
            >
              <Filter size={13} />
              Filters
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 bg-primary text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <ColumnsDropdown
              visibleColumns={visibleColumns}
              setVisibleColumns={setVisibleColumns}
              showDropdown={showColumnDropdown}
              setShowDropdown={setShowColumnDropdown}
            />
          </div>
        </div>
      </div>

      {/* ── TABLE (scrollable) ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto bg-theme-canvas">
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="sticky top-0 bg-theme-card border-b border-theme z-10">
              <tr>
                {/* Checkbox col */}
                <th className="w-6 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedCampaigns.length > 0 &&
                      paginatedCampaigns.every((c) => selectedCampaignIds.includes(c.id))
                    }
                    onChange={(e) =>
                      setSelectedCampaignIds(
                        e.target.checked
                          ? [...new Set([...selectedCampaignIds, ...paginatedCampaigns.map((c) => c.id)])]
                          : selectedCampaignIds.filter((id) => !paginatedCampaigns.some((c) => c.id === id)),
                      )
                    }
                    className="w-3.5 h-3.5 rounded border-theme accent-terracotta cursor-pointer"
                    style={{ accentColor: "var(--terracotta)" }}
                  />
                </th>

                {/* Sortable column headers */}
                {visibleColumns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col as SortField)}
                    className="px-3 py-2.5 font-medium text-theme-muted hover:text-theme-main text-left whitespace-nowrap cursor-pointer select-none hover:bg-theme-muted/40"
                  >
                    <div className="flex items-center gap-1">
                      {colIcon[col]}
                      <span>{FIELD_MAP[col as SortField] || col}</span>
                      <SortIcon field={col} sorts={sorts} />
                    </div>
                  </th>
                ))}

                <th className="px-3.5 py-2.5 font-medium text-theme-muted text-center whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 3}
                    className="py-20 text-center text-theme-muted"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span>Loading campaigns...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCampaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 3}
                    className="py-20 text-center text-theme-muted"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Users
                        size={24}
                        className="text-theme-muted/40"
                      />
                      <p className="text-sm font-medium text-theme-main">
                        No campaigns found
                      </p>
                      <p className="text-[11px] text-theme-muted">
                        Create a campaign to get started
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-theme-muted/30 group ${
                      selectedCampaignIds.includes(c.id)
                        ? "bg-primary-subtle"
                        : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="w-6 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.includes(c.id)}
                        onChange={(e) =>
                          setSelectedCampaignIds(
                            e.target.checked
                              ? [...selectedCampaignIds, c.id]
                              : selectedCampaignIds.filter((id) => id !== c.id),
                          )
                        }
                        className="w-3.5 h-3.5 rounded border-theme accent-terracotta cursor-pointer"
                        style={{ accentColor: "var(--terracotta)" }}
                      />
                    </td>

                    {visibleColumns.map((col) => (
                      <td key={col} className="px-3 py-2.5">
                        {getColumnValue(c, col)}
                      </td>
                    ))}

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          title="View Stats"
                          onClick={() =>
                            router.push(`/user/campaigns/${c.id}/stats`)
                          }
                          className="p-1.5 rounded-lg text-theme-muted hover:text-accent-brand hover:bg-primary-subtle"
                        >
                          <BarChart3 size={14} />
                        </button>

                        {/* Start / Pause toggle */}
                        {c.status?.toLowerCase() === "active" ? (
                          <button
                            title="Pause Campaign"
                            disabled={pauseCampaignMutation.isPending}
                            onClick={() => pauseCampaignMutation.mutate(c.id)}
                            className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <PauseCircle size={14} />
                          </button>
                        ) : (
                          <button
                            title="Start Campaign"
                            disabled={startCampaignMutation.isPending}
                            onClick={() => startCampaignMutation.mutate(c.id)}
                            className="p-1.5 rounded-lg text-theme-muted hover:text-green-600 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Play size={14} />
                          </button>
                        )}

                        <button
                          title="Edit Campaign"
                          onClick={() => {
                            setSelected(c);
                            setViewMode("edit");
                          }}
                          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-main hover:bg-theme-muted"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          title="Delete Campaign"
                          onClick={() => deleteCampaign(c.id)}
                          className="p-1.5 rounded-lg text-theme-muted hover:text-destructive hover:bg-destructive/10"
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

        {/* ── MOBILE CARDS ──────────────────────────────────────────────────── */}
        <div className="md:hidden space-y-2 p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : paginatedCampaigns.length === 0 ? (
            <div className="text-center py-10 text-theme-muted text-sm">
              No campaigns found
            </div>
          ) : (
            paginatedCampaigns.map((c) => (
              <div
                key={c.id}
                className="bg-theme-card border border-theme rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <button
                      onClick={() => {
                        setSelected(c);
                        setViewMode("view");
                      }}
                      className="text-sm font-semibold text-theme-main hover:text-accent text-left"
                    >
                      {c.name}
                    </button>
                    <div className="flex gap-2 mt-1">
                      <TypeBadge type={c.type} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </div>
                <div className="text-xs text-theme-muted">
                  <div>Start: {formatDate(c.scheduled_at)}</div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-accent-brand font-semibold">
                      Total Recipients: {c.total_recipients}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-theme">
                  <button
                    onClick={() =>
                      router.push(`/user/campaigns/${c.id}/stats`)
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-theme-muted border border-theme text-theme-main rounded-lg text-xs font-medium hover:bg-theme-muted/80"
                  >
                    <BarChart3 size={12} /> Stats
                  </button>
                  <button
                    onClick={() => {
                      setSelected(c);
                      setViewMode("edit");
                    }}
                    className="flex items-center justify-center px-3 py-1.5 bg-theme-muted border border-theme text-theme-muted hover:text-theme-main rounded-lg"
                  >
                    <Edit2 size={12} />
                  </button>

                  {/* Start / Pause toggle */}
                  {c.status?.toLowerCase() === "active" ? (
                    <button
                      title="Pause Campaign"
                      disabled={pauseCampaignMutation.isPending}
                      onClick={() => pauseCampaignMutation.mutate(c.id)}
                      className="flex items-center justify-center px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 hover:text-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PauseCircle size={12} />
                    </button>
                  ) : (
                    <button
                      title="Start Campaign"
                      disabled={startCampaignMutation.isPending}
                      onClick={() => startCampaignMutation.mutate(c.id)}
                      className="flex items-center justify-center px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-600 hover:text-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={12} />
                    </button>
                  )}

                  <button
                    onClick={() => deleteCampaign(c.id)}
                    className="flex items-center justify-center px-3 py-1.5 bg-theme-muted border border-theme text-theme-muted hover:text-destructive rounded-lg"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── PAGINATION (fixed bottom) ──────────────────────────────────────── */}
      <div className="shrink-0">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={pageSize}
          onPrev={() => handlePageChange(page - 1)}
          onNext={() => handlePageChange(page + 1)}
          onRowsPerPageChange={handleRowsPerPageChange}
          selectedCount={selectedCampaignIds.length}
        />
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {showFilters && (
        <FiltersModal
          filters={filters}
          onFilterChange={handleFilterChange}
          onApply={handleApplyFilters}
          onClose={() => setShowFilters(false)}
          onClear={handleClearFilters}
        />
      )}

      {selected && viewMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl w-full max-w-lg shadow-2xl border border-black/15 overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans bg-white"
          >
            <div 
              className="px-5 py-3.5 border-b border-black/10 flex justify-between items-center"
              style={{ backgroundColor: "#eaf1ee" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--terracotta)" }}>
                  {viewMode === "view" ? (
                    <Radio className="w-3.5 h-3.5 text-white" strokeWidth={2.2} style={{ color: "#FFFFFF", stroke: "#FFFFFF" }} />
                  ) : (
                    <Edit2 className="w-3.5 h-3.5 text-white" strokeWidth={2.2} style={{ color: "#FFFFFF", stroke: "#FFFFFF" }} />
                  )}
                </div>
                <h2 className="text-sm font-bold text-[#18181B]">
                  {viewMode === "view" ? "Campaign Details" : "Edit Campaign"}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setViewMode(null);
                }}
                className="p-1.5 text-[#6B7280] hover:text-[#18181B] rounded-lg hover:bg-black/5 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 bg-white">
              {viewMode === "view" ? (
                <div className="space-y-3 font-sans">
                  {[
                    { label: "Name", value: selected.name },
                    {
                      label: "Type",
                      value: <TypeBadge type={selected.type} />,
                    },
                    {
                      label: "Status",
                      value: <StatusBadge status={selected.status} />,
                    },
                    {
                      label: "Start Date",
                      value: formatDate(selected.scheduled_at),
                    },
                    {
                      label: "Total Recipients",
                      value: (
                        <span className="text-sm font-bold text-accent-brand">
                          {(selected.total_recipients ?? 0).toLocaleString()}
                        </span>
                      ),
                    },
                    ...(selected.description
                      ? [{ label: "Description", value: selected.description }]
                      : []),
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-center border-b border-black/5 pb-2.5"
                    >
                      <span className="text-xs font-bold text-[#6B7280]">
                        {label}:
                      </span>
                      <span className="text-xs font-bold text-[#18181B]">
                        {value}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setViewMode(null);
                      }}
                      className="btn btn-secondary text-xs px-4 py-2 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <EditCampaignForm
                  campaign={selected}
                  onSave={updateCampaign}
                  onCancel={() => {
                    setSelected(null);
                    setViewMode(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REFRESH TOAST ─────────────────────────────────────────────────── */}
      {refreshMessage && (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-theme-main bg-theme-card border border-theme shadow-2xl z-50">
          <RefreshCcw size={12} className="text-accent animate-spin" />
          {refreshMessage}
        </div>
      )}
    </div>
  );
}
