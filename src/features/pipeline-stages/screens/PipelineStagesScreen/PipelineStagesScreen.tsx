/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  Search,
  Pencil,
  ArrowLeft,
  Loader2,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  bg_color: string;
  border_color: string;
  header_bg: string;
  position: number;
}

const UI = {
  pageBg: "var(--color-background)",
  cardBg: "var(--color-surface)",
  headerBg: "var(--color-surface-hover)",
  border: "var(--color-border)",
  rowBorder: "var(--color-border-subtle)",
  text: "var(--color-text)",
  muted: "var(--color-text-muted)",
  icon: "var(--color-text-muted)",
  primary: "var(--color-primary)",
  primaryHover: "var(--color-primary-hover)",
};

// Stage color options are user-selectable data stored per stage, not theme colors.
/* eslint-disable no-restricted-syntax -- data palette */
const STAGE_THEMES = [
  { id: "blue", label: "Blue", color: "#3B82F6" },
  { id: "purple", label: "Purple", color: "#A855F7" },
  { id: "amber", label: "Amber", color: "#F59E0B" },
  { id: "indigo", label: "Indigo", color: "#6366F1" },
  { id: "orange", label: "Orange", color: "#F97316" },
  { id: "green", label: "Green", color: "var(--color-primary)" },
  { id: "red", label: "Red", color: "#EF4444" },
];

// Stage color classes are persisted on each stage and parsed back by name (getThemeFromStage) — data, not theme.
/* eslint-disable no-restricted-syntax -- categorical data palette */
const THEME_COLORS: Record<string, Omit<PipelineStage, "id" | "name" | "position">> = {
  blue: {
    color: "text-[var(--color-primary)]",
    bg_color: "bg-blue-50 dark:bg-blue-950/20",
    border_color: "border-blue-200 dark:border-blue-800",
    header_bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  purple: {
    color: "text-purple-600",
    bg_color: "bg-purple-50 dark:bg-purple-950/20",
    border_color: "border-purple-200 dark:border-purple-800",
    header_bg: "bg-purple-50 dark:bg-purple-950/40",
  },
  amber: {
    color: "text-amber-600",
    bg_color: "bg-amber-50 dark:bg-amber-950/20",
    border_color: "border-amber-200 dark:border-amber-800",
    header_bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  indigo: {
    color: "text-[var(--color-primary)]",
    bg_color: "bg-indigo-50 dark:bg-indigo-950/20",
    border_color: "border-indigo-200 dark:border-indigo-800",
    header_bg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  orange: {
    color: "text-orange-600",
    bg_color: "bg-orange-50 dark:bg-orange-950/20",
    border_color: "border-orange-200 dark:border-orange-800",
    header_bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  green: {
    color: "text-green-600",
    bg_color: "bg-[var(--color-success-light)] dark:bg-green-950/20",
    border_color: "border-green-200 dark:border-green-800",
    header_bg: "bg-[var(--color-success-light)] dark:bg-green-950/40",
  },
  red: {
    color: "text-red-600",
    bg_color: "bg-red-50 dark:bg-red-950/20",
    border_color: "border-red-200 dark:border-red-800",
    header_bg: "bg-red-50 dark:bg-red-950/40",
  },
};
/* eslint-enable no-restricted-syntax */

function getThemeFromStage(stage: PipelineStage) {
  if (stage.color?.includes("blue")) return "blue";
  if (stage.color?.includes("purple")) return "purple";
  if (stage.color?.includes("amber")) return "amber";
  if (stage.color?.includes("indigo")) return "indigo";
  if (stage.color?.includes("orange")) return "orange";
  if (stage.color?.includes("green")) return "green";
  if (stage.color?.includes("red")) return "red";
  return "blue";
}

/* -------------------------------------------------------------------------- */
/* Modal primitives                                                            */
/* -------------------------------------------------------------------------- */

function StageModal({
  title,
  children,
  maxWidth = 416,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="stage-modal-overlay"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="stage-modal-card"
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="stage-modal-header">
          <h2 className="stage-modal-title">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="stage-modal-close"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}

function StageFormInput({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      required
      className="stage-form-input"
    />
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="stage-color-row">
      {STAGE_THEMES.map((theme) => {
        const selected = value === theme.id;

        return (
          <button
            key={theme.id}
            type="button"
            title={theme.label}
            aria-label={`Select ${theme.label} theme`}
            aria-pressed={selected}
            onClick={() => onChange(theme.id)}
            className={`stage-color-swatch ${
              selected ? "stage-color-selected" : ""
            }`}
            style={{ backgroundColor: theme.color }}
          />
        );
      })}
    </div>
  );
}

function AddStageModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, theme: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("blue");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Stage name is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(name.trim(), theme);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <StageModal title="Add New Stage" onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSave} className="stage-modal-form">
        <div>
          <label htmlFor="add-stage-name" className="stage-form-label">
            Stage Name <span className="text-error">*</span>
          </label>

          <StageFormInput
            id="add-stage-name"
            value={name}
            onChange={setName}
            placeholder="e.g. Follow Up"
            autoFocus
          />
        </div>

        <div>
          <label className="stage-form-label">Color Theme</label>
          <ThemePicker value={theme} onChange={setTheme} />
        </div>

        <div className="stage-modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="stage-cancel-btn"
          >
            Cancel
          </button>

          <button type="submit" disabled={saving} className="stage-submit-btn">
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              "Add Stage"
            )}
          </button>
        </div>
      </form>
    </StageModal>
  );
}

