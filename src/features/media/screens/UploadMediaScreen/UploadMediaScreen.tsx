/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  UploadCloud,
  Copy,
  Check,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Search,
  Grid,
  List,
  RefreshCw,
  FileImage,
  FileText,
  Video,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  Info,
  FileType,
} from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { uploadMedia } from "@/lib/media-upload";

interface MediaItem {
  id: string;
  name: string;
  originalName?: string;
  original_name?: string;
  firebaseUrl: string;
  firebase_url?: string;
  size?: string;
  mimetype?: string;
  createdAt: string;
  created_at?: string;
}

const normalizeMediaItem = (raw: any): MediaItem => {
  const firebaseUrl =
    raw?.firebaseUrl ||
    raw?.firebase_url ||
    raw?.url ||
    raw?.media_url ||
    "";
  const name =
    raw?.name ||
    raw?.originalName ||
    raw?.original_name ||
    "Media";
  const originalName =
    raw?.originalName ||
    raw?.original_name ||
    name;
  const createdAt =
    raw?.createdAt ||
    raw?.created_at ||
    new Date().toISOString();
  const size = raw?.size || "";
  const mimetype = raw?.mimetype || raw?.mime_type || "";
  const id = String(raw?.id || Date.now());

  return {
    id,
    name,
    originalName,
    original_name: originalName,
    firebaseUrl,
    firebase_url: firebaseUrl,
    size,
    mimetype,
    createdAt,
    created_at: createdAt,
  };
};

