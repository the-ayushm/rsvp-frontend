/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import styles from "../../templates.module.css";
import {
  MessagingLimitBadge,
  MessagingLimitStrip,
  useWabaMessagingLimit,
} from "@/features/integrations/components/MessagingLimit";

export interface WhatsAppComponent {
  text: string;
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  buttons?: any[];
  example?: any;
}

export interface PhoneNumber {
  id: string;
  company_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  code_verification_status: string | null;
  quality_rating: string;
  status: string;
  messaging_limit_tier: number;
  capabilities: any;
  meta_data: any;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WhatsAppTemplate {
  id: string;
  company_id: string;
  waba_id: string;
  template_id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  rejection_reason: string | null;
  components: WhatsAppComponent[];
  meta_data: any;
  synced_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export default function WhatsappTemplatesPage() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [isLoadingPhoneNumbers, setIsLoadingPhoneNumbers] = useState(false);
  const [selectedWabaId, setSelectedWabaId] = useState<string>("");
  const router = useRouter();
  // Refreshed from Meta on page load for the selected WABA (Meta WABA ID is accepted by the API).
  const messagingLimit = useWabaMessagingLimit(selectedWabaId || null);

  // Fetch phone numbers from API
  const fetchPhoneNumbers = async () => {
    setIsLoadingPhoneNumbers(true);
    try {
      const response = await soft7AxiosInstance.get('/admin/waba/phone-numbers');

      const result = response.data;
      console.log("📞 Phone numbers response:", result);

      if (result.success && result.data) {
        setPhoneNumbers(result.data);
        toast.success(`Loaded ${result.data.length} phone numbers`);
      } else {
        setPhoneNumbers([]);
      }
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error);
      toast.error('Failed to load phone numbers');
    } finally {
      setIsLoadingPhoneNumbers(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  // Build the list of unique WABA accounts from the phone numbers we got back.
  // Each WABA can have multiple phone numbers, so we group them here.
  const wabaAccounts = useMemo(() => {
    const map = new Map<string, { waba_id: string; verified_name: string; count: number; displayNumbers: string[] }>();
    phoneNumbers.forEach((phone) => {
      if (!map.has(phone.waba_id)) {
        map.set(phone.waba_id, {
          waba_id: phone.waba_id,
          verified_name: phone.verified_name,
          count: 1,
          displayNumbers: phone.display_phone_number ? [phone.display_phone_number] : [],
        });
      } else {
        const item = map.get(phone.waba_id)!;
        item.count += 1;
        if (phone.display_phone_number && !item.displayNumbers.includes(phone.display_phone_number)) {
          item.displayNumbers.push(phone.display_phone_number);
        }
      }
    });
    return Array.from(map.values());
  }, [phoneNumbers]);

  // Whenever the phone number list changes (e.g. after a refresh), make sure
  // we always have a valid WABA selected. Default to the first one.
  useEffect(() => {
    if (wabaAccounts.length === 0) {
      setSelectedWabaId("");
      return;
    }
    const stillExists = wabaAccounts.some((w) => w.waba_id === selectedWabaId);
    if (!selectedWabaId || !stillExists) {
      setSelectedWabaId(wabaAccounts[0].waba_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wabaAccounts]);

  // Only show phone numbers that belong to the currently selected WABA account
  const filteredPhoneNumbers = useMemo(
    () => phoneNumbers.filter((phone) => phone.waba_id === selectedWabaId),
    [phoneNumbers, selectedWabaId]
  );

  const handleCopy = (text: string, field: string) => {
    if (navigator?.clipboard) navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const renderCopyCell = (value: string, field: string, label: string) => (
    <div className={styles['table-cell-copy']}>
      <span className="font-mono text-xs" title={value}>{value}</span>
      <button
        onClick={() => handleCopy(value, field)}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        className={`${styles['copy-button']} ${copiedField === field ? styles['copied'] : ''}`}
      >
        {copiedField === field ? (
          <Check style={{ width: '1rem', height: '1rem' }} />
        ) : (
          <Copy style={{ width: '1rem', height: '1rem' }} />
        )}
      </button>
    </div>
  );

  const getQualityRatingColor = (rating: string) => {
    switch (rating?.toUpperCase()) {
      case 'GREEN':
        return 'text-primary-text bg-[var(--color-success-light)] dark:bg-primary-light/30';
      case 'YELLOW':
        return 'text-warning bg-warning-bg dark:bg-warning-bg/30';
      case 'RED':
        return 'text-error bg-error-bg dark:bg-error-bg/30';
      default:
        return 'text-secondary-foreground bg-surface-muted dark:bg-surface-raised';
    }
  };

  const getPhoneNumberStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <CheckCircle className="w-3 h-3 text-primary-text" />;
      case 'inactive':
        return <AlertCircle className="w-3 h-3 text-error" />;
      default:
        return <Smartphone className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <div className={styles['templates-page']}>
      <div className={styles['templates-container']}>
        {/* Header */}
        <div className={styles['page-header']}>
          <h1 className={styles['page-title']}>Connected Phone Numbers</h1>
          <p className={styles['page-description']}>
            Manage your WhatsApp templates and connected phone numbers
          </p>
        </div>

        {/* WABA Account selector - matching dark theme and showing phone numbers instead of ID */}
        {wabaAccounts.length > 0 && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.85rem 1.25rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(var(--color-primary-rgb), 0.2)",
              background: "rgba(var(--color-primary-rgb), 0.055)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text)" }}>
                WhatsApp Business Account
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", marginTop: "0.15rem" }}>
                Showing phone numbers for this WhatsApp Business Account.
              </div>
            </div>

            <div style={{ position: "relative", minWidth: "280px" }}>
              <select
                value={selectedWabaId}
                onChange={(e) => setSelectedWabaId(e.target.value)}
                style={{
                  width: "100%",
                  appearance: "none",
                  padding: "0.6rem 2.25rem 0.6rem 0.95rem",
                  borderRadius: "0.5rem",
                  border: "1.5px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  outline: "none",
                  boxShadow: "var(--shadow-token-sm)",
                }}
              >
                {wabaAccounts.map((waba) => {
                  const numbersStr = waba.displayNumbers.length > 0 ? waba.displayNumbers.join(", ") : waba.waba_id;
                  const label = waba.verified_name ? `${waba.verified_name} (${numbersStr})` : numbersStr;
                  return (
                    <option key={waba.waba_id} value={waba.waba_id} style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "1rem",
                  height: "1rem",
                  pointerEvents: "none",
                  color: "var(--text-secondary)",
                }}
              />
            </div>

            <MessagingLimitStrip {...messagingLimit} className="basis-full" />
          </div>
        )}

        {/* Phone Numbers Section */}
        <div className={styles['section']}>
          <div className={`${styles['section-header']} flex items-center justify-between mb-4`}>
            <h2 className={styles['section-title']}>Connected Phone Numbers</h2>
          </div>

          <div className={styles['table-container']}>
            <div className={styles['table-wrapper']}>
              {/* Fixed layout: sized so the IDs and the action button are never cut off; scrolls on narrow screens. */}
              <table className={styles['data-table']} style={{ minWidth: '1275px' }}>
                <colgroup>
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '155px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '190px' }} />
                  <col style={{ width: '190px' }} />
                  <col style={{ width: '190px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Display Number</th>
                    <th>Verified Name</th>
                    <th>Quality Rating</th>
                    <th>Messaging Limit</th>
                    <th>Status</th>
                    <th>Phone Number ID</th>
                    <th>WABA ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPhoneNumbers ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="animate-spin mx-auto mb-2" style={{ width: '1.5rem', height: '1.5rem' }} />
                        Loading phone numbers...
                      </td>
                    </tr>
                  ) : filteredPhoneNumbers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        No phone numbers found
                      </td>
                    </tr>
                  ) : (
                    filteredPhoneNumbers.map((phone) => (
                      <tr key={phone.id}>
                        <td className={styles['table-cell-bold']}>
                          <div className="flex items-center gap-2">
                            {getPhoneNumberStatusIcon(phone.status)}
                            {phone.display_phone_number}
                          </div>
                        </td>
                        <td>{phone.verified_name}</td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getQualityRatingColor(phone.quality_rating)}`}>
                            {phone.quality_rating}
                          </span>
                        </td>
                        <td>
                          <MessagingLimitBadge {...messagingLimit} />
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            phone.status === 'active' ? 'bg-[var(--color-success-light)] text-[var(--color-success-dark)] dark:bg-primary-light/30 dark:text-[var(--color-primary)]' :
                            'bg-error-bg text-error dark:bg-error-bg/30 dark:text-error'
                          }`}>
                            {phone.status}
                          </span>
                        </td>
                        <td>{renderCopyCell(phone.phone_number_id, `phoneNumberId-${phone.id}`, "phone number ID")}</td>
                        <td>{renderCopyCell(phone.waba_id, `wabaId-${phone.id}`, "WABA ID")}</td>
                        <td>
                          <button
                            onClick={() => router.push(`/user/manage/templates/phone/${phone.id}`)}
                            className={styles["manage-template-button"]}
                            title="Manage templates for this phone number"
                          >
                            <Pencil style={{ width: '0.75rem', height: '0.75rem' }} />
                            Manage Template
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
