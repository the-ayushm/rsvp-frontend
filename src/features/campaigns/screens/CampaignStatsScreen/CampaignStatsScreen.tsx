/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Info,
  DollarSign,
  FileText,
  PlayCircle,
  CheckCircle,
  Send,
  CheckCheck,
  XCircle,
  BookOpen,
  Users,
  BarChart2,
  MessageSquare,
  Download,
  Layers,
  Loader2,
  Play,
  PauseCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import * as XLSX from "xlsx";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

type CampaignMessage = {
  leadName: string | null;
  phoneNumber: string;
  messageStatus: MessageStatus;
  fromPhone: string;
  toPhone: string;
  templateName: string;
  templateVariables: Record<string, string>;
  messageCost: string;
  messageError: string | null;
  campaignError: string | null;
  messageErrorCode: string | null;
  readAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  sentAt: string | null;
};

type CampaignDetails = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string;
  templateName?: string;
  template_name?: string;
  templateCategory?: string;
  totalCost?: string | number;
  total_recipients?: number;
  sent_count?: number;
  delivered_count?: number;
  read_count?: number;
  failed_count?: number;
  stats?: {
    sent_count?: string | number;
    pending_count?: string | number;
    delivered_count?: string | number;
    read_count?: string | number;
    failed_count?: string | number;
    total_cost?: string | number;
  };
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  scheduleDate?: string | null;
  startedAt?: string | null;
  started_at?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  completed_at?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  createdDate?: string | null;
  updatedAt?: string;
  updated_at?: string;
  template_params?: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; url?: string }>;
    example?: Record<string, unknown>;
  }>;
  media_uploads?: Array<{ link: string; type: string }>;
  phone_number?: string;
  parameter_mapping?: Record<string, string | { field: string; fallbackValue?: string }>;
};

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/* ─── Donut Chart (pure SVG) ─────────────────────────────────────────────── */
function DonutChart({
  sent, delivered, failed, read, total,
}: {
  sent: number; delivered: number; failed: number; read: number; total: number;
}) {
  const size = 180, cx = 90, cy = 90, r = 70, strokeW = 26;
  const circ = 2 * Math.PI * r;
  const segments = [
    { value: sent,      color: "var(--color-info)", label: "Sent" },
    { value: delivered, color: "var(--color-primary)", label: "Delivered" },
    { value: read,      color: "var(--color-primary-text)", label: "Read" },
    { value: failed,    color: "var(--color-error)", label: "Failed" },
  ];
  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const gap  = circ - dash;
    const arc  = { ...seg, dash, gap, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4 w-full font-sans">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-surface-active)" strokeWidth={strokeW} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {arcs.map((arc, i) =>
            arc.value > 0 ? (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={arc.color} strokeWidth={strokeW}
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeDashoffset={-arc.offset} strokeLinecap="butt" />
            ) : null
          )}
        </g>
        <text x={cx} y={cy - 8}  textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--color-text)">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-text-muted)">Total</text>
      </svg>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full max-w-xs pt-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-xs text-muted-foreground font-medium">
              {seg.label}: <span className="font-bold text-foreground">{seg.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon, barColor, pct }: {
  label: string; value: number; icon: React.ReactNode;
  barColor: string; pct: number;
}) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-black/15 shadow-sm flex flex-col gap-2 font-sans transition-all hover:border-black/25">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-surface-active flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
      <div className="w-full bg-surface-active rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${barColor} transition-all duration-700`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[11px] font-medium text-muted-foreground">{pct.toFixed(1)}% of total</div>
    </div>
  );
}

/* ─── Info Row ───────────────────────────────────────────────────────────── */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1 font-sans">
      <span className="text-xs font-semibold text-muted-foreground shrink-0 w-24 pt-0.5">{label}</span>
      <span className="text-xs font-bold text-foreground text-right flex-1 break-words">{value ?? "—"}</span>
    </div>
  );
}

