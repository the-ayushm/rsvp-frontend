/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

'use client';
import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ContactPieChart } from '@/components/chart';
import { LeadSourcesBreakdown } from '@/features/dashboard/components/StatsBreakdown/StatsBreakdown';
import './dashboard.css';
import {
  SendIcon,
  ReceiveIcon,
  UsersIcon,
  UserIcon,
  BarChartIcon,
  LineChartIcon,
  ClockIcon,
  CheckIcon,
  SourceIcon,
} from '@/features/dashboard/components/source-icons';
import { soft7AxiosInstance } from '@/lib/axiosInstance';
import toast from 'react-hot-toast';
import Chart from 'chart.js/auto';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TimeFrame = '7days' | '1month' | '6months' | '1year' | 'all';

interface DashboardStats {
  campaigns_count: string;
  chatbot_count: string;
  contacts_count: string;
  contact_lists_count: string;
  sent_count: string;
  failed_count: string;
  delivered_count: string;
  total_count: string;
  received_count: string;
  message_template_count: string;
  unique_contacts_count: string;
  templates_count: string;
  total_messages: number;
  /** OPTIONAL: ask backend to return these to unlock trends + failure reasons. */
  previous_period?: {
    total_messages?: number;
    delivered_count?: string;
    failed_count?: string;
    received_count?: string;
  };
  failure_reasons?: { reason: string; count: number }[];
}

interface MessageBarItem {
  label: string;
  value: number;
  color: string;
}

interface SourceRow {
  sourceKey: string;
  sourceName: string;
  totalCount: number;
  pending: number;
  assigned: number;
}

/* ------------------------------------------------------------------ */
/* Config: edit routes + user name here                                */
/* ------------------------------------------------------------------ */

const ROUTES = {
  contacts: '/user/contacts',
  broadcast: '/user/campaigns',
  templates: '/user/templates',
  inbox: '/user/inbox',
  failed: '/user/campaigns?status=failed',
};

// TODO: wire this from your auth store / session
const USER_NAME: string | undefined = undefined;

// WhatsApp-style status colours. Brand terracotta stays for actions.
const STATUS = {
  success: '#25D366',
  successText: '#128C7E',
  warning: '#C79224',
  danger: '#C0392B',
  brand: 'var(--dashboard-action)',
};

const TIME_FRAMES: TimeFrame[] = ['7days', '1month', '6months', '1year', 'all'];

const getTimeFrameLabel = (frame: string) => {
  switch (frame) {
    case '7days': return 'Last 7 days';
    case '1month': return 'Last month';
    case '6months': return 'Last 6 months';
    case '1year': return 'Last year';
    case 'all': return 'All time';
    default: return frame;
  }
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ------------------------------------------------------------------ */
/* Animations (kept; fewer entrance effects, shimmer used for loading) */
/* ------------------------------------------------------------------ */

const DashboardAnimations = () => (
  <style jsx global>{`
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
    @keyframes popIn { 0% { opacity: 0; transform: scale(0); } 70% { transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes drawLine { from { stroke-dashoffset: 1200; } to { stroke-dashoffset: 0; } }
    @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
    @keyframes livePulse { 0% { box-shadow: 0 0 0 0 rgba(37,211,102,0.55); } 70% { box-shadow: 0 0 0 7px rgba(37,211,102,0); } 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); } }

    .animate-fade-in-up { opacity: 0; animation: fadeInUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    .animate-fade-in { opacity: 0; animation: fadeIn 0.5s ease-out forwards; }
    .animate-scale-in { opacity: 0; animation: scaleIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    .animate-pop-in { opacity: 0; animation: popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    .animate-draw-line { stroke-dasharray: 1200; animation: drawLine 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    .live-dot { animation: livePulse 2s ease-out infinite; }
    .skeleton-shimmer {
      background: linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.09) 37%, rgba(0,0,0,0.04) 63%);
      background-size: 400px 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    .dark .skeleton-shimmer {
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 37%, rgba(255,255,255,0.04) 63%);
      background-size: 400px 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      .animate-fade-in-up, .animate-fade-in, .animate-scale-in, .animate-pop-in,
      .animate-draw-line, .live-dot, .skeleton-shimmer {
        animation: none !important; opacity: 1 !important; transform: none !important; stroke-dashoffset: 0 !important;
      }
    }
  `}</style>
);

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/** Counts a number up from 0 on first render and whenever the target changes. */
const useCountUp = (target: number, decimals = 0, duration = 800) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target === 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
};

