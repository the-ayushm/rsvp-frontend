
"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import {
  X,
  Image as ImageIcon,
  FileText,
  Video,
  Search,
  Upload,
  Loader2,
} from "lucide-react";

export interface UploadedMedia {
  id: string;
  name: string;
  originalName: string;
  firebaseUrl: string;
  size: string;
  mimetype: string;
  createdAt: string;
}

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, filename?: string) => void;
  onUploadNew: (file: File) => void;
  uploadingMedia: boolean;
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT";
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  onUploadNew,
  uploadingMedia,
  mediaType,
}: MediaPickerModalProps) {
  const [selectedMedia, setSelectedMedia] =
    useState<UploadedMedia | null>(null);

  const [activeTab, setActiveTab] = useState<
    "ALL" | "IMAGE" | "VIDEO" | "DOCUMENT"
  >(mediaType);

  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(mediaType);
      setSelectedMedia(null);
      setSearchQuery("");
    }
  }, [isOpen, mediaType]);

  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ["uploaded-media-list"],
    queryFn: async () => {
      const { data } = await soft7AxiosInstance.get(
        "/admin/image-upload/list",
      );

      const rawList = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      return rawList.map((raw: any) => ({
        id: String(raw?.id || Date.now()),
        name: raw?.name || raw?.originalName || raw?.original_name || "Media",
        originalName:
          raw?.originalName || raw?.original_name || raw?.name || "",
        firebaseUrl:
          raw?.firebaseUrl ||
          raw?.firebase_url ||
          raw?.url ||
          raw?.media_url ||
          "",
        size: raw?.size || "",
        mimetype: raw?.mimetype || raw?.mime_type || "",
        createdAt:
          raw?.createdAt || raw?.created_at || new Date().toISOString(),
      })) as UploadedMedia[];
    },
    enabled: isOpen,
  });

  const filteredMedia = useMemo(() => {
    return mediaItems.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.originalName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "ALL") return true;

      const mime = (item.mimetype || "").toLowerCase();
      const url = (item.firebaseUrl || "").toLowerCase();
      const orig = (item.originalName || "").toLowerCase();

      if (activeTab === "IMAGE") {
        return (
          mime.startsWith("image/") ||
          /\.(jpeg|jpg|png|webp|gif|svg)$/i.test(orig) ||
          /\.(jpeg|jpg|png|webp|gif|svg)/i.test(url)
        );
      }

      if (activeTab === "VIDEO") {
        return (
          mime.startsWith("video/") ||
          /\.(mp4|3gp|webm|mov|mkv)$/i.test(orig) ||
          /\.(mp4|3gp|webm|mov|mkv)/i.test(url)
        );
      }

      if (activeTab === "DOCUMENT") {
        return (
          mime.includes("pdf") ||
          mime.includes("document") ||
          mime.includes("sheet") ||
          mime.includes("excel") ||
          mime.includes("presentation") ||
          mime.includes("word") ||
          mime.includes("text") ||
          /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i.test(orig) ||
          /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)/i.test(url) ||
          (!mime.startsWith("image/") && !mime.startsWith("video/"))
        );
      }

      return true;
    });
  }, [mediaItems, activeTab, searchQuery]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedMedia) {
      const filename =
        selectedMedia.name || selectedMedia.originalName;

      onSelect(selectedMedia.firebaseUrl, filename);
      onClose();
    }
  };

  const getAcceptTypes = () => {
    if (mediaType === "IMAGE") return "image/*";

    if (mediaType === "VIDEO") return "video/*";

    return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf";
  };

  return (
    <>
      <style>{`
        .media-picker-modal .media-picker-file-info {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 72px !important;
          height: auto !important;
          padding: 8px 10px !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          background: var(--color-surface) !important;
          border-top: 1px solid var(--color-border) !important;
        }

        .dark .media-picker-modal .media-picker-file-info {
          background: var(--neutral-900) !important;
        }

        .media-picker-modal .media-picker-file-name {
          display: -webkit-box !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 32px !important;
          overflow: hidden !important;
          -webkit-box-orient: vertical !important;
          -webkit-line-clamp: 2 !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          white-space: normal !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          color: var(--color-text) !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          line-height: 16px !important;
          text-align: left !important;
          text-decoration: none !important;
          text-shadow: none !important;
        }

        .dark .media-picker-modal .media-picker-file-name {
          color: var(--color-text) !important;
        }

        .media-picker-modal .media-picker-file-meta {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 18px !important;
          margin-top: 6px !important;
          padding: 0 !important;
          gap: 8px !important;
          overflow: hidden !important;
          background: transparent !important;
          color: var(--color-text-secondary) !important;
        }

        .dark .media-picker-modal .media-picker-file-meta {
          color: var(--color-text-secondary) !important;
        }

        .media-picker-modal .media-picker-file-size {
          display: block !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          color: var(--color-text-secondary) !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          line-height: 16px !important;
          text-align: left !important;
          text-decoration: none !important;
          text-shadow: none !important;
        }

        .dark .media-picker-modal .media-picker-file-size {
          color: var(--color-text-secondary) !important;
        }

        .media-picker-modal .media-picker-file-type {
          display: block !important;
          flex: 0 0 auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          color: var(--color-error) !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          line-height: 16px !important;
        }
      `}</style>

      <div className="media-picker-modal font-sans fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/15 bg-surface-muted shadow-2xl font-sans">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-3.5 z-10 shrink-0 font-sans" style={{ backgroundColor: "var(--color-surface-active)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-2xs shrink-0" style={{ backgroundColor: "var(--color-primary)" }}>
                {mediaType === "IMAGE" && (
                  <ImageIcon className="w-4.5 h-4.5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                )}
                {mediaType === "VIDEO" && (
                  <Video className="w-4.5 h-4.5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                )}
                {mediaType === "DOCUMENT" && (
                  <FileText className="w-4.5 h-4.5 text-white" strokeWidth={2.2} style={{ color: "var(--color-primary-foreground)", stroke: "var(--color-primary-foreground)" }} />
                )}
              </div>

              <h2 className="text-sm font-bold text-foreground font-sans">
                Select{" "}
                {mediaType === "DOCUMENT"
                  ? "Document / PDF"
                  : mediaType.charAt(0) +
                    mediaType.slice(1).toLowerCase()}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Upload New Section */}
          <div className="flex flex-col border-b border-black/10 bg-surface font-sans">
            <div className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-bold text-foreground font-sans">
                  Upload New{" "}
                  {mediaType === "DOCUMENT"
                    ? "PDF / Document"
                    : mediaType.charAt(0) +
                      mediaType.slice(1).toLowerCase()}
                </h3>

                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  Upload directly from your device to attach to your WhatsApp message
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={getAcceptTypes()}
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    onUploadNew(file);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 font-sans"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                {uploadingMedia ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ stroke: "var(--color-primary-foreground)", color: "var(--color-primary-foreground)" }} />
                    <span style={{ color: "var(--color-primary-foreground)" }} className="font-bold text-xs">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 shrink-0" strokeWidth={2.5} style={{ stroke: "var(--color-primary-foreground)", color: "var(--color-primary-foreground)" }} />
                    <span style={{ color: "var(--color-primary-foreground)" }} className="font-bold text-xs">Browse & Upload</span>
                  </>
                )}
              </button>
            </div>

            {uploadingMedia && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 rounded-xl bg-primary-light border border-primary-soft p-3 text-xs font-semibold text-primary-text animate-pulse font-sans">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  Uploading your media, please wait...
                </div>
              </div>
            )}
          </div>

          {/* Filter and Search */}
          <div className="flex flex-col items-center justify-between gap-3 border-b border-black/10 bg-surface px-4 py-2.5 sm:flex-row font-sans">

            {/* Tabs */}
            <div className="flex w-full items-center gap-1 rounded-xl bg-surface-active p-1 border border-black/10 sm:w-auto font-sans">
              {(["ALL", "IMAGE", "VIDEO", "DOCUMENT"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                      activeTab === tab
                        ? "bg-surface text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "ALL"
                      ? "All"
                      : tab === "DOCUMENT"
                        ? "PDF / Docs"
                        : tab.charAt(0) +
                          tab.slice(1).toLowerCase() +
                          "s"}
                  </button>
                ),
              )}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none"
                style={{ stroke: "var(--color-text-muted)", color: "var(--color-text-muted)" }}
                strokeWidth={2.2}
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by file name..."
                style={{ paddingLeft: "34px" }}
                className="w-full bg-surface-muted border border-black/15 rounded-xl pr-3 py-1.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-sans transition-all"
              />
            </div>
          </div>

          {/* Media Grid */}
          <div className="flex-1 overflow-y-auto bg-surface-muted p-4 ">
            {isLoading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-accent" />
                <p className="text-xs font-medium">Loading media library...</p>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                <FileText className="mb-2 h-10 w-10 text-muted-foreground opacity-40" />
                <p className="text-sm font-bold text-foreground">No media found</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upload a new file above to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
                {filteredMedia.map((item) => {
                  const isImage =
                    item.mimetype?.startsWith("image/") ||
                    /\.(jpeg|jpg|gif|png|webp|svg)/i.test(
                      item.firebaseUrl || "",
                    ) ||
                    /\.(jpeg|jpg|gif|png|webp|svg)/i.test(
                      item.originalName || "",
                    );

                  const isVideo =
                    item.mimetype?.startsWith("video/") ||
                    /\.(mp4|webm|ogg|3gp|mov)/i.test(
                      item.firebaseUrl || "",
                    ) ||
                    /\.(mp4|webm|ogg|3gp|mov)/i.test(
                      item.originalName || "",
                    );

                  const isPdf =
                    item.mimetype?.includes("pdf") ||
                    (item.originalName || "")
                      .toLowerCase()
                      .endsWith(".pdf") ||
                    (item.firebaseUrl || "")
                      .toLowerCase()
                      .includes(".pdf");

                  const isSelected =
                    selectedMedia?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setSelectedMedia(
                          isSelected ? null : item,
                        )
                      }
                      className={`relative cursor-pointer overflow-hidden rounded-xl border bg-surface transition-all duration-150 ${
                        isSelected
                          ? "scale-[0.98] border-accent shadow-md ring-2 ring-accent/40"
                          : "border-black/15 hover:border-accent hover:shadow-xs"
                      }`}
                    >
                      {/* Preview */}
                      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-surface-active">
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.firebaseUrl}
                            alt={
                              item.name ||
                              item.originalName
                            }
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (
                                e.target as HTMLImageElement
                              ).src =
                                "https://placehold.co/150x150?text=Image";
                            }}
                          />
                        ) : isVideo ? (
                          <div className="flex flex-col items-center justify-center p-3 text-center">
                            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-hover/15 text-primary-text">
                              <Video className="h-5 w-5" />
                            </div>

                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-text">
                              Video
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-3 text-center">
                            <div
                              className={`mb-1 flex h-10 w-10 items-center justify-center rounded-lg shadow-2xs ${
                                isPdf
                                  ? "bg-primary-light text-primary-text"
                                  : "bg-[var(--neutral-500)]/20 text-secondary-foreground"
                              }`}
                            >
                              <FileText className="h-5 w-5" />
                            </div>

                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                isPdf
                                  ? "text-primary-text"
                                  : "text-secondary-foreground"
                              }`}
                            >
                              {isPdf
                                ? "PDF Document"
                                : "Document"}
                            </span>
                          </div>
                        )}

                        {/* Selected Badge */}
                        {isSelected && (
                          <div className="absolute right-2 top-2 rounded-full bg-accent p-1 text-primary-foreground shadow-sm">
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* File Information */}
                      <div className="media-picker-file-info">
                        <div
                          className="media-picker-file-name"
                          title={
                            item.name ||
                            item.originalName ||
                            "Unnamed file"
                          }
                        >
                          {item.name ||
                            item.originalName ||
                            "Unnamed file"}
                        </div>

                        <div className="media-picker-file-meta">
                          <span className="media-picker-file-size">
                            {item.size || "File"}
                          </span>

                          {isPdf && (
                            <span className="media-picker-file-type text-accent font-bold">
                              PDF
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-black/10 bg-surface p-4 font-sans">
            <div className="min-w-0 pr-2 text-xs text-muted-foreground font-sans">
              {selectedMedia ? (
                <span className="block truncate">
                  Selected:{" "}
                  <strong className="text-primary-text font-bold">
                    {selectedMedia.name ||
                      selectedMedia.originalName}
                  </strong>
                </span>
              ) : (
                <span>
                  Select an item from the library to continue
                </span>
              )}
            </div>

            <div className="flex shrink-0 gap-2 font-sans">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none h-[2.375rem] px-4 bg-surface text-foreground border border-border hover:bg-surface-hover shadow-xs text-xs cursor-pointer font-sans"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedMedia}
                className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
                style={{
                  backgroundColor: selectedMedia ? "var(--color-primary)" : "var(--color-surface-active)",
                  color: selectedMedia ? "var(--color-primary-foreground)" : "var(--color-text-muted)"
                }}
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
