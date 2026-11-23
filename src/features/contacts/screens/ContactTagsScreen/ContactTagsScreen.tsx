/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronsUpDown,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { soft7AxiosInstance } from "@/lib/axiosInstance";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactTag {
  id: string | number;
  name: string;
  color: string;
  description?: string | null;
  contact_count?: number;
  contacts_count?: number;
  created_at?: string;
}

interface TagFormData {
  name: string;
  color: string;
  description: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface TagModalProps {
  mode: 'create' | 'edit';
  initialData?: TagFormData;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: TagFormData) => void;
}

// User-selectable tag colors: stored per tag as data, intentionally not theme tokens.
/* eslint-disable no-restricted-syntax -- data palette */
const PRESET_COLORS = [
  '#FF5733', '#FF8C00', '#FFC300', '#28B463', '#1ABC9C',
  '#3498DB', '#8E44AD', '#E91E63', '#00BCD4', '#607D8B',
];
const DEFAULT_TAG_COLOR = PRESET_COLORS[0];
/* eslint-enable no-restricted-syntax */

function TagModal({ mode, initialData, isSaving, onClose, onSubmit }: TagModalProps) {
  const [form, setForm] = useState<TagFormData>(
    initialData ?? { name: '', color: DEFAULT_TAG_COLOR, description: '' }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {mode === 'create' ? 'Create Tag' : 'Edit Tag'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tag Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tag Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. VIP, Lead, Customer"
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-card text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground focus:ring-2 focus:ring-[var(--color-primary)] focus:border-info transition text-sm"
              required
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Color
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    form.color === c
                      ? 'border-foreground scale-110 shadow-md'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <div className="relative flex items-center gap-2 ml-1">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-border p-0.5"
                  title="Custom color"
                />
                <span className="text-xs text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. VIP customers"
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-card text-foreground placeholder-muted-foreground dark:placeholder-muted-foreground focus:ring-2 focus:ring-[var(--color-primary)] focus:border-info transition text-sm"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-primary-foreground text-sm font-medium transition disabled:opacity-60 flex items-center gap-2"
            >
              {isSaving && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string) {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

function getContactCount(tag: ContactTag): number {
  return tag.contact_count ?? tag.contacts_count ?? 0;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageTagsPage() {
  const router = useRouter();

  const [tags, setTags] = useState<ContactTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<ContactTag | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // NOTE: console.logs from 'use client' pages appear in the BROWSER console (F12), NOT the terminal
      console.log('[Tags] Fetching tags... base URL:', (soft7AxiosInstance.defaults.baseURL));
      const res = await soft7AxiosInstance.get('/admin/contacts/tags');
      console.log('[Tags] Response:', res.data);

      const data = res.data;

      let list: ContactTag[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data?.tags && Array.isArray(data.tags)) {
        list = data.tags;
      }

      console.log('[Tags] Loaded', list.length, 'tags');
      setTags(list);
    } catch (err: any) {
      console.error('[Tags] Fetch error:', err?.response?.status, err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Failed to load tags';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('[Tags] useEffect triggered — open browser DevTools (F12 → Console) to see logs');
    fetchTags();
  }, []);

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async (data: TagFormData) => {
    setIsSaving(true);
    try {
      console.log('[Tags] Creating tag:', data);
      await soft7AxiosInstance.post('/admin/contacts/tags', {
        name: data.name,
        color: data.color,
        description: data.description || undefined,
      });
      toast.success(`Tag "${data.name}" created successfully!`);
      setShowCreateModal(false);
      await fetchTags();
    } catch (err: any) {
      console.error('[Tags] Create error:', err?.response?.status, err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Failed to create tag';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Update ─────────────────────────────────────────────────────────────────

  const handleUpdate = async (data: TagFormData) => {
    if (!editingTag) return;
    setIsSaving(true);
    try {
      console.log('[Tags] Updating tag:', editingTag.id, data);
      await soft7AxiosInstance.put(`/admin/contacts/tags/${editingTag.id}`, {
        name: data.name,
        color: data.color,
        ...(data.description ? { description: data.description } : {}),
      });
      toast.success(`Tag "${data.name}" updated successfully!`);
      setEditingTag(null);
      await fetchTags();
    } catch (err: any) {
      console.error('[Tags] Update error:', err?.response?.status, err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Failed to update tag';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = (tag: ContactTag) => {
    toast((t) => (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Trash2 className="text-error" size={18} />
          <p className="text-sm font-medium text-foreground">
            Delete "{tag.name}"?
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted rounded transition"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              setDeletingId(tag.id);
              try {
                console.log('[Tags] Deleting tag:', tag.id);
                await soft7AxiosInstance.delete(`/admin/contacts/tags/${tag.id}`);
                toast.success(`Tag "${tag.name}" deleted`);
                await fetchTags();
              } catch (err: any) {
                console.error('[Tags] Delete error:', err?.response?.status, err?.message);
                const msg = err?.response?.data?.message || err?.message || 'Failed to delete tag';
                toast.error(msg);
              } finally {
                setDeletingId(null);
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-white bg-error hover:bg-error rounded transition"
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background dark:bg-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground transition font-medium"
            >
              <ArrowLeft size={16} />
              Back to Contacts
            </button>
          </div>

          <button
            id="create-tag-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-semibold transition shadow-md shadow-primary/20"
          >
            <Plus size={16} />
            Create Tag
          </button>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
            Manage Tags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your contacts with tags
          </p>
        </div>

        {/* ── Table Card ──────────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-border-subtle dark:border-border">
            <h2 className="text-base font-bold text-foreground">All Tags</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading
                ? "Loading tags…"
                : `View and manage your contact tags (${tags.length} total)`}
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center h-52">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-info mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading tags…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex items-center justify-center h-52">
              <div className="text-center px-4">
                <div className="w-12 h-12 rounded-full bg-error-bg dark:bg-error-bg/20 flex items-center justify-center mx-auto mb-3">
                  <X size={22} className="text-error" />
                </div>
                <p className="text-error dark:text-error text-sm font-medium mb-1">
                  {error}
                </p>
                <button
                  onClick={fetchTags}
                  className="mt-3 px-4 py-2 bg-[var(--color-primary)] text-primary-foreground text-sm rounded-lg hover:bg-[var(--color-primary-hover)] transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && tags.length === 0 && (
            <div className="flex items-center justify-center h-52">
              <div className="text-center px-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Tag size={24} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">No tags yet</p>
                <p className="text-muted-foreground text-sm mt-1 mb-4">
                  Create your first tag to organize contacts
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90 transition shadow-md"
                >
                  Create Tag
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && tags.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-subtle dark:divide-border">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-6 py-3 text-left">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Tag Name
                        <ChevronsUpDown size={12} className="text-muted-foreground" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Contacts
                    </th>
                    <th className="px-6 py-3 text-left">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Created
                        <ChevronsUpDown size={12} className="text-muted-foreground" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle dark:divide-border bg-card">
                  {tags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      {/* Tag Name with colour dot */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || "var(--neutral-500)" }}
                          />
                          <span className="font-semibold text-sm text-foreground">
                            {tag.name}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {tag.description || "—"}
                      </td>

                      {/* Contacts count */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-foreground font-medium">
                          {getContactCount(tag)}
                        </span>
                      </td>

                      {/* Created date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(tag.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit */}
                          <button
                            onClick={() => setEditingTag(tag)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-[var(--color-primary)] hover:bg-info-bg dark:hover:bg-info-bg/20 dark:hover:text-info transition"
                            title="Edit tag"
                          >
                            <Pencil size={16} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(tag)}
                            disabled={deletingId === tag.id}
                            className="p-2 rounded-lg text-muted-foreground hover:text-error hover:bg-error-bg dark:hover:bg-error-bg/20 dark:hover:text-error transition disabled:opacity-50"
                            title="Delete tag"
                          >
                            {deletingId === tag.id ? (
                              <span className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin block" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Modal ───────────────────────────────────────────────────── */}
      {showCreateModal && (
        <TagModal
          mode="create"
          isSaving={isSaving}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editingTag && (
        <TagModal
          mode="edit"
          initialData={{
            name: editingTag.name,
            color: editingTag.color,
            description: editingTag.description || "",
          }}
          isSaving={isSaving}
          onClose={() => setEditingTag(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  );
}