const pctChange = (current: number, previous?: number) => {
  if (previous === undefined || previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
};

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

const FailureIcon = ({ size = 22, color = STATUS.danger }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3L21 20H3L12 3Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 9V13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16.5" r="1" fill={color} />
  </svg>
);

const ArrowIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`skeleton-shimmer rounded-lg ${className}`} />
);

const EmptyState = ({
  icon,
  title,
  body,
  cta,
  onCta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) => (
  <div className="text-center py-8 px-4 animate-fade-in">
    <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-paper-2 border border-border flex items-center justify-center">
      {icon}
    </div>
    <p className="font-semibold text-foreground">{title}</p>
    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{body}</p>
    {cta && onCta && (
      <button
        onClick={onCta}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--terracotta)] hover:opacity-90 transition-opacity"
      >
        {cta}
      </button>
    )}
  </div>
);

/** Primary KPI card: big number, optional trend, optional bar, optional action. */
const KpiCard = ({
  label,
  value,
  decimals = 0,
  suffix = '',
  hint,
  icon,
  tone = 'default',
  change,
  barPercent,
  action,
  index = 0,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'brand';
  change?: number | null;
  barPercent?: number;
  action?: { label: string; onClick: () => void };
  index?: number;
}) => {
  const shown = useCountUp(value, decimals);
  const toneMap = {
    default: { chip: 'bg-paper-2', bar: STATUS.brand },
    success: { chip: 'bg-[#25D366]/15', bar: STATUS.success },
    danger: { chip: 'bg-[var(--destructive)]/12', bar: STATUS.danger },
    brand: { chip: 'bg-[var(--terracotta)]/15', bar: STATUS.brand },
  }[tone];

  // For "failed", an increase is bad. Caller passes the sign it wants coloured.
  const changeGood = change === null || change === undefined ? null : tone === 'danger' ? change <= 0 : change >= 0;

  return (
    <div
      className="animate-fade-in-up bg-white dark:bg-card rounded-2xl border border-[#EDE0D0] dark:border-border p-5 shadow-[0_2px_10px_rgba(36,28,20,0.05)] flex flex-col"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`${toneMap.chip} p-2.5 rounded-xl`}>{icon}</div>
        {change !== null && change !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full bg-paper-2 border border-border/50"
            style={{ color: changeGood ? STATUS.successText : STATUS.danger }}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% vs previous
          </span>
        )}
      </div>

      <h3 className="text-sm text-muted-foreground font-medium">{label}</h3>
      <p className="font-display text-3xl font-bold text-foreground tracking-tight tabular-nums mt-0.5">
        {shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}

      {barPercent !== undefined && (
        <div className="mt-3 w-full bg-paper-2 rounded-full h-1.5 overflow-hidden" aria-hidden="true">
          <div
            className="h-1.5 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, barPercent))}%`, background: toneMap.bar }}
          />
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--terracotta)] hover:underline self-start"
        >
          {action.label}
          <ArrowIcon size={14} />
        </button>
      )}
    </div>
  );
};

/** Compact tile for secondary counts (lists, campaigns, bots...). */
const MiniStat = ({
  label,
  value,
  hint,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  onClick?: () => void;
}) => {
  const shown = useCountUp(value);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="dashboard-summary-card text-left bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-[var(--terracotta)]/40 transition-colors disabled:cursor-default"
    >
      <div className="bg-paper-2 p-2 rounded-lg shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="font-display text-xl font-bold text-foreground tabular-nums leading-tight">
          {shown.toLocaleString()}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{hint}</p>
      </div>
    </button>
  );
};

