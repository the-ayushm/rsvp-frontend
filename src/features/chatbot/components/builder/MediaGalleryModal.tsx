/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";

export default function MediaGalleryModal({ onSelect, onClose }: { onSelect: (url: string) => void, onClose: () => void }) {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/gallery/list") // Your existing API
      .then(res => res.json())
      .then(data => {
        // Filter to only show images if your media table has mixed types
        const onlyImages = Array.isArray(data) ? data.filter(m => m.type.startsWith('image/')) : [];
        setImages(onlyImages);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
<div
  className="
    bg-surface dark:bg-surface
    border border-border dark:border-border
    w-full max-w-6xl
    h-[80vh]
    rounded-2xl
    shadow-2xl
    overflow-hidden
    flex flex-col
  "
>
        <div className="p-4 border-b border-border-strong flex justify-between items-center bg-[var(--neutral-900)]/50">
          <h3 className="text-white font-semibold">Select Image from Gallery</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 ">
          {loading ? (
            <div className="col-span-full py-20 flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-[var(--color-primary)]" />
              <p className="text-muted-foreground text-sm">Loading media...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <p className="text-muted-foreground">No images found in your gallery.</p>
            </div>
          ) : (
            images.map((img) => (
              <div 
                key={img.id} 
                onClick={() => { onSelect(img.url); onClose(); }}
                className="group relative aspect-square rounded-lg border-2 border-transparent hover:border-info cursor-pointer overflow-hidden bg-[var(--neutral-900)]"
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-[var(--color-primary)]/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                   <div className="bg-[var(--color-primary)] p-1.5 rounded-full text-primary-foreground shadow-lg"><Check size={16} /></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}