function MessageStatusBadge({ status }: { status: MessageStatus }) {
  const styles: Record<MessageStatus, string> = {
    sent: "bg-info-bg text-[var(--color-primary-dark)] border border-info-border",
    delivered: "bg-primary-lighter text-primary-text border border-primary-soft",
    read: "bg-primary-lighter text-primary-text border border-primary-soft",
    failed: "bg-error-bg text-error border border-error-border",
    pending: "bg-warning-bg text-warning border border-warning-border",
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

/* ─── Message Panel (per-status) ─────────────────────────────────────────── */
function MessagePanel({
  title, status, icon, actionButton,
  messages, loading, pagination, currentPage, pageSize, onPageChange,
}: {
  title: string; status: MessageStatus; icon: React.ReactNode; actionButton?: React.ReactNode;
  messages: CampaignMessage[]; loading: boolean; pagination: PaginationInfo;
  currentPage: number; pageSize: number; onPageChange: (p: number) => void;
}) {
  const fmt = (v: string | null) => {
    if (!v) return "—";
    try { return new Date(v).toLocaleString(); } catch { return "—"; }
  };

  return (
    <div className="bg-surface rounded-2xl border border-black/15 shadow-sm overflow-hidden font-sans">
      {/* Panel header */}
      <div className="px-5 py-3.5 border-b border-black/10 flex items-center justify-between" style={{ backgroundColor: "var(--color-surface-active)" }}>
        <div className="flex items-center gap-2.5 font-bold text-sm text-foreground">
          <div className="w-6 h-6 rounded-lg bg-surface-muted text-foreground flex items-center justify-center shrink-0">
            {icon}
          </div>
          <span>{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-foreground font-bold">
            {loading ? "…" : pagination.total}
          </span>
        </div>
        {actionButton && <div className="ml-4">{actionButton}</div>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-black/10 bg-surface-muted">
              <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider">Phone Number</th>
              <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider">Sent At</th>
              {status !== "failed" && (
                <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider">Delivered At</th>
              )}
              <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider">Template</th>
              {status === "failed" && (
                <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider">Failure Reason</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-surface">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" /> Loading messages…
                </td>
              </tr>
            ) : messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground italic">
                  No {status} messages found
                </td>
              </tr>
            ) : (
              messages.map((msg, i) => (
                <tr key={i} className="hover:bg-surface-active/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">{msg.phoneNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <MessageStatusBadge status={msg.messageStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{fmt(msg.sentAt)}</td>
                  {status !== "failed" && (
                    <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">{fmt(msg.deliveredAt)}</td>
                  )}
                  <td className="px-4 py-3 text-foreground font-semibold whitespace-nowrap">{msg.templateName || "—"}</td>
                  {status === "failed" && (
                    <td className="px-4 py-3 text-error font-medium max-w-xs">
                      {(msg.messageError || msg.messageErrorCode) ? (
                        <>
                          <div className="break-words font-semibold">{msg.messageError || "Unknown error"}</div>
                          {msg.messageErrorCode && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">Code: {msg.messageErrorCode}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-black/10 bg-surface-muted flex items-center justify-between gap-2 text-xs text-muted-foreground font-medium">
          <span>{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, pagination.total)} of {pagination.total}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={!pagination.hasPreviousPage}
              className="p-1.5 rounded-lg border border-black/15 bg-surface hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-bold text-foreground">{currentPage} / {pagination.totalPages}</span>
            <button onClick={() => onPageChange(currentPage + 1)} disabled={!pagination.hasNextPage}
              className="p-1.5 rounded-lg border border-black/15 bg-surface hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function CampaignStatsPage() {
  const params   = useParams();
  const router   = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "messages">("overview");
  const [activeMessageFilter, setActiveMessageFilter] = useState<MessageStatus>("sent");
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [isRebroadcasting, setIsRebroadcasting] = useState(false);
  const [isCampaignActionPending, setIsCampaignActionPending] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState({
    totalContacts: 0,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    readCount: 0,
  });

  const PAGE_SIZE = 25;
  const statuses: MessageStatus[] = ["sent", "delivered", "failed", "read"];

  const [statusData, setStatusData] = useState<Record<MessageStatus, {
    messages: CampaignMessage[];
    loading: boolean;
    page: number;
    pagination: PaginationInfo;
  }>>({
    sent:      { messages: [], loading: false, page: 1, pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } },
    delivered: { messages: [], loading: false, page: 1, pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } },
    failed:    { messages: [], loading: false, page: 1, pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } },
    read:      { messages: [], loading: false, page: 1, pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } },
    pending:   { messages: [], loading: false, page: 1, pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false } },
  });

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getFmt = (c: CampaignDetails | null, field: "scheduled" | "started" | "completed" | "created") => {
    if (!c) return "—";
    const val =
      field === "scheduled" ? (c.scheduledAt || c.scheduled_at || c.scheduleDate) :
      field === "started"   ? (c.startedAt   || c.started_at   || c.startDate)    :
      field === "completed" ? (c.completedAt || c.completed_at || c.endDate)      :
      (c.createdAt || c.created_at || c.createdDate);
    if (!val) return "—";
    try { return new Date(val).toLocaleString(); } catch { return "—"; }
  };

  const pct = (n: number) => {
    const tot = stats.totalContacts || (stats.sentCount + stats.deliveredCount + stats.failedCount + stats.readCount);
    return tot > 0 ? (n / tot) * 100 : 0;
  };

  /* ── Export to Excel (by status filter) ── */
  const exportToExcelByStatus = async (filter: "all" | MessageStatus) => {
    setExportDropdownOpen(false);
    setIsExporting(true);
    const label = filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1);
    const toastId = toast.loading(`Preparing ${label} export…`);
    try {
      const statusesToFetch: MessageStatus[] =
        filter === "all" ? ["sent", "delivered", "read", "failed", "pending"] : [filter];

      const allRows: Record<string, string>[] = [];
      const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleString() : "—");

      for (const status of statusesToFetch) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const res = await soft7AxiosInstance.get(`/admin/campaigns/${campaignId}/messages`, {
            params: { status, page, pagesize: 500 },
          });
          const result = res.data;
          const data = result?.data?.data ?? result?.data ?? [];
          const pag  = result?.data?.pagination ?? result?.pagination ?? {};
          const msgs: any[] = Array.isArray(data) ? data : [];

          for (const msg of msgs) {
            allRows.push({
              "Phone Number":   msg.phoneNumber ?? "",
              "Lead Name":      msg.leadName ?? "—",
              "Status":         (msg.status ?? msg.messageStatus ?? "—").toUpperCase(),
              "Template":       msg.templateName ?? "—",
              "Sent At":        fmtDate(msg.sentAt ?? null),
              "Delivered At":   fmtDate(msg.deliveredAt ?? null),
              "Read At":        fmtDate(msg.readAt ?? null),
              "Failed At":      fmtDate(msg.failedAt ?? null),
              "Failure Reason": msg.errorMessage ?? msg.messageError ?? "—",
              "Error Code":     msg.messageErrorCode != null ? String(msg.messageErrorCode) : "—",
              "Message Cost":   msg.messageCost != null ? String(msg.messageCost) : "0",
              "From Phone":     msg.fromPhone ?? "—",
            });
          }
          hasMore = Boolean(pag?.hasNextPage) && msgs.length > 0;
          page++;
        }
      }

      if (allRows.length === 0) {
        toast.dismiss(toastId);
        toast.error(`No ${label} messages found to export.`);
        setIsExporting(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(allRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${label} Messages`);
      
      const safeName = campaign?.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? campaignId;
      XLSX.writeFile(workbook, `campaign_${safeName}_${filter}_${new Date().toISOString().slice(0, 10)}.xlsx`);

      toast.dismiss(toastId);
      toast.success(`Exported ${allRows.length} ${label} records!`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err?.response?.data?.message ?? "Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRebroadcast = async () => {
    setIsRebroadcasting(true);
    try {
      const res = await soft7AxiosInstance.post(`/admin/campaigns/${campaignId}/rebroadcast`);
      if (res.data?.success || res.status === 200 || res.status === 201) {
        toast.success(res.data?.message || "Rebroadcast initiated successfully");
        loadAll();
        if (messagesLoaded) statuses.forEach((s) => fetchMessages(s, 1));
      } else {
        toast.error(res.data?.message || "Failed to rebroadcast");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Error rebroadcasting");
    } finally {
      setIsRebroadcasting(false);
    }
  };

  /* ── Start campaign ── */
  const handleStartCampaign = async () => {
    setIsCampaignActionPending(true);
    try {
      const res = await soft7AxiosInstance.post(`/admin/campaigns/${campaignId}/start`);
      toast.success(res.data?.message || "Campaign started successfully!");
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not start campaign.");
    } finally {
      setIsCampaignActionPending(false);
    }
  };

  /* ── Pause campaign ── */
  const handlePauseCampaign = async () => {
    setIsCampaignActionPending(true);
    try {
      const res = await soft7AxiosInstance.post(`/admin/campaigns/${campaignId}/pause`);
      toast.success(res.data?.message || "Campaign paused successfully!");
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not pause campaign.");
    } finally {
      setIsCampaignActionPending(false);
    }
  };

  /* ── Fetch campaign ── */
  const fetchCampaign = async () => {
    try {
      const res = await soft7AxiosInstance.get(`/admin/campaigns/${campaignId}`);
      if (res.data.success && res.data.data) return res.data.data;
      return null;
    } catch (e: any) {
      if (e.response?.status === 401) toast.error("Session expired.");
      return null;
    }
  };

  /* ── Fetch messages ── */
  const fetchMessages = async (status: MessageStatus, page: number) => {
    setStatusData((p) => ({ ...p, [status]: { ...p[status], loading: true } }));
    try {
      const normalise = (msg: any): CampaignMessage => ({
        leadName: msg.leadName ?? null,
        phoneNumber: msg.phoneNumber ?? "",
        messageStatus: (msg.status ?? "pending").toLowerCase() as MessageStatus,
        fromPhone: msg.fromPhone ?? "",
        toPhone: msg.toPhone ?? "",
        templateName: msg.templateName ?? "",
        templateVariables: msg.templateVariables ?? {},
        messageCost: String(msg.messageCost ?? "0"),
        messageError: msg.errorMessage ?? msg.messageError ?? null,
        campaignError: msg.campaignError ?? null,
        messageErrorCode: msg.messageErrorCode != null ? String(msg.messageErrorCode) : null,
        readAt: msg.readAt ?? null,
        deliveredAt: msg.deliveredAt ?? null,
        failedAt: msg.failedAt ?? null,
        sentAt: msg.sentAt ?? null,
      });
      const res    = await soft7AxiosInstance.get(`/admin/campaigns/${campaignId}/messages`, { params: { status, page, pagesize: PAGE_SIZE } });
      const result = res.data;
      const data   = result?.data?.data ?? result?.data ?? [];
      const pag    = result?.data?.pagination ?? result?.pagination ?? {};
      const msgs   = (Array.isArray(data) ? data : []).map(normalise);
      setStatusData((prev) => ({
        ...prev,
        [status]: {
          messages: msgs, loading: false, page,
          pagination: {
            page: Number(pag?.page ?? page),
            pageSize: Number(pag?.pageSize ?? PAGE_SIZE),
            total: Number(pag?.total ?? 0),
            totalPages: Math.max(1, Number(pag?.totalPages ?? 1)),
            hasNextPage: Boolean(pag?.hasNextPage),
            hasPreviousPage: Boolean(pag?.hasPreviousPage),
          },
        },
      }));
    } catch {
      toast.error(`Failed to load ${status} messages`);
      setStatusData((p) => ({ ...p, [status]: { ...p[status], loading: false } }));
    }
  };

  /* ── Load all ── */
  const loadAll = async () => {
    setLoading(true);
    const cData = await fetchCampaign();
    setCampaign(cData);
    if (cData) {
      setStats({
        totalContacts:  cData.total_recipients || 0,
        sentCount:      parseInt(String(cData.stats?.sent_count ?? 0), 10),
        deliveredCount: parseInt(String(cData.stats?.delivered_count ?? 0), 10),
        failedCount:    parseInt(String(cData.stats?.failed_count ?? 0), 10),
        readCount:      parseInt(String(cData.stats?.read_count ?? 0), 10),
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [campaignId]);

  /* When messages tab opens, fetch once */
  useEffect(() => {
    if (activeTab === "messages" && !messagesLoaded) {
      statuses.forEach((s) => fetchMessages(s, 1));
      setMessagesLoaded(true);
    }
  }, [activeTab]);

  /* ── Status pill style ── */
  const statusPillStyle = (status: string): string => {
    switch (status.toLowerCase()) {
      case "completed":  return "bg-primary text-primary-foreground border-primary";
      case "active":     return "bg-[var(--color-primary)] text-primary-foreground border-[var(--color-primary)]";
      case "running":    return "bg-[var(--color-primary)] text-primary-foreground border-[var(--color-primary)]";
      case "paused":     return "bg-primary-light text-primary-text border-primary-soft";
      case "scheduled":  return "bg-warning-bg text-warning border-warning-border";
      case "failed":     return "bg-error text-white border-error";
      case "draft":      return "bg-surface-active text-secondary-foreground border-border-strong";
      case "pending":    return "bg-primary text-primary-foreground border-primary";
      default:           return "bg-surface-active text-secondary-foreground border-border-strong";
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-foreground" />
          <p className="text-sm font-semibold text-foreground">Loading campaign stats…</p>
        </div>
      </div>
    );
  }

  const chartTotal = stats.totalContacts || (stats.sentCount + stats.deliveredCount + stats.failedCount + stats.readCount);

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <div className="min-h-screen bg-background font-sans">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="bg-background border-b border-black/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/user/campaigns")}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground bg-surface border border-black/15 shadow-2xs hover:bg-black/5 transition cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">
              {campaign?.name || "Campaign Stats"}
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Created {getFmt(campaign, "created")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">

          {/* ── Export Excel Dropdown ── */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setExportDropdownOpen((o) => !o)}
              disabled={isExporting}
              className="px-4 py-2 bg-surface border border-black/15 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-2xs hover:bg-black/5 disabled:opacity-60 transition"
            >
              {isExporting ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span>{isExporting ? "Exporting…" : "Export Excel"}</span>
              {!isExporting && (
                <ChevronRight
                  size={13}
                  className={`transition-transform duration-200 ${exportDropdownOpen ? "rotate-90" : ""}`}
                />
              )}
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-black/15 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3.5 py-2.5 border-b border-black/10 bg-surface-active">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Download as Excel</p>
                </div>
                <div className="divide-y divide-black/5">
                  {[
                    { label: "Export All", filter: "all", icon: <Layers size={13} />, iconBg: "bg-surface-hover" },
                    { label: "Export Sent", filter: "sent", icon: <Send size={13} />, iconBg: "bg-info-bg text-[var(--color-primary)]" },
                    { label: "Export Delivered", filter: "delivered", icon: <CheckCheck size={13} />, iconBg: "bg-primary-lighter text-primary-text" },
                    { label: "Export Failed", filter: "failed", icon: <XCircle size={13} />, iconBg: "bg-error-bg text-error" },
                    { label: "Export Read", filter: "read", icon: <BookOpen size={13} />, iconBg: "bg-primary-lighter text-primary-text" },
                  ].map(({ label, filter, icon, iconBg }) => (
                    <button
                      key={filter}
                      onClick={() => exportToExcelByStatus(filter as "all" | MessageStatus)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold hover:bg-surface-muted transition text-left text-foreground cursor-pointer"
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                        {icon}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { loadAll(); if (messagesLoaded) statuses.forEach((s) => fetchMessages(s, 1)); }}
            className="px-4 py-2 bg-[var(--neutral-950)] text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs hover:bg-black transition"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div className="bg-background border-b border-black/10 px-6 py-3 flex items-center justify-between">
        <div className="inline-flex p-1 rounded-xl bg-surface-active border border-black/10 gap-1">
          {(["overview", "messages"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition capitalize cursor-pointer ${
                activeTab === tab
                  ? "bg-surface text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" ? <BarChart2 size={14} /> : <MessageSquare size={14} />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Status badge + action button */}
        {campaign?.status && (
          <div className="flex items-center gap-2">
            {/* Status badge — compact, professional */}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider border ${statusPillStyle(campaign.status)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
              {campaign.status}
            </span>

            {/* Start / Pause toggle */}
            {campaign.status.toLowerCase() === "active" || campaign.status.toLowerCase() === "running" ? (
              <button
                onClick={handlePauseCampaign}
                disabled={isCampaignActionPending}
                title="Pause Campaign"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary border border-primary text-primary-foreground hover:bg-primary-hover hover:border-primary-hover shadow-2xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCampaignActionPending
                  ? <RefreshCw size={11} className="animate-spin" />
                  : <PauseCircle size={11} />
                }
                {isCampaignActionPending ? "Pausing…" : "Pause"}
              </button>
            ) : (
              <button
                onClick={handleStartCampaign}
                disabled={isCampaignActionPending}
                title="Start Campaign"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-surface border border-black/15 text-muted-foreground hover:text-primary-text hover:border-primary-soft hover:bg-primary-lighter shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCampaignActionPending
                  ? <RefreshCw size={11} className="animate-spin" />
                  : <Play size={11} />
                }
                {isCampaignActionPending ? "Starting…" : "Start"}
              </button>
            )}
          </div>
        )}
      </div>


      {/* ── Body ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ════════════  OVERVIEW TAB  ════════════ */}
        {activeTab === "overview" && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <StatCard label="Total"     value={chartTotal}           pct={100}
                barColor="bg-[var(--neutral-950)]"
                icon={<Users size={15} className="text-foreground" />} />
              <StatCard label="Sent"      value={stats.sentCount}      pct={pct(stats.sentCount)}
                barColor="bg-[var(--color-primary)]"
                icon={<Send size={15} className="text-[var(--color-primary)]" />} />
              <StatCard label="Delivered" value={stats.deliveredCount} pct={pct(stats.deliveredCount)}
                barColor="bg-primary"
                icon={<CheckCheck size={15} className="text-primary-text" />} />
              <StatCard label="Failed"    value={stats.failedCount}    pct={pct(stats.failedCount)}
                barColor="bg-error"
                icon={<XCircle size={15} className="text-error" />} />
              <StatCard label="Read"      value={stats.readCount}      pct={pct(stats.readCount)}
                barColor="bg-[var(--color-primary)]"
                icon={<BookOpen size={15} className="text-primary-text" />} />
            </div>

            {/* Chart + info grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Donut */}
              <div className="self-start h-105 w-full bg-surface rounded-2xl border border-black/15 shadow-sm p-6 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-black/5 pb-3">
                  <h2 className="text-sm font-bold text-foreground">Distribution</h2>
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Users size={12} /> {stats.totalContacts} recipients
                  </span>
                </div>
                <DonutChart
                  sent={stats.sentCount} delivered={stats.deliveredCount}
                  failed={stats.failedCount} read={stats.readCount} total={chartTotal}
                />
              </div>

              {/* Merged Campaign Info + Schedule & Timing */}
              <div className="self-start h-105 w-full bg-surface rounded-2xl border border-black/15 shadow-sm overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-black/10 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-surface-muted flex items-center justify-center shrink-0">
                    <Info size={13} />
                  </div>
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Campaign Info &amp; Schedule</h2>
                </div>

                {/* Campaign Info rows */}
                <div className="px-5 pt-4 pb-3 space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">General</p>
                  <Row label="Name"        value={campaign?.name} />
                  <Row label="Template"    value={(campaign as any)?.template_name || campaign?.templateName || campaign?.name} />
                  <Row label="Description" value={campaign?.description || "No description"} />
                  <Row label="Phone No."   value={campaign?.phone_number || "—"} />
                </div>

                {/* Divider */}
                <div className="mx-5 border-t border-black/8" />

                {/* Schedule & Timing rows */}
                <div className="px-5 pt-3 pb-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock size={10} /> Schedule &amp; Timing</p>
                  <Row label="Scheduled" value={<span className="flex items-center gap-1.5 justify-end font-semibold"><Calendar size={12} className="text-muted-foreground" />{getFmt(campaign,"scheduled")}</span>} />
                  <Row label="Started"   value={<span className="flex items-center gap-1.5 justify-end font-semibold"><PlayCircle size={12} />{getFmt(campaign,"started")}</span>} />
                  <Row label="Completed" value={<span className="flex items-center gap-1.5 justify-end font-semibold"><CheckCircle size={12} className="text-primary-text" />{getFmt(campaign,"completed")}</span>} />
                  <Row label="Created"   value={<span className="flex items-center gap-1.5 justify-end font-semibold"><FileText size={12} className="text-muted-foreground" />{getFmt(campaign,"created")}</span>} />
                </div>
              </div>

              {/* Template Preview */}
              <div className="bg-surface rounded-2xl border border-black/15 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 border-b border-black/10 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-surface-muted flex items-center justify-center shrink-0">
                    <MessageSquare size={13} />
                  </div>
                  <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Template Preview</h2>
                </div>

                <div className="flex-1 p-5 flex flex-col gap-3">
                  {/* Template name chip */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Template</span>
                    <span className="text-[11px] font-bold text-foreground bg-surface-active px-2.5 py-0.5 rounded-lg">
                      {campaign?.template_name || campaign?.templateName || "—"}
                    </span>
                  </div>

                  {/* WhatsApp-style bubble */}
                  <div className="flex-1 bg-surface-active rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden">
                    {(() => {
                      const tParams        = campaign?.template_params ?? [];
                      const paramMapping   = campaign?.parameter_mapping ?? {};
                      const mediaUploads   = campaign?.media_uploads ?? [];

                      const headerParam = tParams.find((p) => p.type === "HEADER");
                      const bodyParam   = tParams.find((p) => p.type === "BODY");
                      const footerParam = tParams.find((p) => p.type === "FOOTER");
                      const buttonsParam = tParams.find((p) => p.type === "BUTTONS");

                      // Resolve real media image: prefer media_uploads, fallback to header_handle
                      const mediaUrl =
                        mediaUploads[0]?.link ||
                        (headerParam?.example as any)?.header_handle?.[0] ||
                        null;

                      const isImageHeader =
                        headerParam?.format?.toUpperCase() === "IMAGE" ||
                        mediaUploads[0]?.type === "image";

                      // Render mapped variables in bold, preserving the surrounding text.
                      const interpolate = (text: string) =>
                        text.split(/(\{\{\s*[^{}]+\s*\}\})/g).map((part, index) => {
                          if (index % 2 === 0) return part;
                          const mapping = paramMapping[part.slice(2, -2).trim()];
                          const val = typeof mapping === "string" ? mapping : mapping?.field;
                          return val ? <strong key={index} className="font-bold">[{val}]</strong> : part;
                        });

                      return (
                        <>
                          {/* Message bubble */}
                          <div className="bg-surface rounded-xl rounded-tl-none shadow-sm max-w-[92%] self-start overflow-hidden">
                            {/* Media image */}
                            {isImageHeader && mediaUrl && (
                              <img
                                src={mediaUrl}
                                alt="Template media"
                                className="w-full max-h-48 object-cover rounded-t-xl"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            )}

                            <div className="px-3.5 py-2.5">
                              {/* Header text (if not image) */}
                              {headerParam && !isImageHeader && headerParam.text && (
                                <p className="text-[12px] font-bold text-foreground mb-1.5">{headerParam.text}</p>
                              )}

                              {/* Body text with interpolated variables */}
                              {bodyParam?.text ? (
                                <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">
                                  {interpolate(bodyParam.text)}
                                </p>
                              ) : (
                                <p className="text-[11px] text-muted-foreground italic">No body text</p>
                              )}

                              {/* Footer */}
                              {footerParam?.text && (
                                <p className="text-[10px] text-muted-foreground mt-1.5">{footerParam.text}</p>
                              )}

                              <span className="text-[9px] text-muted-foreground float-right mt-1 clear-both">
                                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                              </span>
                            </div>
                          </div>

                          {/* Buttons */}
                          {buttonsParam?.buttons && buttonsParam.buttons.length > 0 && (
                            <div className="flex flex-col gap-1 max-w-[92%]">
                              {buttonsParam.buttons.map((btn, i) => (
                                <div
                                  key={i}
                                  className="bg-surface rounded-xl text-center py-2 px-3 text-[11px] font-bold text-info shadow-sm flex items-center justify-center gap-1.5"
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
                                  ) : btn.text}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Phone watermark */}
                    <span className="text-[9px] font-semibold text-muted-foreground/60 self-end mt-auto pt-1">
                      {campaign?.phone_number || "WhatsApp"}
                    </span>
                  </div>

                  {/* Recipient count */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium border-t border-black/8 pt-3">
                    <span className="flex items-center gap-1"><Users size={11} /> Recipients</span>
                    <span className="font-bold text-foreground">{(campaign?.total_recipients ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>

            
          </>
        )}


        {/* ════════════  MESSAGES TAB  ════════════ */}
        {activeTab === "messages" && (
          <div className="space-y-5">
            {/* Sub-tabs */}
            <div className="inline-flex p-1 rounded-xl bg-surface-active border border-black/10 gap-1">
              {(["sent", "delivered", "failed", "read"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveMessageFilter(s)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition capitalize cursor-pointer ${
                    activeMessageFilter === s
                      ? "bg-surface text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Render active panel */}
            {(() => {
              const activeData = statusData[activeMessageFilter];
              const propsMap: Record<MessageStatus, { title: string; icon: React.ReactNode }> = {
                sent: { title: "Sent Messages", icon: <Send size={13} /> },
                delivered: { title: "Delivered Messages", icon: <CheckCheck size={13} /> },
                failed: { title: "Failed Messages", icon: <XCircle size={13} /> },
                read: { title: "Read Messages", icon: <BookOpen size={13} /> },
                pending: { title: "Pending Messages", icon: <Info size={13} /> },
              };
              const props = propsMap[activeMessageFilter];

              return (
                <MessagePanel
                  title={props.title} status={activeMessageFilter}
                  icon={props.icon}
                  actionButton={
                    activeMessageFilter === "failed" && (
                      <button
                        onClick={handleRebroadcast}
                        disabled={isRebroadcasting}
                        className="px-4 py-2 bg-error text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs hover:bg-error transition disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isRebroadcasting ? "animate-spin" : ""} />
                        <span>{isRebroadcasting ? "Rebroadcasting..." : "Rebroadcast Failed"}</span>
                      </button>
                    )
                  }
                  messages={activeData.messages} loading={activeData.loading}
                  pagination={activeData.pagination} currentPage={activeData.page} pageSize={PAGE_SIZE}
                  onPageChange={(p) => {
                    setStatusData((prev) => ({ ...prev, [activeMessageFilter]: { ...prev[activeMessageFilter], page: p } }));
                    fetchMessages(activeMessageFilter, p);
                  }}
                />
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
