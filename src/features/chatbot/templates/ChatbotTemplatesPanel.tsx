/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, MessageSquare, PencilRuler, Search, Sparkles, Workflow } from "lucide-react";
import toast from "react-hot-toast";
import { Alert, Badge, Button, EmptyState, Input, Modal, Pagination, Spinner } from "@/components/ui";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import {
  chatbotTemplatesApi, templateError,
  type ChatbotTemplate, type ChatbotTemplateCategory, type ChatbotTemplateDetail,
} from "./api";
import TemplateEditorModal, { type EditedGraph, type EditorMode } from "./TemplateEditorModal";

const PAGE_SIZE = 9;
type PreviewMode = EditorMode;

/** Starter chatbot templates: browse, edit the flow in the builder, try a demo, then create a draft from one. */
export default function ChatbotTemplatesPanel() {
  const router = useRouter();
  const [categories, setCategories] = useState<ChatbotTemplateCategory[]>([]);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<ChatbotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  // Preview / demo
  const [previewing, setPreviewing] = useState<ChatbotTemplate | null>(null);
  const [mode, setMode] = useState<PreviewMode>("flow");
  const [detail, setDetail] = useState<ChatbotTemplateDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailFor = useRef("");

  // Use this template
  const [using, setUsing] = useState<ChatbotTemplate | null>(null);
  const [botName, setBotName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [creating, setCreating] = useState(false);
  // Flow edited in the template editor; applied to the new draft after it is created.
  const [editedGraph, setEditedGraph] = useState<EditedGraph>(null);

  useEffect(() => {
    chatbotTemplatesApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Debounce typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    chatbotTemplatesApi.list({ category: category || undefined, search: search || undefined, signal: controller.signal })
      .then(list => { setTemplates(list); setPage(1); })
      .catch(err => { if (!controller.signal.aborted) setError(templateError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, search, reload]);

  const openPreview = useCallback((template: ChatbotTemplate, startMode: PreviewMode) => {
    setPreviewing(template); setMode(startMode); setDetail(null); setDetailError(null);
    detailFor.current = template.id;
    // Ignore a slow response for a template the user has already moved on from.
    chatbotTemplatesApi.get(template.id)
      .then(d => { if (detailFor.current === template.id) setDetail(d); })
      .catch(err => { if (detailFor.current === template.id) setDetailError(templateError(err)); });
  }, []);

  const openUse = (template: ChatbotTemplate, graph: EditedGraph = null) => {
    setPreviewing(null);
    setEditedGraph(graph);
    setUsing(template); setBotName(template.name); setBusinessName(""); setSupportContact("");
  };

  /**
   * Saves the editor's flow onto the new draft, keeping the draft's name and phone numbers. Nodes the
   * user didn't change keep the draft's own copy (with the business name etc. filled in by the server)
   * and only take the new position.
   */
  const applyEditedFlow = async (chatbotId: string, graph: NonNullable<EditedGraph>) => {
    const res = await soft7AxiosInstance.get(`/admin/chatbot/${encodeURIComponent(chatbotId)}`);
    const bot = res.data?.data ?? {};
    const phoneNumberIds = Array.isArray(bot.phoneNumberIds) ? bot.phoneNumberIds : bot.phoneNumberId ? [bot.phoneNumberId] : [];
    const draftNodes = new Map<string, any>((Array.isArray(bot.nodes) ? bot.nodes : []).map((n: any) => [String(n.id), n]));
    const changed = new Set(graph.changedNodeIds);
    const nodes = graph.nodes.map((node: any) => {
      const draft = draftNodes.get(String(node.id));
      return draft && !changed.has(String(node.id)) ? { ...draft, position: node.position } : node;
    });
    const saved = await soft7AxiosInstance.post(`/admin/chatbot/flow/${encodeURIComponent(chatbotId)}`, {
      name: bot.name ?? botName.trim(),
      phoneNumberIds,
      nodes,
      edges: graph.edges,
    });
    if (saved.data?.success === false) throw new Error(saved.data?.message || "Failed to save the edited flow.");
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!using || !businessName.trim() || creating) return;
    setCreating(true);
    try {
      const { id } = await chatbotTemplatesApi.use(using.id, {
        ...(botName.trim() ? { name: botName.trim() } : {}),
        customizations: {
          business_name: businessName.trim(),
          ...(supportContact.trim() ? { support_contact: supportContact.trim() } : {}),
        },
      });
      if (editedGraph) {
        try {
          await applyEditedFlow(id, editedGraph);
        } catch (err) {
          // The draft exists either way; the user can redo the edits in the builder.
          toast.error(`Draft created, but the edited flow couldn't be applied: ${templateError(err)}`);
        }
      }
      toast.success("Chatbot draft created. Edit, save and publish it in the builder.");
      router.push(`/user/chatbot/${encodeURIComponent(id)}/builder`);
    } catch (err) {
      toast.error(templateError(err));
      setCreating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(templates.length / PAGE_SIZE));
  const visible = useMemo(() => templates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [templates, page]);
  const allCount = categories.reduce((n, c) => n + c.template_count, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Template categories">
          {[{ id: "", name: "All", template_count: allCount }, ...categories].map(c => {
            const active = category === c.id;
            return (
              <button key={c.id || "all"} type="button" role="tab" aria-selected={active} onClick={() => setCategory(c.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary hover:text-primary-text"}`}>
                {c.name}
                {c.template_count > 0 && (
                  <span className={`rounded-full px-1.5 text-xs ${active ? "bg-primary-foreground/25" : "bg-surface-muted"}`}>{c.template_count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="w-full md:w-72">
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates" leftIcon={<Search size={16} />} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Starter chatbot flows for WhatsApp. These aren&apos;t Meta-approved message templates; you can edit everything after creating a draft.
      </p>

      {error && <Alert variant="error" message={<div className="flex flex-wrap items-center gap-3"><span>{error}</span><Button size="sm" variant="outline" onClick={() => setReload(n => n + 1)}>Retry</Button></div>} />}
      {loading && !templates.length && <div className="flex justify-center py-16"><Spinner size="lg" label="Loading templates" /></div>}
      {!loading && !error && !templates.length && (
        <EmptyState icon={<LayoutTemplate size={28} />} title="No templates found"
          description={search ? "Try a different search or category." : "No templates are available in this category yet."} />
      )}

      {visible.length > 0 && (
        <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
          {visible.map(t => (
            <article key={t.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-text"><Workflow size={20} /></span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {t.badge && <Badge size="sm" variant="success">{t.badge}</Badge>}
                  {t.category_name && <Badge size="sm" variant="neutral">{t.category_name}</Badge>}
                </div>
              </div>
              <h3 className="text-base font-semibold text-foreground">{t.name}</h3>
              {t.description && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>}
              {t.highlights.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-foreground">
                  {t.highlights.slice(0, 3).map(h => <li key={h} className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-primary-text" />{h}</li>)}
                </ul>
              )}
              {t.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.tags.slice(0, 4).map(tag => <span key={tag} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">#{tag}</span>)}
                </div>
              )}
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                <Button variant="outline" size="sm" leftIcon={<PencilRuler size={14} />} onClick={() => openPreview(t, "flow")}>Preview &amp; edit</Button>
                <Button variant="outline" size="sm" leftIcon={<MessageSquare size={14} />} onClick={() => openPreview(t, "demo")}>Demo</Button>
                <Button className="col-span-2" size="sm" onClick={() => openUse(t)}>Use this template</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={templates.length} itemsPerPage={PAGE_SIZE} showInfo />
      )}

      {/* Preview & edit: the real flow builder, or a demo conversation */}
      {previewing && (
        <TemplateEditorModal
          key={previewing.id}
          template={previewing}
          detail={detail}
          detailError={detailError}
          mode={mode}
          onModeChange={setMode}
          onClose={() => setPreviewing(null)}
          onUse={graph => openUse(previewing, graph)}
        />
      )}

      {/* Use this template */}
      <Modal isOpen={!!using} onClose={() => { if (!creating) setUsing(null); }} title={`Use “${using?.name ?? "template"}”`}
        description="Creates a private draft chatbot with the flow from the editor. You can keep editing, then save and publish it. Each draft uses one Chatbot slot on your plan."
        footer={<div className="flex justify-end gap-2">
          <Button variant="outline" disabled={creating} onClick={() => setUsing(null)}>Cancel</Button>
          <Button type="submit" form="use-chatbot-template" isLoading={creating} disabled={!businessName.trim()}>Create draft chatbot</Button>
        </div>}>
        <form id="use-chatbot-template" onSubmit={create} className="space-y-4">
          <Input label="Chatbot name" value={botName} onChange={e => setBotName(e.target.value)} placeholder="My IT Helpdesk" maxLength={100} />
          <Input label="Business name" required value={businessName} onChange={e => setBusinessName(e.target.value)}
            placeholder="Example IT Services" maxLength={100} helperText="Shown to customers in the bot's messages." />
          <Input label="Support contact (optional)" value={supportContact} onChange={e => setSupportContact(e.target.value)}
            placeholder="support@example.com or +91 98765 43210" maxLength={120} />
        </form>
      </Modal>
    </div>
  );
}
