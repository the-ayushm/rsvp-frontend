/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { X, Image, FileText, Video, Music, Check } from "lucide-react";

interface MediaItem {
  id: number;
  name: string;
  fileName: string;
  type: string;
  size: string;
  url: string;
}

interface GalleryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
}

export function GalleryPickerModal({
  isOpen,
  onClose,
  onSelect,
}: GalleryPickerModalProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<
    "all" | "image" | "video" | "audio" | "document"
  >("all");

  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ["gallery-media"],
    queryFn: async () => {
      const res = await soft7AxiosInstance.get("/admin/image-upload/list");
      const rawList = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      return rawList.map((item: any) => ({
        id: item.id,
        name: item.name || item.original_name || "Media",
        fileName: item.original_name || item.name || "",
        type: item.mimetype || item.mime_type || "image/png",
        size: item.size || "",
        url: item.firebase_url || item.firebaseUrl || item.url || "",
      })) as MediaItem[];
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const getMediaIcon = (type: string) => {
    if (type.startsWith("image/"))
      return <Image className="w-6 h-6 text-[var(--color-primary)]" />;
    if (type.startsWith("video/"))
      return <Video className="w-6 h-6 text-[var(--color-primary)]" />;
    if (type.startsWith("audio/"))
      return <Music className="w-6 h-6 text-primary-text" />;
    return <FileText className="w-6 h-6 text-[var(--color-primary)]" />;
  };

  const getMediaCategory = (
    type: string,
  ): "image" | "video" | "audio" | "document" => {
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    return "document";
  };

  const filteredMedia =
    filter === "all"
      ? mediaItems
      : mediaItems.filter((item) => getMediaCategory(item.type) === filter);

  const handleConfirm = () => {
    if (selectedMedia) {
      onSelect(selectedMedia);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
      <div className="bg-surface dark:bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-border">
          <h2 className="text-lg font-semibold text-foreground dark:text-white">
            Select from Gallery
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover dark:hover:bg-surface-raised rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 p-4 border-b dark:border-border">
          {(["all", "image", "video", "audio", "document"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-hover dark:bg-surface-raised text-secondary-foreground dark:text-secondary-foreground hover:bg-surface-active dark:hover:bg-surface-active"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ),
          )}
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Image className="w-12 h-12 mb-2 opacity-50" />
              <p>No media found</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMedia(item)}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    selectedMedia?.id === item.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-border-strong dark:hover:border-border"
                  }`}
                >
                  {item.type.startsWith("image/") ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-hover dark:bg-surface-raised flex flex-col items-center justify-center p-2">
                      {getMediaIcon(item.type)}
                      <span className="text-xs text-secondary-foreground dark:text-muted-foreground mt-1 text-center truncate w-full">
                        {item.name}
                      </span>
                    </div>
                  )}

                  {/* Selection Check */}
                  {selectedMedia?.id === item.id && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t dark:border-border">
          <div className="text-sm text-muted-foreground">
            {selectedMedia ? (
              <span>
                Selected: <strong>{selectedMedia.name}</strong> (
                {selectedMedia.size})
              </span>
            ) : (
              <span>Click on a media item to select</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-secondary-foreground dark:text-secondary-foreground hover:bg-surface-hover dark:hover:bg-surface-raised rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedMedia}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedMedia
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                  : "bg-surface-active dark:bg-surface-active text-muted-foreground cursor-not-allowed"
              }`}
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
