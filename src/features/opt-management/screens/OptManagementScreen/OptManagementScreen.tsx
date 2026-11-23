/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Plus, Trash2, XCircle, ArrowLeft, ShieldCheck, HelpCircle, Smartphone, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import "./opts-management.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

type OptType = "OPT_IN" | "OPT_OUT";

interface Keyword {
  id: number;
  keyword: string;
  type: OptType;
}

interface WabaPhoneNumber {
  id: string;
  phone_number_id?: string;
  display_phone_number: string;
  verified_name?: string;
}

const DEFAULT_KEYWORDS: Keyword[] = [
  { id: 1, keyword: "STOP", type: "OPT_OUT" },
  { id: 2, keyword: "UNSUBSCRIBE", type: "OPT_OUT" },
  { id: 3, keyword: "CANCEL", type: "OPT_OUT" },
  { id: 4, keyword: "QUIT", type: "OPT_OUT" },
  { id: 5, keyword: "START", type: "OPT_IN" },
  { id: 6, keyword: "SUBSCRIBE", type: "OPT_IN" },
  { id: 7, keyword: "JOIN", type: "OPT_IN" },
];

/* ===========================================================
   REUSABLE KEYWORD CARD COMPONENT
   =========================================================== */
const KeywordCard: React.FC<{
  type: OptType;
  title: string;
  description: string;
  keywords: Keyword[];
  onDelete: (id: number) => void;
  onAdd: (keyword: string) => void;
}> = ({ type, title, description, keywords, onDelete, onAdd }) => {
  const [newKeyword, setNewKeyword] = useState("");
  const keywordLimit = 10;

  const parsedKeywords = useMemo(() => {
    return newKeyword
      .split(/[\s,]+/)
      .map((k) => k.trim().toUpperCase())
      .filter((k) => k.length > 0);
  }, [newKeyword]);

  const existingCount = keywords.length;
  const remainingSlots = Math.max(0, keywordLimit - existingCount);
  const liveCount = Math.min(keywordLimit, existingCount + parsedKeywords.length);

  const handleAddClick = () => {
    if (!parsedKeywords.length) return;
    if (remainingSlots === 0) {
      toast.error(`Limit reached! Maximum ${keywordLimit} keywords allowed for ${type === 'OPT_IN' ? 'Opt-In' : 'Opt-Out'}.`);
      return;
    }

    const toAdd = parsedKeywords.slice(0, remainingSlots);
    toAdd.forEach((kw) => onAdd(kw));
    setNewKeyword("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddClick();
    }
  };

  const isOut = type === "OPT_OUT";
  const badgeColor = isOut
    ? "bg-error/10 border-error/20 text-error dark:text-error"
    : "bg-primary/10 border-primary/20 text-primary-text dark:text-[var(--color-primary)]";

  return (
    <div className="keyword-card flex-1 p-6 sm:p-7 rounded-3xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {title}
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${badgeColor}`}>
              {keywords.length} active
            </span>
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-5">{description}</p>

        {/* Keyword list */}
        <div className="keyword-list-container h-48 overflow-y-auto rounded-2xl p-3.5 mb-5 space-y-2">
          {keywords.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {keywords.map((k) => (
                <div
                  key={k.id}
                  className="keyword-item flex items-center justify-between px-4 py-2.5 rounded-xl border shadow-2xs transition group"
                >
                  <span className="font-semibold text-xs tracking-wider">
                    {k.keyword.toUpperCase()}
                  </span>
                  <button
                    onClick={() => onDelete(k.id)}
                    className="delete-button p-1.5 rounded-lg opacity-80 group-hover:opacity-100 transition"
                    title="Remove keyword"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state text-center py-10 flex flex-col items-center justify-center gap-2 h-full">
              <HelpCircle size={28} className="opacity-40" />
              <p className="text-xs italic">
                No {type === "OPT_IN" ? "opt-in" : "opt-out"} keywords added yet.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="keyword-counter pt-4">
        <div className="text-xs mb-2 font-medium flex justify-between items-center px-1">
          <span className="text-muted-foreground">Keywords Limit:</span>
          <span
            className={`font-bold ${
              liveCount >= keywordLimit ? "text-error" : isOut ? "text-error dark:text-error" : "text-primary-text dark:text-[var(--color-primary)]"
            }`}
          >
            {existingCount} / {keywordLimit}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type keyword(s) e.g. STOP, QUIT"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={remainingSlots === 0}
            className="keyword-input flex-1 px-4 py-2.5 rounded-xl text-xs outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={handleAddClick}
            disabled={!parsedKeywords.length || remainingSlots === 0}
            className="add-button-out px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Plus size={15} className="mr-1" /> Add
          </button>
        </div>

        {remainingSlots === 0 && (
          <div className="error-message flex items-center text-[11px] mt-2 rounded-lg p-2 gap-1.5">
            <XCircle size={14} className="shrink-0" />
            <span>Keyword limit reached. Remove some keywords to add more.</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ===========================================================
   MAIN PAGE
   =========================================================== */
export default function OptsManagement() {
  const router = useRouter();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumbers, setPhoneNumbers] = useState<WabaPhoneNumber[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Fetch WABA Phone Numbers
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const res = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
        let list: WabaPhoneNumber[] = [];
        if (res.data?.success && Array.isArray(res.data.data)) {
          list = res.data.data;
        } else if (Array.isArray(res.data)) {
          list = res.data;
        }

        setPhoneNumbers(list);
        if (list.length > 0) {
          const firstId = list[0].phone_number_id || list[0].id;
          setSelectedPhoneId(firstId);
        }
      } catch (err) {
        console.warn("Failed to fetch WABA numbers:", err);
      }
    };

    fetchPhoneNumbers();
  }, []);

  // 2. Fetch Keywords for selected Phone Number or default API
  const fetchKeywords = async (phoneId?: string) => {
    const activePhoneId = phoneId || selectedPhoneId;
    setIsLoading(true);
    try {
      const saved = localStorage.getItem(`soft7_opt_keywords_${activePhoneId || "default"}`);
      let initialData: Keyword[] = saved ? JSON.parse(saved) : DEFAULT_KEYWORDS;

      if (activePhoneId) {
        let res: any;
        try {
          res = await soft7AxiosInstance.get(`/admin/contacts/opt-in-out/keywords/${activePhoneId}`);
        } catch {
          res = await soft7AxiosInstance.get(`/contacts/opt-in-out/keywords/${activePhoneId}`);
        }

        const data = res.data?.data || res.data;
        const optInArr: string[] = data?.opt_in_keywords || data?.opt_in || [];
        const optOutArr: string[] = data?.opt_out_keywords || data?.opt_out || [];

        if (optInArr.length > 0 || optOutArr.length > 0) {
          initialData = [
            ...optOutArr.map((k: string, idx: number) => ({ id: idx + 1, keyword: k.toUpperCase(), type: "OPT_OUT" as OptType })),
            ...optInArr.map((k: string, idx: number) => ({ id: idx + 100, keyword: k.toUpperCase(), type: "OPT_IN" as OptType })),
          ];
        }
      }
      setKeywords(initialData);
      localStorage.setItem(`soft7_opt_keywords_${activePhoneId || "default"}`, JSON.stringify(initialData));
    } catch (err) {
      console.warn("Backend fetch notice, using cached keywords:", err);
      const saved = localStorage.getItem(`soft7_opt_keywords_${activePhoneId || "default"}`);
      setKeywords(saved ? JSON.parse(saved) : DEFAULT_KEYWORDS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywords(selectedPhoneId);
  }, [selectedPhoneId]);

  // Sync to API via PUT endpoint
  const syncToApi = async (updatedKeywords: Keyword[]) => {
    if (!selectedPhoneId) return;
    setIsSyncing(true);

    const optInArr = updatedKeywords
      .filter((k) => k.type === "OPT_IN")
      .map((k) => k.keyword.toUpperCase());
    const optOutArr = updatedKeywords
      .filter((k) => k.type === "OPT_OUT")
      .map((k) => k.keyword.toUpperCase());

    const body = {
      opt_in_keywords: optInArr,
      opt_out_keywords: optOutArr,
    };

    try {
      try {
        await soft7AxiosInstance.put(`/admin/contacts/opt-in-out/keywords/${selectedPhoneId}`, body);
      } catch {
        await soft7AxiosInstance.put(`/contacts/opt-in-out/keywords/${selectedPhoneId}`, body);
      }
    } catch (err: any) {
      console.warn("API PUT sync notice:", err?.message);
    } finally {
      setIsSyncing(false);
    }
  };

  /* ------------------------
     ADD KEYWORD
     ------------------------ */
  const addKeyword = (rawKw: string, type: OptType) => {
    const kw = rawKw.trim().toUpperCase();
    if (!kw) return;

    const exists = keywords.some(
      (k) => k.keyword.toUpperCase() === kw && k.type === type
    );

    if (exists) {
      toast.error(`Keyword "${kw}" already exists in ${type === 'OPT_IN' ? 'Opt-In' : 'Opt-Out'}!`);
      return;
    }

    const newKeywordObj: Keyword = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      keyword: kw,
      type: type,
    };

    const nextKeywords = [...keywords, newKeywordObj];
    setKeywords(nextKeywords);
    localStorage.setItem(`soft7_opt_keywords_${selectedPhoneId || "default"}`, JSON.stringify(nextKeywords));
    toast.success(`Keyword "${kw}" added to ${type === 'OPT_IN' ? 'Opt-In' : 'Opt-Out'}`);

    syncToApi(nextKeywords);
  };

  /* ------------------------
     DELETE KEYWORD
     ------------------------ */
  const deleteKeyword = (id: number) => {
    const target = keywords.find((k) => k.id === id);
    const nextKeywords = keywords.filter((k) => k.id !== id);
    setKeywords(nextKeywords);
    localStorage.setItem(`soft7_opt_keywords_${selectedPhoneId || "default"}`, JSON.stringify(nextKeywords));

    if (target) {
      toast.success(`Keyword "${target.keyword.toUpperCase()}" deleted`);
    }

    syncToApi(nextKeywords);
  };

  /* ------------------------
     FILTERING
     ------------------------ */
  const safeArray = Array.isArray(keywords) ? keywords : [];

  const optOutKeywords = useMemo(
    () => safeArray.filter((k) => k?.type === "OPT_OUT"),
    [safeArray]
  );

  const optInKeywords = useMemo(
    () => safeArray.filter((k) => k?.type === "OPT_IN"),
    [safeArray]
  );

  if (isLoading) {
    return (
      <div className="opts-management-container flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading keywords setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="opts-management-container flex flex-col items-center justify-center px-4 sm:px-6 py-8">
      <div className="w-full max-w-5xl mx-auto mb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-card hover:bg-muted rounded-lg border border-border transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        {phoneNumbers.length > 0 && (
          <div className="flex items-center gap-2">
            <Smartphone size={14} className="text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">WhatsApp Number:</span>
            <select
              value={selectedPhoneId}
              onChange={(e) => setSelectedPhoneId(e.target.value)}
              className="bg-card border border-border text-foreground font-semibold rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent cursor-pointer shadow-2xs"
            >
              {phoneNumbers.map((pn) => (
                <option key={pn.id || pn.phone_number_id} value={pn.phone_number_id || pn.id}>
                  {pn.display_phone_number} {pn.verified_name ? `(${pn.verified_name})` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchKeywords(selectedPhoneId)}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Refresh keywords"
            >
              <RefreshCcw size={14} className={isSyncing ? "animate-spin" : ""} />
            </button>
          </div>
        )}
      </div>

      <div className="opts-main-card w-full max-w-5xl mx-auto p-6 sm:p-10 rounded-3xl">
        <div className="pl-1 mb-8 pb-4 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="opts-header-title text-2xl sm:text-3xl font-extrabold flex items-center gap-2 mb-2">
                Messaging Keywords Setup 💬
              </h1>
              <p className="opts-header-description text-xs sm:text-sm text-muted-foreground">
                Configure automated Opt-In and Opt-Out keywords to manage subscriber consent on WhatsApp & SMS.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary/10 text-primary-text border border-primary/20">
              <ShieldCheck size={16} /> Automated Compliance
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <KeywordCard
            type="OPT_OUT"
            title="Opt-Out Keywords"
            description="Users replying with these words will be automatically unsubscribed and opted out of broadcasts."
            keywords={optOutKeywords}
            onDelete={deleteKeyword}
            onAdd={(kw) => addKeyword(kw, "OPT_OUT")}
          />

          <KeywordCard
            type="OPT_IN"
            title="Opt-In Keywords"
            description="Users replying with these words will be automatically resubscribed to receive your messages."
            keywords={optInKeywords}
            onDelete={deleteKeyword}
            onAdd={(kw) => addKeyword(kw, "OPT_IN")}
          />
        </div>
      </div>
    </div>
  );
}