export default function UploadMediaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [fileCategory, setFileCategory] = useState<"image" | "video" | "document" | "other">("image");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "image" | "video" | "document">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const uploadScreenMountedRef = useRef(true);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch history of uploaded media from backend API (/admin/image-upload/list)
  const fetchUploadedMedia = async () => {
    setIsLoadingList(true);
    try {
      const res = await soft7AxiosInstance.get("/admin/image-upload/list");
      const data = res.data;
      const rawList = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      setMediaList(rawList.map(normalizeMediaItem));
    } catch (err) {
      console.error("Failed to fetch uploaded media from backend API:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    uploadScreenMountedRef.current = true;
    fetchUploadedMedia();
    return () => { uploadScreenMountedRef.current = false; };
  }, []);

  const detectCategory = (f: File): "image" | "video" | "document" | "other" => {
    const mime = f.type.toLowerCase();
    const name = f.name.toLowerCase();
    if (mime.startsWith("image/") || /\.(jpeg|jpg|png|webp|gif|svg)$/i.test(name)) return "image";
    if (mime.startsWith("video/") || /\.(mp4|webm|mov|3gp|mkv)$/i.test(name)) return "video";
    if (
      mime.includes("pdf") ||
      mime.includes("document") ||
      mime.includes("sheet") ||
      mime.includes("excel") ||
      mime.includes("presentation") ||
      mime.includes("word") ||
      mime.includes("text") ||
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i.test(name)
    ) {
      return "document";
    }
    return "other";
  };

  // Handle file selection (Image, Video, Document)
  const handleFileSelect = (selectedFile: File) => {
    if (uploadInFlightRef.current) return;
    const cat = detectCategory(selectedFile);
    setFileCategory(cat);
    setFile(selectedFile);

    const cleanName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf(".")) || selectedFile.name;
    setMediaName(cleanName.replace(/[^a-zA-Z0-9\s_-]/g, ""));

    // Create live preview
    if (cat === "image") {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewSrc(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else if (cat === "video") {
      setPreviewSrc(URL.createObjectURL(selectedFile));
    } else {
      setPreviewSrc(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploadInFlightRef.current) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setFile(null);
    setPreviewSrc(null);
    setMediaName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle upload submit calling backend API (/admin/image-upload/upload)
  const handleUploadSubmit = async () => {
    if (uploadInFlightRef.current) return;
    if (!file) {
      showToast("Please choose a file first.", "error");
      return;
    }

    uploadInFlightRef.current = true;
    setIsUploading(true);
    setIsDragging(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", mediaName.trim() || file.name);

      // The shared uploader owns job status, errors and the completion countdown.
      const rawItem = await uploadMedia(formData);
      if (!uploadScreenMountedRef.current) return;
      const item = normalizeMediaItem({
        ...rawItem,
        name: mediaName.trim() || rawItem?.name || file.name,
        originalName: file.name,
        original_name: file.name,
        size: rawItem?.size || `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        mimetype: rawItem?.mimetype || file.type,
      });

      if (item && item.firebaseUrl) {
        setMediaList((prev) => [item, ...prev.filter((m) => m.id !== item.id)]);
        // Reset the upload dropzone and inputs back to pristine empty state
        clearSelectedFile();
      } else {
        throw new Error("Failed to upload file. No Firebase URL returned.");
      }
    } catch (err) {
      if (!uploadScreenMountedRef.current) return;
      console.error("Upload error:", err);
    } finally {
      uploadInFlightRef.current = false;
      if (uploadScreenMountedRef.current) {
        setIsUploading(false);
      }
    }
  };

  // Copy URL to clipboard
  const handleCopyUrl = (url: string, idKey: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(idKey);
    showToast("Firebase URL copied to clipboard!");
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  // Delete media item
  const handleDeleteMedia = async (id: string) => {
    if (!confirm("Are you sure you want to delete this uploaded media record?")) return;
    try {
      await soft7AxiosInstance.delete(`/admin/image-upload/${id}`);
      setMediaList((prev) => prev.filter((img) => img.id !== id));
      showToast("Media record deleted successfully.");
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast(err.response?.data?.message || "Failed to delete media.", "error");
    }
  };

  const getItemCategory = (item: MediaItem): "image" | "video" | "document" => {
    const mime = (item.mimetype || "").toLowerCase();
    const orig = (item.originalName || item.original_name || "").toLowerCase();
    const url = (item.firebaseUrl || item.firebase_url || "").toLowerCase();

    if (mime.startsWith("image/") || /\.(jpeg|jpg|png|webp|gif|svg)$/i.test(orig) || /\.(jpeg|jpg|png|webp|gif|svg)/i.test(url)) {
      return "image";
    }
    if (mime.startsWith("video/") || /\.(mp4|3gp|webm|mov|mkv)$/i.test(orig) || /\.(mp4|3gp|webm|mov|mkv)/i.test(url)) {
      return "video";
    }
    return "document";
  };

  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      const name = item.name || "";
      const origName = item.originalName || item.original_name || "";
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        origName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (categoryFilter === "all") return true;
      const cat = getItemCategory(item);
      return cat === categoryFilter;
    });
  }, [mediaList, searchQuery, categoryFilter]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground p-4 sm:p-6 lg:p-8 transition-colors">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl backdrop-blur-md border transition-all duration-300 ${
            toastMessage.type === "success"
              ? "bg-card border-primary/30 text-foreground"
              : "bg-card border-destructive/30 text-destructive"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <UploadCloud className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Media Gallery & Upload</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload images, videos, and PDF documents to Firebase Storage and get public shareable URLs instantly.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchUploadedMedia}
              disabled={isLoadingList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-card hover:bg-muted border border-border rounded-lg transition shadow-xs h-8 disabled:opacity-50"
              title="Refresh List"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isLoadingList ? "animate-spin text-primary" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Upload Form Card */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs">
          <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-foreground">
            <Upload className="w-4 h-4 text-primary" />
            Upload New Media (Image, Video, Document / PDF)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Drag & Drop Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!uploadInFlightRef.current) fileInputRef.current?.click();
              }}
              aria-disabled={isUploading}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[190px] ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : previewSrc || file
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:border-primary/60 hover:bg-muted/50 bg-muted/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleInputChange}
                disabled={isUploading}
                className="hidden"
              />

              {file ? (
                <div className="relative group w-full flex flex-col items-center">
                  {fileCategory === "image" && previewSrc && (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border shadow-sm mb-2 bg-muted">
                      <img
                        src={previewSrc}
                        alt="Selected Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {fileCategory === "video" && previewSrc && (
                    <div className="relative w-40 h-28 rounded-lg overflow-hidden border border-border shadow-sm mb-2 bg-black">
                      <video src={previewSrc} className="w-full h-full object-cover" controls />
                    </div>
                  )}
                  {fileCategory === "document" && (
                    <div className="flex flex-col items-center p-4 bg-muted border border-border rounded-xl mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center mb-1 shadow-sm">
                        PDF
                      </div>
                      <span className="font-semibold text-xs text-foreground">
                        {file.name}
                      </span>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-primary">
                    Click or drag new file to change
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    Drag and drop your file here, or{" "}
                    <span className="text-primary underline">Browse</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Supports Images (PNG, JPG), Videos (MP4, 3GP), and Documents (PDF, Word)
                  </p>
                </>
              )}
            </div>

            {/* Form Controls */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  File Title / Display Name:
                </label>
                <input
                  type="text"
                  value={mediaName}
                  onChange={(e) => setMediaName(e.target.value)}
                  placeholder="Enter a custom display name (e.g. Wedding_Invitation.pdf)"
                  disabled={!file || isUploading}
                  className="w-full px-3.5 py-2 rounded-lg bg-muted border border-border text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring transition disabled:opacity-50 disabled:cursor-not-allowed h-9"
                />
              </div>

              {file && (
                <div className="p-3 rounded-lg bg-muted border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {fileCategory === "image" ? (
                      <FileImage className="w-4 h-4 text-primary shrink-0" />
                    ) : fileCategory === "video" ? (
                      <Video className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="font-semibold text-foreground truncate text-xs">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    disabled={isUploading}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!uploadInFlightRef.current) clearSelectedFile();
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={handleUploadSubmit}
                  disabled={!file || isUploading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs bg-primary hover:opacity-90 text-primary-foreground shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition h-9"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Upload & Get Firebase URL</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload & Get Firebase URL</span>
                    </>
                  )}
                </button>

                {file && (
                  <button
                    onClick={() => {
                      if (!uploadInFlightRef.current) clearSelectedFile();
                    }}
                    disabled={isUploading}
                    className="px-3.5 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition h-9 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted p-2.5 rounded-lg border border-border">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p>
                  Once uploaded, your media is hosted on Firebase Storage and accessible via the generated public URL for templates and campaigns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Gallery / History Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <ImageIcon className="w-4 h-4 text-primary" />
                Media Gallery
              </h2>
              <span className="text-[11px] font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                {mediaList.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter Tabs */}
              <div className="flex items-center bg-card border border-border p-1 rounded-lg gap-1">
                {(["all", "image", "video", "document"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {cat === "all" ? "All" : cat === "document" ? "PDFs & Docs" : cat.charAt(0).toUpperCase() + cat.slice(1) + "s"}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border focus:ring-1 focus:ring-ring w-40 sm:w-52 h-8"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-card border border-border p-1 rounded-lg gap-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition ${
                    viewMode === "grid"
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md transition ${
                    viewMode === "table"
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* List Display */}
          {isLoadingList ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="w-7 h-7 animate-spin text-primary mb-2" />
              <p className="text-xs font-medium">Loading media...</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                No media found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Upload your first image, video, or PDF document above to generate a shareable Firebase URL.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMedia.map((img) => {
                const cat = getItemCategory(img);
                const isPdf = cat === "document";

                return (
                  <div
                    key={img.id}
                    className="bg-card border border-border rounded-xl overflow-hidden shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200 flex flex-col group"
                  >
                    <div className="relative h-40 bg-muted/60 overflow-hidden flex items-center justify-center">
                      {cat === "image" ? (
                        <img
                          src={img.firebaseUrl}
                          alt={img.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : cat === "video" ? (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-xs">
                            <Video className="w-6 h-6" />
                          </div>
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            Video File
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center mb-2 shadow-xs">
                            PDF
                          </div>
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            PDF Document
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex items-end justify-between">
                        <a
                          href={img.firebaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-card/95 text-foreground hover:bg-card transition text-xs font-medium flex items-center gap-1 shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                        <button
                          onClick={() => handleDeleteMedia(img.id)}
                          className="p-1.5 rounded-lg bg-destructive text-white hover:opacity-90 transition shadow-sm"
                          title="Delete Media"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <h4 className="font-semibold text-xs text-foreground truncate" title={img.name || img.originalName}>
                            {img.name || img.originalName}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted border border-border text-foreground shrink-0">
                            {img.size || (isPdf ? "PDF" : cat.toUpperCase())}
                          </span>
                        </div>
                        {img.createdAt && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(img.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Firebase URL
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={img.firebaseUrl}
                            className="flex-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-muted border border-border text-foreground focus:outline-none select-all h-7"
                          />
                          <button
                            onClick={() => handleCopyUrl(img.firebaseUrl, img.id)}
                            className={`p-1.5 rounded-md font-semibold text-xs transition h-7 flex items-center justify-center ${
                              copiedId === img.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary hover:opacity-90 text-primary-foreground"
                            }`}
                            title="Copy Firebase URL"
                          >
                            {copiedId === img.id ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/70 uppercase font-semibold text-[11px] text-foreground/80 dark:text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3 w-16">Preview</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Firebase URL</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMedia.map((img) => {
                      const cat = getItemCategory(img);
                      const isPdf = cat === "document";

                      return (
                        <tr key={img.id} className="hover:bg-muted/40 transition">
                          <td className="p-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                              {cat === "image" ? (
                                <img src={img.firebaseUrl} alt={img.name} className="w-full h-full object-cover" />
                              ) : cat === "video" ? (
                                <Video className="w-4 h-4 text-primary" />
                              ) : (
                                <div className="w-5 h-5 rounded bg-primary text-primary-foreground font-bold text-[8px] flex items-center justify-center">
                                  PDF
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            <p className="truncate max-w-xs">{img.name || img.originalName}</p>
                            {img.createdAt && (
                              <p className="text-[10px] text-muted-foreground font-normal">{new Date(img.createdAt).toLocaleString()}</p>
                            )}
                          </td>
                          <td className="p-3 uppercase font-semibold text-[10px] text-muted-foreground">
                            {isPdf ? "PDF" : cat}
                          </td>
                          <td className="p-3 text-muted-foreground font-medium">{img.size || "-"}</td>
                          <td className="p-3 max-w-md">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                readOnly
                                value={img.firebaseUrl}
                                className="w-full px-2 py-1 rounded-md text-[11px] font-mono bg-muted border border-border text-foreground focus:outline-none select-all h-7"
                              />
                              <button
                                onClick={() => handleCopyUrl(img.firebaseUrl, img.id)}
                                className={`p-1.5 rounded-md text-white transition shrink-0 h-7 flex items-center justify-center ${
                                  copiedId === img.id ? "bg-primary" : "bg-primary hover:opacity-90"
                                }`}
                                title="Copy URL"
                              >
                                {copiedId === img.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={img.firebaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                                title="Open Preview"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleDeleteMedia(img.id)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                title="Delete Media"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
