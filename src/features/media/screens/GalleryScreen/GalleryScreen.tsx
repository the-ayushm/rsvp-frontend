/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FaTrash, FaPlus, FaCamera, FaUpload, FaTimes, FaTh, FaList, FaSpinner, FaFile } from "react-icons/fa";
import "@/features/media/screens/GalleryScreen/gallery.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface Media {
  id: number;
  name: string;
  fileName: string;
  type: string;
  size: string;
  url: string;
  createdAt: string;
}

// --- Component Start ---
export default function GalleryPage() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Fetch media
  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const res = await soft7AxiosInstance.get("/api/user/gallery/list");
      const data = await res.data;
      setMediaList(data);
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setPhotoName(selectedFile.name.split(".")[0].replace(/[^a-zA-Z0-9\s]/g, ""));
  };

  const handleUpload = async () => {
    if (!file || photoName.trim() === "") return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", photoName);

    setIsLoading(true);
    try {
      const res = await soft7AxiosInstance.post("/api/user/gallery/upload", formData );
        setFile(null);
        setPhotoName("");
        setShowModal(false);
        await fetchMedia();
    } catch (error) {
      console.error("Upload error:", error);
      alert("An error occurred during upload.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this file? This action cannot be undone.")) return;
    try {
      setMediaList((prev) => prev.filter((m) => m.id !== id));
      await soft7AxiosInstance.delete(`/api/user/gallery/delete/${id}`);
        console.log("Deleted Successfully");
        fetchMedia();
    } catch (error) {
      console.error("Delete error:", error);
      fetchMedia();
    }
  };
  
  const closeModal = () => {
    setFile(null);
    setPhotoName("");
    setShowModal(false);
  };

  // --- Grid Item Component ---
  const GridMediaItem = ({ media }: { media: Media }) => {
    const isImage = media.type.startsWith("image");

    return (
      <div className="bg-surface dark:bg-surface-raised rounded-xl shadow-lg dark:shadow-black/30 hover:shadow-2xl hover:shadow-green-500/20 dark:hover:shadow-green-500/10 transition-all duration-300 overflow-hidden group border border-primary-soft dark:border-primary-soft">
        <div className="relative h-32 w-full cursor-pointer overflow-hidden" onClick={() => window.open(media.url, "_blank")}>
          {isImage ? (
            <Image
              src={media.url}
              alt={media.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-primary-lighter to-primary-light dark:from-primary-light/20 dark:to-primary-hover/20 text-[var(--color-primary-dark)] dark:text-primary-text text-4xl border-b border-[rgba(var(--color-primary-rgb),0.3)] dark:border-primary">
              <FaFile className="drop-shadow-sm" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-hover/80 via-transparent to-transparent flex items-end justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 p-4">
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
              className="bg-error hover:bg-error text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-110 hover:rotate-12"
              title="Delete File"
            >
              <FaTrash className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 bg-gradient-to-r from-white to-primary-lighter/30 dark:from-surface-raised dark:to-primary-light/10">
          <p className="font-semibold text-foreground dark:text-foreground truncate mb-2" title={media.name}>{media.name}</p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground dark:text-muted-foreground">{media.size}</span>
            <span className="text-xs bg-[var(--color-success-light)] dark:bg-primary-light/30 text-[var(--color-primary)] dark:text-primary-text px-2 py-1 rounded-full font-medium">
              {isImage ? 'Image' : 'File'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Render ---
  return (
    <div 
      className="min-h-screen p-4 sm:p-8 lg:p-12 bg-surface dark:bg-surface" 
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b-2 border-primary-soft dark:border-primary-soft/40 px-6 py-4 rounded-xl">
          <h1 className="text-4xl font-extrabold text-foreground dark:text-foreground flex items-center gap-3 mb-4 sm:mb-0">
            <FaCamera className="text-[var(--color-primary-dark)] dark:text-primary-text" />
            <span className={isDarkMode ? "text-white" : "text-foreground"}>
              Gallery
            </span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex bg-surface-active dark:bg-surface-active p-1 rounded-full shadow-inner gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-full transition ${viewMode === "grid" ? "bg-[var(--color-success-light)] text-[var(--color-success-dark)] shadow" : "text-secondary-foreground dark:text-secondary-foreground hover:bg-border-strong dark:hover:bg-border-strong"}`}
                title="Grid View"
              >
                <FaTh />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-full transition ${viewMode === "table" ? "bg-[var(--color-success-light)] text-[var(--color-success-dark)] shadow" : "text-secondary-foreground dark:text-secondary-foreground hover:bg-border-strong dark:hover:bg-border-strong"}`}
                title="List View"
              >
                <FaList />
              </button>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center bg-[var(--color-success-light)] text-[var(--color-success-dark)] px-5 py-2.5 rounded-lg shadow-lg hover:bg-primary-soft transition transform hover:scale-[1.02] font-semibold"
            >
              Add File
            </button>
          </div>
        </header>


        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <FaSpinner className="animate-spin w-8 h-8 text-[var(--color-primary-dark)] dark:text-primary-text" />
            <p className="ml-3 text-lg text-[var(--color-primary-dark)] dark:text-primary-text font-medium">Loading media...</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <>
            {viewMode === "grid" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {mediaList.map((media) => (
                  <GridMediaItem key={media.id} media={media} />
                ))}
                {mediaList.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 px-8">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-light to-primary-soft dark:from-primary-hover dark:to-[var(--color-primary-dark)] flex items-center justify-center shadow-xl mb-6">
                      <FaCamera className="w-10 h-10 text-[var(--color-primary-dark)] dark:text-primary-text" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground dark:text-white mb-3">Welcome to Your Gallery</h3>
                    <p className="text-muted-foreground dark:text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
                      Start building your media collection by uploading images and files. Your gallery will showcase all your content beautifully.
                    </p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="inline-flex items-center px-8 py-4 bg-[var(--color-success-light)] hover:bg-primary-soft text-[var(--color-primary-dark)] font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                    >
                     
                      Upload Your First Media
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* FIXED TABLE VIEW - Proper Dark Mode Support */}
            {viewMode === "table" && (
              <div 
                className="overflow-x-auto rounded-2xl border backdrop-blur-sm"
                style={{
                  background: isDarkMode 
                    ? 'var(--color-surface)'
                    : 'var(--color-surface)',
                  borderColor: isDarkMode ? 'rgba(var(--color-primary-rgb), 0.5)' : 'rgba(var(--color-primary-rgb), 0.5)',
                  boxShadow: isDarkMode 
                    ? 'var(--elevation-xl)' 
                    : 'var(--elevation-xl)'
                }}
              >
                <table className="min-w-full text-left text-sm">
                  <thead 
                    className="uppercase text-xs font-bold shadow-lg"
                    style={{
                      background: isDarkMode ? 'var(--color-primary-light)' : 'var(--color-primary-light)',
                      color: isDarkMode ? 'var(--color-primary-text)' : 'var(--color-primary-text)'
                    }}
                  >
                    <tr className="border-b" style={{ borderColor: isDarkMode ? 'var(--color-primary-hover)' : 'rgba(var(--color-primary-rgb), 0.3)' }}>
                      <th className="px-6 py-4 w-[80px] text-center">
                        <div className="flex items-center justify-center">
                          <FaCamera className="w-4 h-4 mr-2" />
                          Preview
                        </div>
                      </th>
                      <th className="px-6 py-4">
                        <div className="flex items-center">
                          <FaFile className="w-4 h-4 mr-2" />
                          File Name
                        </div>
                      </th>
                      <th className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center">
                          <span className="w-2 h-2 bg-primary-soft rounded-full mr-2"></span>
                          Type
                        </div>
                      </th>
                      <th className="px-6 py-4 hidden sm:table-cell">
                        <div className="flex items-center">
                          <span className="text-xs">📏</span>
                          <span className="ml-2">Size</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 hidden lg:table-cell">
                        <div className="flex items-center">
                          <span className="text-xs">📅</span>
                          <span className="ml-2">Upload Date</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 w-[80px] text-center">
                        <div className="flex items-center justify-center">
                          <span className="text-xs">⚡</span>
                          <span className="ml-2">Action</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: isDarkMode ? 'rgba(var(--color-primary-rgb), 0.3)' : 'rgba(var(--color-primary-rgb), 0.5)' }}>
                    {mediaList.map((media, index) => (
                      <tr 
                        key={media.id} 
                        className="group hover:bg-transparent transition-all duration-300"
                        style={{
                          backgroundColor: index % 2 === 0 
                            ? 'var(--color-surface-hover)'
                            : 'var(--color-primary-lighter)'
                        }}
                      >
                        <td className="px-6 py-4 text-center">
                          <div 
                            className="relative w-16 h-16 mx-auto rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300 border-2"
                            style={{
                              background: isDarkMode 
                                ? 'var(--color-surface-active)'
                                : 'var(--color-surface-hover)',
                              borderColor: 'var(--color-border)',
                              boxShadow: isDarkMode 
                                ? '0 0 0 2px var(--color-primary-ring)'
                                : '0 0 0 2px var(--color-primary-ring)'
                            }}
                          >
                            {media.type && media.type.startsWith("image") ? (
                              <Image
                                src={media.url}
                                alt={media.name}
                                fill
                                className="object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <div 
                                className="flex items-center justify-center w-full h-full text-2xl"
                                style={{
                                  background: isDarkMode
                                    ? 'var(--color-primary-light)'
                                    : 'var(--color-primary-light)',
                                  color: isDarkMode ? 'var(--color-primary-text)' : 'var(--color-primary-text)'
                                }}
                              >
                                <FaFile className="drop-shadow-sm" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span 
                              className="font-semibold text-sm group-hover:text-[var(--color-primary)] dark:group-hover:text-primary-text transition-colors duration-200 truncate max-w-xs" 
                              title={media.name}
                              style={{ color: isDarkMode ? 'var(--color-text)' : 'var(--color-text)' }}
                            >
                              {media.name}
                            </span>
                            <span 
                              className="text-xs font-medium"
                              style={{ color: isDarkMode ? 'var(--color-primary-text)' : 'var(--color-primary-text)' }}
                            >
                              #{media.id}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span 
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border"
                            style={{
                              backgroundColor: isDarkMode ? 'rgba(var(--color-primary-rgb), 0.5)' : 'var(--color-primary-light)',
                              color: isDarkMode ? 'var(--color-primary-text)' : 'var(--color-primary-text)',
                              borderColor: isDarkMode ? 'var(--color-primary)' : 'var(--color-primary)'
                            }}
                          >
                            {media.type.split('/')[0].toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span 
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border"
                            style={{
                              backgroundColor: 'var(--color-surface-hover)',
                              color: 'var(--color-text-secondary)',
                              borderColor: 'var(--color-border)'
                            }}
                          >
                            <span className="mr-1">💾</span>
                            {media.size}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="flex flex-col">
                            <span 
                              className="text-xs font-medium"
                              style={{ color: isDarkMode ? 'var(--color-text)' : 'var(--color-text)' }}
                            >
                              {new Date(media.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: '2-digit'
                              })}
                            </span>
                            <span 
                              className="text-xs"
                              style={{ color: isDarkMode ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
                            >
                              {new Date(media.createdAt).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDelete(media.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-error hover:bg-error text-white shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-110 hover:rotate-12 group-hover:shadow-red-500/50"
                            title="Delete File"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {mediaList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-20">
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <div 
                              className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                              style={{
                                background: isDarkMode
                                  ? 'var(--color-primary)'
                                  : 'var(--color-primary-light)'
                              }}
                            >
                              <FaCamera 
                                className="w-8 h-8" 
                                style={{ color: isDarkMode ? 'var(--color-primary-text)' : 'var(--color-primary-text)' }}
                              />
                            </div>
                            <div className="text-center">
                              <h3 
                                className="text-xl font-bold mb-2"
                                style={{ color: isDarkMode ? 'var(--color-text)' : 'var(--color-text)' }}
                              >
                                No Media Files Yet
                              </h3>
                              <p 
                                className="max-w-md"
                                style={{ color: isDarkMode ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
                              >
                                Your gallery is empty. Upload some images or files to get started with your media collection.
                              </p>
                            </div>
                            <button
                              onClick={() => setShowModal(true)}
                              className="mt-4 inline-flex items-center px-6 py-3 bg-[var(--color-success-light)] hover:bg-primary-soft text-[var(--color-primary-dark)] font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                            >
                             
                              Upload Your First File
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 z-50 transition-all duration-300"
          style={{ 
            background: isDarkMode 
              ? 'color-mix(in oklab, var(--color-primary-dark) 85%, transparent)' 
              : 'color-mix(in oklab, var(--color-primary-dark) 85%, transparent)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            className="bg-surface dark:bg-surface-raised p-8 rounded-2xl shadow-2xl w-full max-w-md transform scale-100 transition-all duration-300 border border-[rgba(var(--color-primary-rgb),0.3)] dark:border-primary"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex justify-between items-center mb-6 border-b border-[rgba(var(--color-primary-rgb),0.3)] dark:border-primary pb-3">
              <h2 className="text-2xl font-bold text-foreground dark:text-white flex items-center">
                <FaUpload className="mr-3 text-[var(--color-primary-dark)] dark:text-primary-text" /> Upload New File
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-[var(--color-primary-dark)] dark:hover:text-primary-text transition-colors p-1 rounded-full hover:bg-[var(--color-success-light)] dark:hover:bg-primary-light/20">
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <label className="block mb-2 font-medium text-secondary-foreground dark:text-foreground">File Name</label>
            <input
              type="text"
              value={photoName}
              onChange={(e) => setPhotoName(e.target.value)}
              placeholder="Enter a descriptive file name"
              className="w-full border border-border-strong dark:border-border focus:border-primary focus:ring-2 focus:ring-primary-soft dark:focus:ring-primary-soft/30 px-4 py-3 rounded-lg mb-4 bg-surface dark:bg-surface-active text-foreground dark:text-white transition placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
              style={{ 
                color: isDarkMode ? 'var(--color-text)' : 'var(--color-text)',
                backgroundColor: 'var(--color-surface)'
              }}
            />

            <label className="block mb-4 font-medium text-secondary-foreground dark:text-foreground">
              Select File
              <input 
                type="file" 
                onChange={handleFileChange} 
                className="mt-2 block w-full text-sm text-muted-foreground dark:text-secondary-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-success-light)] dark:file:bg-primary-light/30 file:text-[var(--color-primary)] dark:file:text-primary-text hover:file:bg-[var(--color-success-light)] dark:hover:file:bg-primary-hover/40 cursor-pointer" 
              />
            </label>
            
            {file && (
              <div className="text-sm text-[var(--color-primary)] dark:text-primary-text mb-4 p-4 bg-[var(--color-success-light)] dark:bg-primary-light/20 rounded-lg border border-[rgba(var(--color-primary-rgb),0.3)] dark:border-primary flex items-center shadow-sm">
                <FaFile className="mr-3 text-[var(--color-primary-dark)] dark:text-[var(--color-primary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium block">Selected:</span>
                  <span className="text-[var(--color-primary-dark)] dark:text-primary-text truncate block" title={file.name}>{file.name}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-primary-soft dark:border-primary">
              <button
                onClick={closeModal}
                className="px-6 py-2.5 rounded-lg border border-border-strong dark:border-border text-secondary-foreground dark:text-foreground hover:bg-surface-hover dark:hover:bg-surface-active hover:border-primary-soft dark:hover:border-[rgba(var(--color-primary-rgb),0.3)] transition-all font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || photoName.trim() === "" || isLoading}
                className="flex items-center bg-[var(--color-success-light)] hover:bg-primary-soft text-[var(--color-primary-dark)] px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold transform hover:scale-[1.02]"
              >
                {isLoading ? (
                  <FaSpinner className="animate-spin w-4 h-4 mr-2" />
                ) : (
                  <FaUpload className="mr-2" />
                )}
                {isLoading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}