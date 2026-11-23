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
import '../../tags.css';

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
    <div className="tag-modal-overlay">
      <div className={`tag-modal tag-modal-${mode}`}>
        {/* Header */}
        <div className="tag-modal-header">
          <h2 className="tag-modal-title">
            {mode === 'create' ? 'Create Tag' : 'Edit Tag'}
          </h2>
          <button
            onClick={onClose}
            className="tag-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="tag-modal-form">
          {/* Tag Name */}
          <div>
            <label className="tag-form-label">
              Tag Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. VIP, Lead, Customer"
              className="tag-form-input"
              required
            />
          </div>

          {/* Color */}
          <div>
            <label className="tag-form-label">
              Color
            </label>
            <div className="tag-color-row">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`tag-color-swatch ${
                    form.color === c ? 'tag-color-selected' : 'tag-color-unselected'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <div className="tag-custom-color-wrap">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="tag-custom-color"
                  title="Custom color"
                />
                <span className="tag-color-value">{form.color}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="tag-form-label">
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. VIP customers"
              className="tag-form-input"
            />
          </div>

          {/* Footer */}
          <div className="tag-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="tag-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="tag-submit-btn"
            >
              {isSaving && (
                <span className="tag-submit-spinner" />
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

// ─── Delete Confirmation Modal ───────────────────────────────────────────────

interface DeleteTagModalProps {
  tag: ContactTag;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteTagModal({ tag, isDeleting, onClose, onConfirm }: DeleteTagModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl border border-border flex flex-col overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error-bg dark:bg-error-bg/30 flex items-center justify-center">
            <Trash2 size={22} className="text-error dark:text-error" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Delete Tag</h3>
          <p className="text-xs text-muted-foreground mb-6">
            Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{tag.name}&quot;</span>? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition border border-border disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold bg-error hover:bg-error text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageTagsPage() {
  const router = useRouter();

  const [tags, setTags] = useState<ContactTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<ContactTag | null>(null);
  const [tagToDelete, setTagToDelete] = useState<ContactTag | null>(null);
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

  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;
    setDeletingId(tagToDelete.id);
    try {
      console.log('[Tags] Deleting tag:', tagToDelete.id);
      await soft7AxiosInstance.delete(`/admin/contacts/tags/${tagToDelete.id}`);
      toast.success(`Tag "${tagToDelete.name}" deleted successfully!`);
      setTagToDelete(null);
      await fetchTags();
    } catch (err: any) {
      console.error('[Tags] Delete error:', err?.response?.status, err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete tag';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="tags-page">
      <div className="tags-container">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="tags-topbar">
          <div className="tags-back-wrap">
            <button
              onClick={() => router.back()}
              className="tags-back-btn"
            >
              <ArrowLeft size={16} />
              Back to Contacts
            </button>
          </div>

          <button
            id="create-tag-btn"
            onClick={() => setShowCreateModal(true)}
            className="create-tag-btn"
          >
            <Plus size={16} />
            Create Tag
          </button>
        </div>

        {/* Title */}
        <div className="tags-page-header">
          <h1 className="tags-title">
            Manage Tags
          </h1>
          <p className="tags-subtitle">
            Organize your contacts with tags
          </p>
        </div>

        {/* ── Table Card ──────────────────────────────────────────────────── */}
        <div className="tags-table-wrapper">

          {/* Card Header */}
          <div className="tags-card-header">
            <h2 className="tags-card-title">All Tags</h2>
            <p className="tags-card-subtitle">
              {isLoading
                ? 'Loading tags…'
                : `View and manage your contact tags (${tags.length} total)`}
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="tags-state tags-loading-state">
              <div className="tags-state-inner">
                <div className="tag-loading-spinner" />
                <p className="tags-state-text">Loading tags…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="tags-state tags-loading-state">
              <div className="tags-state-inner">
                <div className="tags-error-icon">
                  <X size={22} className="text-error" />
                </div>
                <p className="tags-error-text">{error}</p>
                <button
                  onClick={fetchTags}
                  className="tags-retry-btn"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && tags.length === 0 && (
            <div className="tags-state tags-loading-state">
              <div className="tags-state-inner">
                <div className="tags-empty-icon">
                  <Tag size={24} className="tags-sort-icon" />
                </div>
                <p className="tags-empty-title">No tags yet</p>
                <p className="tags-empty-description">
                  Create your first tag to organize contacts
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="tags-empty-btn"
                >
                  Create Tag
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && tags.length > 0 && (
            <div className="tags-table-scroll">
              <table className="tags-table">
                <thead>
                  <tr className="tags-table-head">
                    <th className="px-6 py-3 text-left">
                      <div className="tags-th-content">
                        Tag Name
                        <ChevronsUpDown size={12} className="tags-sort-icon" />
                      </div>
                    </th>
                    <th className="tags-th">
                      Description
                    </th>
                    <th className="tags-th">
                      Contacts
                    </th>
                    <th className="px-6 py-3 text-left">
                      <div className="tags-th-content">
                        Created
                        <ChevronsUpDown size={12} className="tags-sort-icon" />
                      </div>
                    </th>
                    <th className="tags-th tags-th-actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="tags-table-row"
                    >
                      {/* Tag Name with colour dot */}
                      <td className="tags-td">
                        <div className="tag-name-wrap">
                          <span
                            className="tag-color-dot"
                            style={{ backgroundColor: tag.color || 'var(--neutral-500)' }}
                          />
                          <span className="tag-name-text">
                            {tag.name}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="tags-td tag-description-cell">
                        {tag.description || '—'}
                      </td>

                      {/* Contacts count */}
                      <td className="tags-td">
                        <span className="tag-count-text">
                          {getContactCount(tag)}
                        </span>
                      </td>

                      {/* Created date */}
                      <td className="tags-td tag-date-cell">
                        {formatDate(tag.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="tags-td tags-actions-cell">
                        <div className="tags-actions">
                          {/* Edit */}
                          <button
                            onClick={() => setEditingTag(tag)}
                            className="tag-action-btn tag-edit-btn"
                            title="Edit tag"
                          >
                            <Pencil size={16} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setTagToDelete(tag)}
                            disabled={deletingId === tag.id}
                            className="tag-action-btn tag-delete-btn"
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
            description: editingTag.description || '',
          }}
          isSaving={isSaving}
          onClose={() => setEditingTag(null)}
          onSubmit={handleUpdate}
        />
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      {tagToDelete && (
        <DeleteTagModal
          tag={tagToDelete}
          isDeleting={deletingId === tagToDelete.id}
          onClose={() => setTagToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