const StatCard = ({ title, value, icon, onClick, index = 0 }: any) => (
  <button
    onClick={onClick}
    className="animate-fade-in-up text-left bg-white dark:bg-card rounded-2xl p-5 border border-[#EDE0D0] dark:border-border hover:border-[var(--terracotta)]/40 transition-colors group w-full"
    style={{ animationDelay: `${index * 0.06}s` }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="bg-paper-2 p-2.5 rounded-xl">{icon}</div>
      <span className="text-muted-foreground group-hover:text-[var(--terracotta)] group-hover:translate-x-0.5 transition-all">
        <ArrowIcon />
      </span>
    </div>
    <h4 className="text-sm text-muted-foreground font-medium mb-0.5">{title}</h4>
    <p className="font-display text-2xl font-bold text-foreground tabular-nums">{Number(value).toLocaleString()}</p>
  </button>
);

/* ------------------------------------------------------------------ */
/* Onboarding checklist                                                */
/* ------------------------------------------------------------------ */

const OnboardingChecklist = ({
  steps,
  onNavigate,
}: {
  steps: { label: string; done: boolean; href: string }[];
  onNavigate: (href: string) => void;
}) => {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const pct = (doneCount / steps.length) * 100;

  return (
    <div className="animate-fade-in-up bg-card rounded-2xl border border-border p-5 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Get started</h2>
          <p className="text-sm text-muted-foreground">Finish these steps to send your first campaign.</p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <div className="w-full bg-paper-2 rounded-full h-1.5 my-4 overflow-hidden" aria-hidden="true">
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: STATUS.success }} />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {steps.map((s) => (
          <li key={s.label}>
            <button
              onClick={() => onNavigate(s.href)}
              className="flex items-center gap-2.5 text-sm w-full text-left py-1 hover:text-[var(--terracotta)] transition-colors"
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border"
                style={s.done ? { background: STATUS.success, borderColor: STATUS.success } : {}}
              >
                {s.done && <CheckIcon size={12} color="#fff" />}
              </span>
              <span className={s.done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}>
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Failure reasons                                                     */
/* ------------------------------------------------------------------ */

const FailureReasonsCard = ({
  reasons,
  failedCount,
  onReview,
}: {
  reasons?: { reason: string; count: number }[];
  failedCount: number;
  onReview: () => void;
}) => {
  const total = reasons?.reduce((a, r) => a + r.count, 0) || 0;

  return (
    <div className="animate-fade-in-up bg-card rounded-2xl border border-border p-6 flex flex-col" style={{ animationDelay: '0.2s' }}>
      <h2 className="font-display text-lg font-bold text-foreground">Why messages failed</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {failedCount > 0 ? `${failedCount.toLocaleString()} messages need attention.` : 'No failed messages. Nice work.'}
      </p>

      {failedCount === 0 ? null : reasons && reasons.length > 0 ? (
        <div className="space-y-3">
          {reasons.map((r) => {
            const pct = total > 0 ? (r.count / total) * 100 : 0;
            return (
              <div key={r.reason}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground">{r.reason}</span>
                  <span className="font-semibold tabular-nums">{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-paper-2 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: STATUS.danger }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="text-foreground font-medium">Check these first</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Contact hasn&apos;t opted in</li>
            <li>Template isn&apos;t approved yet</li>
            <li>Phone number is invalid</li>
            <li>Customer is outside the 24-hour window</li>
          </ul>
        </div>
      )}

      {failedCount > 0 && (
        <button
          onClick={onReview}
          className="mt-auto pt-4 self-start inline-flex items-center gap-1 text-sm font-medium text-[var(--terracotta)] hover:underline"
        >
          Review failed messages
          <ArrowIcon size={14} />
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

const MessageActivityBarChart = ({ bars, isDarkMode }: { bars: MessageBarItem[]; isDarkMode: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || bars.length === 0) return;

    const styles = getComputedStyle(canvasRef.current);
    const gridColor = styles.getPropertyValue('--dashboard-chart-grid').trim();
    const labelColor = styles.getPropertyValue('--dashboard-text-muted').trim();

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: bars.map((b) => b.label),
        datasets: [
          {
            label: 'Messages',
            data: bars.map((b) => b.value),
            // Canvas colors need resolved values; SVG/CSS can use the tokens directly.
            backgroundColor: bars.map((b) => b.color.startsWith('var(')
              ? styles.getPropertyValue(b.color.slice(4, -1)).trim()
              : b.color),
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 80 : 0) },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: styles.getPropertyValue('--dashboard-surface').trim(),
            titleColor: styles.getPropertyValue('--dashboard-text').trim(),
            bodyColor: styles.getPropertyValue('--dashboard-text').trim(),
            borderColor: styles.getPropertyValue('--dashboard-border').trim(),
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: { label: (ctx) => ' ' + ctx.parsed.y.toLocaleString() + ' messages' },
          },
        },
        layout: { padding: { top: 24, left: 6, right: 6, bottom: 6 } },
        scales: {
          x: { grid: { display: false }, ticks: { color: labelColor, font: { family: 'var(--font-sans)', size: 12 } }, border: { display: false } },
          y: {
            beginAtZero: true,
            suggestedMax: Math.ceil(Math.max(...bars.map((b) => b.value), 10) * 1.15),
            grid: { color: gridColor },
            ticks: {
              color: labelColor,
              font: { family: 'var(--font-sans)', size: 11 },
              callback: (v) => {
                const num = Number(v);
                return num >= 1000 ? (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k' : num;
              },
            },
            border: { display: false },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [bars, isDarkMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} role="img" aria-label="Bar chart of message activity by status" />
    </div>
  );
};

const LeadsLineChart = ({ contactsCount }: { contactsCount: number }) => {
  const now = new Date();
  const points = Array.from({ length: 7 }, (_, i) => Math.round(contactsCount * ((i + 1) / 7)));
  const maxVal = Math.max(...points, 1);
  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  const width = 500, height = 230;
  const padL = 40, padR = 20, padT = 36, padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const yMax = Math.max(Math.ceil(maxVal * 1.35), maxVal + 1);

  const toX = (i: number) => padL + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => padT + chartH - (v / yMax) * chartH;

  const pathD = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const areaD =
    `M ${toX(0).toFixed(1)} ${toY(points[0]).toFixed(1)} ` +
    points.map((v, i) => `L ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ') +
    ` L ${toX(points.length - 1).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${padL} ${(padT + chartH).toFixed(1)} Z`;

  return (
    <div className="w-full h-full flex flex-col">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full flex-1" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Estimated weekly lead trend">
        <defs>
          <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STATUS.brand} stopOpacity="0.25" />
            <stop offset="100%" stopColor={STATUS.brand} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = padT + chartH - (pct / 100) * chartH;
          return (
            <g key={pct}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{Math.round((pct / 100) * yMax)}</text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#leadsGrad)" className="animate-fade-in" style={{ animationDelay: '0.5s' }} />
        <path d={pathD} fill="none" stroke={STATUS.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-line" />
        {points.map((v, i) => (
          <g key={i} className="animate-pop-in" style={{ animationDelay: `${0.9 + i * 0.08}s`, transformOrigin: `${toX(i)}px ${toY(v)}px` }}>
            <circle cx={toX(i)} cy={toY(v)} r="5" fill="var(--card)" stroke={STATUS.brand} strokeWidth="2.5" />
            <text x={toX(i)} y={toY(v) - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill={STATUS.brand}>{v}</text>
          </g>
        ))}
        {labels.map((label, i) => (
          <text key={i} x={toX(i)} y={height - 5} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{label}</text>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="var(--border)" strokeWidth="1" />
        <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke="var(--border)" strokeWidth="1" />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Loading skeleton (replaces full-page spinner)                       */
/* ------------------------------------------------------------------ */

const DashboardSkeleton = () => (
  <div className="dashboard-page min-h-screen bg-[var(--background)] pb-12">
    <DashboardAnimations />
    <div className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-80" />
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');

  useEffect(() => {
    const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fetchDashboardStats = useCallback(async (frame: TimeFrame) => {
    setIsLoadingStats(true);
    try {
      const { data: result } = await soft7AxiosInstance.get(`/admin/users/stats?time_frame=${frame}`);
      if (result.success && result.data) {
        setDashboardStats(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError('Invalid data format from server');
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else {
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load dashboard data');
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Single source of fetching: runs on mount and whenever the time frame changes.
  useEffect(() => {
    fetchDashboardStats(timeFrame);
    const interval = setInterval(() => fetchDashboardStats(timeFrame), 300000);
    return () => clearInterval(interval);
  }, [timeFrame, fetchDashboardStats]);

  const getSourceIcon = useCallback(
    (source: string | null) => <SourceIcon source={source || ''} size={24} color={STATUS.brand} />,
    []
  );

  // NOTE: still a stub. Wire this to your lead-source data (see notes).
  const processedSourcesData = useMemo<SourceRow[]>(() => [], []);

  const pieChartData = useMemo(() => {
    const activeSources = processedSourcesData.filter((s) => s.totalCount > 0);
    if (activeSources.length === 0) return null;

    const colorsMap: Record<string, string> = {
      WhatsApp: '#25D366',
      Instagram: '#E07A5F',
      Facebook: '#4D7298',
      Website: '#C79224',
    };

    return {
      labels: activeSources.map((s) => s.sourceName),
      datasets: [
        {
          data: activeSources.map((s) => s.totalCount),
          backgroundColor: activeSources.map((s) => colorsMap[s.sourceName] || '#766D64'),
          hoverOffset: 8,
          borderWidth: 2,
          borderColor: isDarkMode ? '#221E1C' : '#FCFAF7',
        },
      ],
    };
  }, [processedSourcesData, isDarkMode]);

  const derived = useMemo(() => {
    if (!dashboardStats) return null;
    const n = (v: any) => Number(v) || 0;
    const total = n(dashboardStats.total_messages);
    const delivered = n(dashboardStats.delivered_count);
    const failed = n(dashboardStats.failed_count);
    const inTransit = n(dashboardStats.sent_count);
    const received = n(dashboardStats.received_count);
    const prev = dashboardStats.previous_period;

    return {
      total,
      delivered,
      failed,
      inTransit,
      received,
      contacts: n(dashboardStats.contacts_count),
      lists: n(dashboardStats.contact_lists_count),
      campaigns: n(dashboardStats.campaigns_count),
      chatbots: n(dashboardStats.chatbot_count),
      templates: n(dashboardStats.templates_count),
      deliveryRate: total > 0 ? Math.min(100, (delivered / total) * 100) : 0,
      failureRate: total > 0 ? Math.min(100, (failed / total) * 100) : 0,
      replyRate: total > 0 ? Math.min(100, (received / total) * 100) : 0,
      totalChange: pctChange(total, prev?.total_messages),
      deliveredChange: pctChange(delivered, prev?.delivered_count ? n(prev.delivered_count) : undefined),
      failedChange: pctChange(failed, prev?.failed_count ? n(prev.failed_count) : undefined),
      receivedChange: pctChange(received, prev?.received_count ? n(prev.received_count) : undefined),
    };
  }, [dashboardStats]);

  const messageActivityBars = useMemo((): MessageBarItem[] => {
    if (!derived) return [];
    return [
      { label: 'Total sent', value: derived.total, color: 'var(--dashboard-text)' },
      { label: 'Delivered', value: derived.delivered, color: STATUS.success },
      { label: 'Failed', value: derived.failed, color: STATUS.danger },
      { label: 'In transit', value: derived.inTransit, color: STATUS.brand },
      { label: 'Received', value: derived.received, color: STATUS.warning },
    ];
  }, [derived, isDarkMode]);

  const onboardingSteps = useMemo(() => {
    if (!derived) return [];
    return [
      { label: 'Connect WhatsApp number', done: derived.total > 0, href: '/user/settings' },
      { label: 'Import contacts', done: derived.contacts > 0, href: ROUTES.contacts },
      { label: 'Create a template', done: derived.templates > 0, href: ROUTES.templates },
      { label: 'Send your first campaign', done: derived.campaigns > 0, href: ROUTES.broadcast },
    ];
  }, [derived]);

  const handleSourceClick = (sourceName: string) => {
    router.push(`${ROUTES.contacts}?source=${sourceName.toLowerCase()}`);
  };

  /* ---------------- states ---------------- */

  if (isLoadingStats && !dashboardStats) return <DashboardSkeleton />;

  if (error && !dashboardStats) {
    return (
      <div className="dashboard-page min-h-screen flex items-center justify-center bg-[var(--background)]">
        <DashboardAnimations />
        <div className="animate-scale-in bg-card p-8 rounded-2xl border border-[var(--destructive)]/40 max-w-md text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[var(--destructive)]/12 flex items-center justify-center">
            <FailureIcon size={26} />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Couldn&apos;t load your dashboard</h2>
          <p className="text-muted-foreground mb-6 text-sm">{error}. Check your connection and try again.</p>
          <button
            onClick={() => fetchDashboardStats(timeFrame)}
            className="px-6 py-2.5 bg-[var(--terracotta)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardStats || !derived) {
    return (
      <div className="dashboard-page min-h-screen flex items-center justify-center bg-[var(--background)]">
        <DashboardAnimations />
        <EmptyState
          icon={<BarChartIcon size={22} color={STATUS.brand} />}
          title="No data yet"
          body="Send your first message to start seeing analytics here."
          cta="Create broadcast"
          onCta={() => router.push(ROUTES.broadcast)}
        />
      </div>
    );
  }

  const failedAttention = derived.failureRate >= 10;

  return (
    <div className="dashboard-page min-h-screen bg-[var(--background)] text-foreground pb-12">
      <DashboardAnimations />

      {/* Header: greeting, live indicator, quick actions, time frame */}
      <div className="bg-card backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">
                {getGreeting()}
                {USER_NAME ? `, ${USER_NAME}` : ''}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                <span className="live-dot inline-block w-2 h-2 rounded-full" style={{ background: STATUS.success }} aria-hidden="true" />
                Live, updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <button
                  onClick={() => fetchDashboardStats(timeFrame)}
                  className="ml-1 text-xs text-[var(--terracotta)] hover:underline"
                  aria-label="Refresh dashboard"
                >
                  Refresh
                </button>
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 bg-paper-2 border border-border rounded-xl p-1" role="group" aria-label="Time frame">
              {TIME_FRAMES.map((frame) => (
                <button
                  key={frame}
                  onClick={() => setTimeFrame(frame)}
                  aria-pressed={timeFrame === frame}
                  className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm transition-colors ${
                    timeFrame === frame
                      ? 'text-white font-semibold bg-[var(--terracotta)]'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground font-medium'
                  }`}
                >
                  {getTimeFrameLabel(frame)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => router.push(ROUTES.broadcast)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--terracotta)] hover:opacity-90 transition-opacity"
            >
              <SendIcon size={16} color="#fff" />
              New broadcast
            </button>
            <button
              onClick={() => router.push(ROUTES.contacts)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-[var(--terracotta)]/40 transition-colors"
            >
              <UsersIcon size={16} color={STATUS.brand} />
              Add contact
            </button>
            <button
              onClick={() => router.push(ROUTES.templates)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-[var(--terracotta)]/40 transition-colors"
            >
              <LineChartIcon size={16} color={STATUS.brand} />
              Create template
            </button>
            <button
              onClick={() => router.push(ROUTES.inbox)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-[var(--terracotta)]/40 transition-colors"
            >
              <ReceiveIcon size={16} color={STATUS.brand} />
              Open inbox
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OnboardingChecklist steps={onboardingSteps} onNavigate={(href) => router.push(href)} />

        {/* Row 1: headline KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-4">
          <KpiCard
            index={0}
            label="Messages sent"
            value={derived.total}
            hint="All outbound messages"
            icon={<SendIcon size={22} color={STATUS.brand} />}
            tone="brand"
            change={derived.totalChange}
          />
          <KpiCard
            index={1}
            label="Delivery rate"
            value={derived.deliveryRate}
            decimals={1}
            suffix="%"
            hint={`${derived.delivered.toLocaleString()} delivered`}
            icon={<CheckIcon size={22} color={STATUS.successText} />}
            tone="success"
            barPercent={derived.deliveryRate}
            change={derived.deliveredChange}
          />
          <KpiCard
            index={2}
            label="Failed messages"
            value={derived.failed}
            hint={`${derived.failureRate.toFixed(1)}% of all messages`}
            icon={<FailureIcon size={22} />}
            tone="danger"
            barPercent={derived.failureRate}
            change={derived.failedChange}
            action={failedAttention || derived.failed > 0 ? { label: 'Review failed messages', onClick: () => router.push(ROUTES.failed) } : undefined}
          />
          <KpiCard
            index={3}
            label="Reply rate"
            value={derived.replyRate}
            decimals={1}
            suffix="%"
            hint={`${derived.received.toLocaleString()} inbound replies`}
            icon={<ReceiveIcon size={22} color={STATUS.successText} />}
            tone="success"
            barPercent={derived.replyRate}
            change={derived.receivedChange}
          />
        </div>

        {/* Row 1b: secondary counts */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <MiniStat label="In transit" value={derived.inTransit} hint="Pending delivery" icon={<ClockIcon size={18} color={STATUS.brand} />} />
          <MiniStat label="Total contacts" value={derived.contacts} hint="Active leads" icon={<UsersIcon size={18} color={STATUS.warning} />} onClick={() => router.push(ROUTES.contacts)} />
          <MiniStat label="Contact lists" value={derived.lists} hint="Active lists" icon={<UsersIcon size={18} color={STATUS.warning} />} onClick={() => router.push(ROUTES.contacts)} />
          <MiniStat label="Campaigns" value={derived.campaigns} hint="Total campaigns" icon={<BarChartIcon size={18} color={STATUS.brand} />} onClick={() => router.push(ROUTES.broadcast)} />
          <MiniStat label="Chatbots" value={derived.chatbots} hint="Automated bots" icon={<UserIcon size={18} color="#7B3754" />} />
        </div>

        {/* Row 2: message activity + failure reasons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 animate-fade-in-up bg-card rounded-2xl border border-border p-6" style={{ animationDelay: '0.15s' }}>
            <h2 className="font-display text-lg font-bold text-foreground">Message activity</h2>
            <p className="text-sm text-muted-foreground mt-0.5 mb-4">Messages by delivery status</p>
            <div className="h-64">
              <MessageActivityBarChart bars={messageActivityBars} isDarkMode={isDarkMode} />
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-border">
              {messageActivityBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bar.color }} aria-hidden="true" />
                  <span className="text-xs md:text-sm text-foreground">
                    {bar.label} <span className="text-muted-foreground tabular-nums">{bar.value.toLocaleString()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <FailureReasonsCard
            reasons={dashboardStats.failure_reasons}
            failedCount={derived.failed}
            onReview={() => router.push(ROUTES.failed)}
          />
        </div>

        {/* Row 3: lead analytics + source distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="animate-fade-in-up bg-card rounded-2xl border border-border overflow-hidden" style={{ animationDelay: '0.2s' }}>
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                      <LineChartIcon size={22} color={STATUS.brand} />
                      Lead analytics
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Track lead generation and conversion metrics</p>
                  </div>
                  <div className="flex gap-1.5 bg-paper-2 border border-border rounded-xl p-1" role="group" aria-label="Lead view">
                    {(['list', 'grid'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        aria-pressed={viewMode === mode}
                        className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                          viewMode === mode ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-card hover:text-foreground'
                        }`}
                      >
                        {mode === 'list' ? 'List' : 'Grid'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <StatCard
                    title="Total leads"
                    value={derived.contacts}
                    icon={<UsersIcon size={22} color={STATUS.warning} />}
                    onClick={() => router.push(ROUTES.contacts)}
                    index={0}
                  />
                  <StatCard
                    title="Assigned leads"
                    value={processedSourcesData.reduce((acc, s) => acc + s.assigned, 0)}
                    icon={<UserIcon size={22} color={STATUS.successText} />}
                    onClick={() => router.push(ROUTES.contacts)}
                    index={1}
                  />
                  <StatCard
                    title="Pending leads"
                    value={processedSourcesData.reduce((acc, s) => acc + s.pending, 0)}
                    icon={<ClockIcon size={22} color={STATUS.brand} />}
                    onClick={() => router.push(ROUTES.contacts)}
                    index={2}
                  />
                </div>

                <h3 className="font-display text-base font-bold text-foreground mb-4">Lead source breakdown</h3>

                {processedSourcesData.length === 0 ? (
                  <EmptyState
                    icon={<BarChartIcon size={22} color={STATUS.brand} />}
                    title="No lead sources yet"
                    body="Import contacts with a source channel to see where your leads come from."
                    cta="Import contacts"
                    onCta={() => router.push(ROUTES.contacts)}
                  />
                ) : viewMode === 'list' ? (
                  <div className="space-y-3">
                    {processedSourcesData.map((source, idx) => (
                      <button
                        key={source.sourceKey}
                        onClick={() => handleSourceClick(source.sourceKey)}
                        className="w-full bg-paper border border-border p-4 rounded-xl hover:bg-paper-2 hover:border-[var(--terracotta)]/40 transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center">
                              {getSourceIcon(source.sourceName)}
                            </div>
                            <div>
                              <h4 className="font-display font-bold text-foreground text-base">{source.sourceName}</h4>
                              <p className="text-xs text-muted-foreground">{source.totalCount} total leads</p>
                            </div>
                          </div>
                          <div className="flex gap-6">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                              <p className="font-display text-lg font-bold text-foreground tabular-nums">{source.totalCount}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Pending</p>
                              <p className="font-display text-lg font-bold tabular-nums" style={{ color: STATUS.warning }}>{source.pending}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Assigned</p>
                              <p className="font-display text-lg font-bold tabular-nums" style={{ color: STATUS.successText }}>{source.assigned}</p>
                            </div>
                          </div>
                          <span className="text-muted-foreground group-hover:text-[var(--terracotta)] transition-colors"><ArrowIcon /></span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {processedSourcesData.map((source) => (
                      <button
                        key={source.sourceKey}
                        onClick={() => handleSourceClick(source.sourceKey)}
                        className="bg-paper border border-border p-5 rounded-xl hover:bg-paper-2 hover:border-[var(--terracotta)]/40 transition-colors text-left flex flex-col justify-between min-h-[175px] w-full"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-11 h-11 bg-card border border-border rounded-full flex items-center justify-center shrink-0">
                            {getSourceIcon(source.sourceName)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display font-bold text-foreground truncate">{source.sourceName}</h4>
                            <p className="font-display text-2xl font-bold text-foreground tabular-nums">{source.totalCount}</p>
                          </div>
                        </div>
                        <div className="space-y-2 pt-3 border-t border-border mt-auto w-full">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Pending</span>
                            <span className="font-semibold" style={{ color: STATUS.warning }}>{source.pending}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Assigned</span>
                            <span className="font-semibold" style={{ color: STATUS.successText }}>{source.assigned}</span>
                          </div>
                          <div className="w-full bg-paper-2 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all duration-1000"
                              style={{ width: `${source.totalCount > 0 ? (source.assigned / source.totalCount) * 100 : 0}%`, background: STATUS.success }}
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="animate-fade-in-up bg-card rounded-2xl border border-border p-6 h-full" style={{ animationDelay: '0.25s' }}>
              <h2 className="font-display text-lg font-bold mb-1 text-foreground">Source distribution</h2>
              <p className="text-sm text-muted-foreground mb-4">Contacts by source channel</p>
              <div className="h-80 flex items-center justify-center">
                {pieChartData ? (
                  <div className="w-full h-full">
                    <ContactPieChart data={pieChartData} />
                  </div>
                ) : (
                  <EmptyState
                    icon={<SourceIcon source="" size={22} color={STATUS.brand} />}
                    title="No source data yet"
                    body="Add contacts to see how they split across channels."
                    cta="Import contacts"
                    onCta={() => router.push(ROUTES.contacts)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: leads trend */}
        <div className="animate-fade-in-up bg-card rounded-2xl border border-border p-6 mb-8" style={{ animationDelay: '0.3s' }}>
          <h2 className="font-display text-lg font-bold mb-1 text-foreground">Leads and conversions</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Estimated weekly trend, based on your total of {derived.contacts.toLocaleString()} contacts
          </p>
          <div className="h-72">
            <LeadsLineChart contactsCount={derived.contacts} />
          </div>
        </div>

        {/* Row 5: recent activity */}
        <div className="animate-fade-in-up bg-card rounded-2xl border border-border overflow-hidden" style={{ animationDelay: '0.35s' }}>
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-lg font-bold text-foreground">Recent activity and breakdown</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Latest interactions and detailed analytics</p>
          </div>
          <div className="p-6">
            <LeadSourcesBreakdown timeframe={timeFrame} data={dashboardStats} isLoading={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