function EditStageModal({
  stage,
  onClose,
  onSave,
}: {
  stage: PipelineStage;
  onClose: () => void;
  onSave: (stageId: string, name: string, theme: string) => Promise<void>;
}) {
  const [name, setName] = useState(stage.name);
  const [theme, setTheme] = useState(getThemeFromStage(stage));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Stage name is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(stage.id, name.trim(), theme);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <StageModal title="Edit Stage" onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSave} className="stage-modal-form">
        <div>
          <label htmlFor="edit-stage-name" className="stage-form-label">
            Stage Name <span className="text-error">*</span>
          </label>

          <StageFormInput
            id="edit-stage-name"
            value={name}
            onChange={setName}
            placeholder="Enter stage name"
            autoFocus
          />
        </div>

        <div>
          <label className="stage-form-label">Color Theme</label>
          <ThemePicker value={theme} onChange={setTheme} />
        </div>

        <div className="stage-modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="stage-cancel-btn"
          >
            Cancel
          </button>

          <button type="submit" disabled={saving} className="stage-submit-btn">
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </StageModal>
  );
}

function DeleteStageConfirmModal({
  stage,
  onConfirm,
  onClose,
}: {
  stage: PipelineStage;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <StageModal title="Delete Stage" maxWidth={416} onClose={deleting ? () => {} : onClose}>
      <div className="stage-delete-content">
        <div className="stage-delete-icon">
          <Trash2 size={22} />
        </div>

        <p className="stage-delete-title">Delete Stage "{stage.name}"?</p>

        <p className="stage-delete-description">
          Contacts in this stage will not be deleted, but they won't appear on
          the board until moved to another stage.
        </p>

        <div className="stage-modal-footer stage-delete-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="stage-cancel-btn"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="stage-delete-btn"
          >
            {deleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Stage"
            )}
          </button>
        </div>
      </div>
    </StageModal>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ManageStages() {
  const router = useRouter();

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [deletingStage, setDeletingStage] = useState<PipelineStage | null>(null);

  async function fetchStages() {
    setIsLoading(true);

    try {
      const res = await soft7AxiosInstance.get("/admin/pipeline");
      const data: PipelineStage[] = Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      setStages(
        [...data].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      );
    } catch (error) {
      console.error("Failed to fetch stages:", error);
      toast.error("Failed to load stages");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStages();
  }, []);

  const handleAddStage = async (name: string, theme: string) => {
    const colors = THEME_COLORS[theme] || THEME_COLORS.blue;
    const maxPosition = stages.reduce(
      (max, stage) => Math.max(max, stage.position ?? -1),
      -1
    );

    try {
      const response = await soft7AxiosInstance.post("/admin/pipeline", {
        name,
        ...colors,
        position: maxPosition + 1,
      });

      if (response.data?.success) {
        toast.success("Stage added successfully");
        await fetchStages();
      } else {
        toast.success("Stage added successfully");
        await fetchStages();
      }
    } catch (error) {
      console.error("Failed to add stage:", error);
      toast.error("Failed to add stage");
      throw error;
    }
  };

  const handleEditStage = async (
    stageId: string,
    name: string,
    theme: string
  ) => {
    const colors = THEME_COLORS[theme] || THEME_COLORS.blue;

    try {
      const response = await soft7AxiosInstance.put(
        `/admin/pipeline/${stageId}`,
        {
          name,
          ...colors,
        }
      );

      if (response.data?.success) {
        toast.success("Stage updated successfully");
        await fetchStages();
      } else {
        toast.success("Stage updated successfully");
        await fetchStages();
      }
    } catch (error) {
      console.error("Failed to update stage:", error);
      toast.error("Failed to update stage");
      throw error;
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    try {
      const response = await soft7AxiosInstance.delete(
        `/admin/pipeline/${stageId}`
      );

      if (response.data?.success) {
        toast.success("Stage deleted successfully");
      } else {
        toast.success("Stage deleted successfully");
      }

      await fetchStages();
    } catch (error) {
      console.error("Failed to delete stage:", error);
      toast.error("Failed to delete stage");
      throw error;
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const list = [...stages];

    const tempPosition = list[index].position;
    list[index].position = list[targetIndex].position;
    list[targetIndex].position = tempPosition;

    const tempItem = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = tempItem;

    setStages(list);

    try {
      await Promise.all([
        soft7AxiosInstance.put(
          `/admin/pipeline-stages/${list[index].id}`,
          { position: list[index].position }
        ),
        soft7AxiosInstance.put(
          `/admin/pipeline-stages/${list[targetIndex].id}`,
          { position: list[targetIndex].position }
        ),
      ]);

      toast.success("Stage order updated");
    } catch (error) {
      console.error("Failed to update stage position:", error);
      toast.error("Failed to save stage order");
      await fetchStages();
    }
  };

  const filteredStages = stages.filter((stage) =>
    stage.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="stages-page">
      <div className="stages-container">
        {/* Top row — same proportions as the Tags page */}
        <div className="stages-topbar">
          <button
            type="button"
            onClick={() => router.back()}
            className="stages-back-btn"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="create-stage-btn"
          >
            <Plus size={16} />
            Add New Stage
          </button>
        </div>

        {/* Page title */}
        <div className="stages-page-header">
          <h1 className="stages-title">Pipeline Stages</h1>
          <p className="stages-subtitle">
            Configure column stages, color themes, and display ordering for
            your Sales Pipeline kanban board.
          </p>
        </div>

        {/* Search — kept functional, but styled like the Tags page */}
        <div className="stages-search-wrap">
          <div className="stages-search">
            <Search size={17} className="stages-search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stage by name..."
              aria-label="Search stage by name"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="stages-search-clear"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Main card */}
        <div className="stages-table-wrapper">
          {isLoading ? (
            <div className="stages-state">
              <div className="stages-state-inner">
                <div className="stages-loading-spinner" />
                <p>Loading stages…</p>
              </div>
            </div>
          ) : filteredStages.length === 0 ? (
            <div className="stages-state">
              <div className="stages-state-inner">
                <div className="stages-empty-icon">
                  <Search size={22} />
                </div>
                <p className="stages-empty-title">
                  {search ? "No stages found" : "No stages yet"}
                </p>
                <p className="stages-empty-description">
                  {search
                    ? `No stage matches "${search}".`
                    : "Create your first pipeline stage to get started."}
                </p>
                {!search && (
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="stages-empty-btn"
                  >
                    Add New Stage
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="stages-table-scroll">
              <table className="stages-table">
                <thead>
                  <tr>
                    <th>Stage Name</th>
                    <th className="stage-preview-th">Color Badge Preview</th>
                    <th className="stage-order-th">Ordering</th>
                    <th className="stage-actions-th">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStages.map((stage, idx) => (
                    <tr key={stage.id} className="stages-table-row">
                      <td className="stages-td">
                        <div className="stage-name-wrap stage-name-wrap-centered">
                          <span
                            className="stage-color-dot"
                            style={{
                              backgroundColor:
                                STAGE_THEMES.find(
                                  (item) =>
                                    item.id === getThemeFromStage(stage)
                                )?.color || "var(--color-text-muted)",
                            }}
                          />
                          <span className="stage-name-text">
                            {stage.name}
                          </span>
                        </div>
                      </td>

                      <td className="stages-td stage-preview-cell">
                        <span
                          className={`stage-badge ${stage.bg_color} ${stage.color} ${stage.border_color}`}
                        >
                          {stage.name}
                        </span>
                      </td>

                      <td className="stages-td stage-order-cell">
                        <div className="stage-order-actions">
                          <button
                            type="button"
                            onClick={() => handleMove(stages.indexOf(stage), "up")}
                            disabled={stages.indexOf(stage) === 0}
                            className="stage-order-btn"
                            title="Move Up"
                            aria-label={`Move ${stage.name} up`}
                          >
                            <ArrowUp size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMove(stages.indexOf(stage), "down")}
                            disabled={stages.indexOf(stage) === stages.length - 1}
                            className="stage-order-btn"
                            title="Move Down"
                            aria-label={`Move ${stage.name} down`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>

                      <td className="stages-td stage-actions-cell">
                        <div className="stage-actions">
                          <button
                            type="button"
                            onClick={() => setEditingStage(stage)}
                            className="stage-action-btn stage-edit-btn"
                            title="Edit Stage"
                            aria-label={`Edit ${stage.name}`}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingStage(stage)}
                            className="stage-action-btn stage-delete-action-btn"
                            title="Delete Stage"
                            aria-label={`Delete ${stage.name}`}
                          >
                            <Trash2 size={16} />
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

      {showAddModal && (
        <AddStageModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddStage}
        />
      )}

      {editingStage && (
        <EditStageModal
          stage={editingStage}
          onClose={() => setEditingStage(null)}
          onSave={handleEditStage}
        />
      )}

      {deletingStage && (
        <DeleteStageConfirmModal
          stage={deletingStage}
          onClose={() => setDeletingStage(null)}
          onConfirm={() => handleDeleteStage(deletingStage.id)}
        />
      )}

      <style jsx global>{`
        /* ================================================================
           STAGES PAGE
           Uses the central design tokens (surfaces, borders, brand actions).
           ================================================================ */

        .stages-page {
          min-height: 100vh;
          width: 100%;
          padding: 24px 32px 48px;
          background: var(--color-surface) !important;
          color: var(--color-text) !important;
          box-sizing: border-box;
        }

        .stages-page *,
        .stages-page *::before,
        .stages-page *::after {
          box-sizing: border-box;
        }

        .stages-container {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
        }

        .stages-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 40px;
          margin-bottom: 20px;
        }

        .stages-back-btn {
          appearance: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0;
          margin: 0;
          border: 0;
          outline: 0;
          background: transparent !important;
          color: var(--color-text-muted) !important;
          font: inherit;
          font-size: 13px;
          line-height: 20px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.18s ease;
        }

        .stages-back-btn:hover {
          color: var(--color-text) !important;
        }

        .create-stage-btn {
          appearance: none;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          height: 40px !important;
          padding: 0 17px !important;
          margin: 0;
          border: 0 !important;
          border-radius: 9px !important;
          outline: 0;
          background: var(--color-primary) !important;
          color: var(--color-primary-foreground) !important;
          font: inherit;
          font-size: 13px !important;
          line-height: 1;
          font-weight: 700 !important;
          box-shadow: 0 4px 10px rgba(var(--color-primary-rgb), 0.18) !important;
          cursor: pointer !important;
          transition:
            background-color 0.18s ease,
            transform 0.18s ease,
            box-shadow 0.18s ease !important;
        }

        .create-stage-btn:hover {
          background: var(--color-primary) !important;
          color: var(--color-primary-foreground) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 14px rgba(var(--color-primary-rgb), 0.24) !important;
        }

        .stages-page-header {
          margin: 0 0 20px;
        }

        .stages-title {
          display: block;
          margin: 0 !important;
          padding: 0;
          color: var(--color-text) !important;
          font-size: 28px !important;
          line-height: 35px;
          font-weight: 800 !important;
          letter-spacing: -0.025em;
        }

        .stages-subtitle {
          margin: 4px 0 0 !important;
          color: var(--color-text-secondary) !important;
          font-size: 13px !important;
          line-height: 20px;
          font-weight: 400;
        }

        .stages-search-wrap {
          width: 100%;
          margin: 0 0 20px;
        }

        .stages-search {
          position: relative;
          width: 100%;
          max-width: 360px;
        }

        .stages-search input {
          width: 100%;
          height: 40px;
          padding: 0 38px 0 38px;
          border: 1px solid var(--color-border) !important;
          border-radius: 9px !important;
          outline: none !important;
          background: var(--color-surface) !important;
          color: var(--color-text) !important;
          font: inherit;
          font-size: 12px !important;
          box-shadow: none !important;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .stages-search input::placeholder {
          color: var(--color-text-muted) !important;
        }

        .stages-search input:focus {
          border-color: var(--color-border-strong) !important;
          box-shadow: 0 0 0 3px var(--color-primary-ring) !important;
        }

        .stages-search-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
          z-index: 1;
        }

        .stages-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          width: 25px;
          height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transform: translateY(-50%);
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
        }

        .stages-search-clear:hover {
          background: var(--color-surface-hover);
          color: var(--color-text);
        }

        .stages-table-wrapper {
          width: 100%;
          overflow: hidden;
          background: var(--color-surface-muted) !important;
          border: 1px solid var(--color-border) !important;
          border-radius: 14px !important;
          box-shadow: var(--elevation-md) !important;
        }

        .stages-card-header {
          min-height: 67px;
          padding: 15px 20px !important;
          background: var(--color-surface-muted) !important;
          border-bottom: 1px solid var(--color-border) !important;
        }

        .stages-card-title {
          margin: 0 !important;
          color: var(--color-text) !important;
          font-size: 14px !important;
          line-height: 20px;
          font-weight: 700 !important;
        }

        .stages-card-subtitle {
          margin: 3px 0 0 !important;
          color: var(--color-text-secondary) !important;
          font-size: 11px !important;
          line-height: 16px;
        }

        .stages-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .stages-table {
          width: 100%;
          min-width: 760px;
          table-layout: fixed;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          background: var(--color-surface-muted) !important;
          color: var(--color-text) !important;
        }

        .stages-table thead {
          display: table-header-group !important;
        }

        .stages-table tbody {
          display: table-row-group !important;
          background: var(--color-surface-muted) !important;
        }

        .stages-table tr {
          display: table-row !important;
        }

        .stages-table th,
        .stages-table td {
          display: table-cell !important;
          vertical-align: middle !important;
        }

        .stages-table thead tr {
          background: var(--color-surface-active) !important;
        }

        .stages-table thead th {
          height: 38px;
          padding: 0 12px !important;
          background: var(--color-surface-active) !important;
          color: var(--color-text) !important;
          border: 0 !important;
          border-bottom: 1px solid var(--color-border) !important;
          text-align: center !important;
          vertical-align: middle !important;
          font: inherit;
          font-size: 10px !important;
          line-height: 14px;
          font-weight: 700 !important;
          letter-spacing: 0.055em !important;
          text-transform: uppercase !important;
          white-space: nowrap;
        }

        .stages-table th:nth-child(1),
        .stages-table td:nth-child(1) {
          width: 30%;
        }

        .stages-table th:nth-child(2),
        .stages-table td:nth-child(2) {
          width: 30%;
        }

        .stages-table th:nth-child(3),
        .stages-table td:nth-child(3) {
          width: 20%;
        }

        .stages-table th:nth-child(4),
        .stages-table td:nth-child(4) {
          width: 20%;
        }

        .stage-preview-th,
        .stage-preview-cell,
        .stage-order-th,
        .stage-order-cell {
          text-align: center !important;
        }

        .stage-actions-th,
        .stage-actions-cell {
          text-align: center !important;
        }

        .stages-table tbody tr,
        .stages-table-row {
          background: var(--color-surface-muted) !important;
          transition: none !important;
          animation: none !important;
          transform: none !important;
        }

        /* Same behavior as the Tags page: NO hover background. */
        .stages-table tbody tr:hover,
        .stages-table-row:hover,
        .stages-table tbody tr:focus,
        .stages-table-row:focus,
        .stages-table tbody tr:focus-within,
        .stages-table-row:focus-within {
          background: var(--color-surface-muted) !important;
          transition: none !important;
          transform: none !important;
        }

        .stages-table tbody tr::before,
        .stages-table tbody tr::after {
          content: none !important;
          display: none !important;
        }

        .stages-td {
          padding: 13px 12px !important;
          background: var(--color-surface-muted) !important;
          color: var(--color-text) !important;
          border: 0 !important;
          border-bottom: 1px solid var(--color-border) !important;
          font: inherit;
          font-size: 12px !important;
          line-height: 18px;
          vertical-align: middle !important;
        }

        .stages-table tbody tr:last-child .stages-td {
          border-bottom: 0 !important;
        }

        .stage-name-wrap {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .stage-name-wrap-centered {
          justify-content: center !important;
        }

        .stage-color-dot {
          width: 11px !important;
          height: 11px !important;
          min-width: 11px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .stage-name-text {
          color: var(--color-text) !important;
          font-size: 12px !important;
          line-height: 18px;
          font-weight: 600 !important;
        }

        .stage-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 25px;
          padding: 3px 11px;
          border-width: 1px;
          border-style: solid;
          border-radius: 999px;
          font-size: 11px;
          line-height: 16px;
          font-weight: 700;
        }

        .stage-order-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .stage-order-btn {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 !important;
          border: 1px solid transparent !important;
          border-radius: 7px !important;
          background: transparent !important;
          color: var(--color-text-muted) !important;
          cursor: pointer;
          transition:
            color 0.18s ease,
            background-color 0.18s ease,
            border-color 0.18s ease;
        }

        .stage-order-btn:hover:not(:disabled) {
          color: var(--color-text) !important;
          background: var(--color-surface-hover) !important;
          border-color: var(--color-border) !important;
        }

        .stage-order-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .stage-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .stage-action-btn {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 !important;
          border: 1px solid transparent !important;
          border-radius: 7px !important;
          outline: 0;
          background: transparent !important;
          color: var(--color-text-muted) !important;
          cursor: pointer;
          transition:
            color 0.18s ease,
            background-color 0.18s ease,
            border-color 0.18s ease;
        }

        .stage-edit-btn:hover {
          color: var(--color-info) !important;
          background: var(--color-info-bg) !important;
          border-color: var(--color-info-border) !important;
        }

        .stage-delete-action-btn:hover {
          color: var(--color-error) !important;
          background: var(--color-error-bg) !important;
          border-color: var(--color-error-border) !important;
        }

        .stages-state {
          min-height: 210px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface-muted) !important;
        }

        .stages-state-inner {
          text-align: center;
          padding: 24px;
        }

        .stages-state-inner p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 12px;
        }

        .stages-loading-spinner {
          width: 34px;
          height: 34px;
          margin: 0 auto 12px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: stagesSpin 0.75s linear infinite;
        }

        @keyframes stagesSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .stages-empty-icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--color-surface-hover);
          color: var(--color-text-muted);
        }

        .stages-empty-title {
          margin: 0 !important;
          color: var(--color-text) !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }

        .stages-empty-description {
          margin: 4px 0 14px !important;
          color: var(--color-text-secondary) !important;
          font-size: 12px !important;
        }

        .stages-empty-btn {
          height: 36px;
          padding: 0 16px;
          border: 0;
          border-radius: 8px;
          background: var(--color-primary);
          color: var(--color-primary-foreground);
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .stages-empty-btn:hover {
          background: var(--color-primary);
        }

        /* ================================================================
           MODAL — intentionally mirrors the Tags page modal
           ================================================================ */

        .stage-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 99999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 16px !important;
          background: var(--color-overlay) !important;
          backdrop-filter: blur(7px) !important;
          -webkit-backdrop-filter: blur(7px) !important;
        }

        .stage-modal-card {
          width: 100% !important;
          overflow: hidden !important;
          background: var(--color-surface) !important;
          color: var(--color-text) !important;
          border: 1px solid var(--color-border) !important;
          border-radius: 15px !important;
          box-shadow: var(--elevation-xl) !important;
          isolation: isolate !important;
          opacity: 1 !important;
          filter: none !important;
          transform: none !important;
        }

        .stage-modal-header {
          min-height: 63px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 22px !important;
          background: var(--color-surface) !important;
          border-bottom: 1px solid var(--color-border) !important;
        }

        .stage-modal-title {
          margin: 0 !important;
          color: var(--color-text) !important;
          font-size: 15px !important;
          line-height: 20px;
          font-weight: 700 !important;
        }

        .stage-modal-close {
          width: 34px !important;
          height: 34px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          border: 1px solid var(--color-border) !important;
          border-radius: 8px !important;
          background: var(--color-surface-muted) !important;
          color: var(--color-text-muted) !important;
          cursor: pointer !important;
        }

        .stage-modal-close:hover {
          background: var(--color-surface-hover) !important;
          color: var(--color-text-secondary) !important;
        }

        .stage-modal-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 21px 22px 22px !important;
          background: var(--color-surface) !important;
        }

        .stage-form-label {
          display: block;
          margin: 0 0 7px !important;
          color: var(--color-text) !important;
          font-size: 11px !important;
          line-height: 16px;
          font-weight: 600 !important;
        }

        .stage-form-input {
          width: 100%;
          height: 40px;
          padding: 0 12px !important;
          border: 1px solid var(--color-border) !important;
          border-radius: 9px !important;
          outline: none !important;
          background: var(--color-surface) !important;
          color: var(--color-text) !important;
          font: inherit;
          font-size: 12px !important;
          box-shadow: none !important;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease !important;
        }

        .stage-form-input::placeholder {
          color: var(--color-text-muted) !important;
        }

        .stage-form-input:focus {
          border-color: var(--color-border-strong) !important;
          background: var(--color-surface) !important;
          box-shadow: 0 0 0 3px var(--color-primary-ring) !important;
        }

        .stage-color-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
        }

        .stage-color-swatch {
          width: 25px !important;
          height: 25px !important;
          min-width: 25px;
          padding: 0 !important;
          border-radius: 50% !important;
          border: 2px solid transparent !important;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease;
        }

        .stage-color-swatch:hover {
          transform: scale(1.06);
        }

        .stage-color-selected {
          transform: scale(1.08);
          border-color: var(--color-border-subtle) !important;
          box-shadow:
            0 0 0 2px var(--color-border-strong),
            var(--elevation-sm) !important;
        }

        .stage-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }

        .stage-cancel-btn {
          min-width: 76px;
          height: 36px;
          padding: 0 16px;
          border: 1px solid var(--color-border) !important;
          border-radius: 9px !important;
          background: var(--color-surface-muted) !important;
          color: var(--color-text) !important;
          font: inherit;
          font-size: 12px !important;
          font-weight: 600 !important;
          cursor: pointer;
          transition: background-color 0.18s ease;
        }

        .stage-cancel-btn:hover:not(:disabled) {
          background: var(--color-surface-hover) !important;
        }

        .stage-submit-btn,
        .stage-delete-btn {
          min-width: 88px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 16px;
          border: 0 !important;
          border-radius: 9px !important;
          background: var(--color-primary) !important;
          color: var(--color-primary-foreground) !important;
          font: inherit;
          font-size: 12px !important;
          font-weight: 700 !important;
          cursor: pointer;
          box-shadow: 0 3px 8px rgba(var(--color-primary-rgb), 0.16);
          transition:
            background-color 0.18s ease,
            transform 0.18s ease;
        }

        .stage-submit-btn:hover:not(:disabled),
        .stage-delete-btn:hover:not(:disabled) {
          background: var(--color-primary) !important;
          transform: translateY(-1px);
        }

        .stage-submit-btn:disabled,
        .stage-cancel-btn:disabled,
        .stage-delete-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .stage-delete-content {
          padding: 21px 22px 22px;
          background: var(--color-surface) !important;
          text-align: center;
        }

        .stage-delete-icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .stage-delete-title {
          margin: 0 0 5px !important;
          color: var(--color-text) !important;
          font-size: 14px !important;
          line-height: 20px;
          font-weight: 700 !important;
        }

        .stage-delete-description {
          margin: 0 0 18px !important;
          color: var(--color-text-muted) !important;
          font-size: 11px !important;
          line-height: 18px;
        }

        .stage-delete-footer {
          justify-content: center;
        }

        .stage-delete-btn {
          background: var(--color-primary) !important;
        }

        @media (max-width: 700px) {
          .stages-page {
            padding: 18px 16px 36px;
          }

          .stages-topbar {
            align-items: flex-start;
          }

          .stages-title {
            font-size: 24px !important;
            line-height: 31px;
          }

          .stages-search {
            max-width: 100%;
          }

          .stage-modal-overlay {
            padding: 12px !important;
          }

          .stage-modal-card {
            max-width: calc(100vw - 24px) !important;
          }
        }
      `}</style>
    </div>
  );
}
