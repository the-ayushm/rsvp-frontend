'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface WhatsAppMessage {
  headerImage?: string;
  headerVideo?: string;
  body: string;
  buttons?: Array<{
    text: string;
    type: string;
  }>;
  footer?: string;
  uploadedImageFile?: File; // For displaying newly uploaded images
  uploadedVideoFile?: File; // For displaying newly uploaded videos
  hasHeaderComponent?: boolean; // Whether template expects a header
}

interface WhatsAppMessagePreviewProps {
  message: WhatsAppMessage;
}

export default function WhatsAppMessagePreview({ message }: WhatsAppMessagePreviewProps) {
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [uploadedVideoPreview, setUploadedVideoPreview] = useState<string | null>(null);

  // Handle displaying uploaded image
  useEffect(() => {
    if (message.uploadedImageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(message.uploadedImageFile);
    } else {
      setUploadedImagePreview(null);
    }
  }, [message.uploadedImageFile]);

  // Handle displaying uploaded video
  useEffect(() => {
    if (message.uploadedVideoFile) {
      const objectUrl = URL.createObjectURL(message.uploadedVideoFile);
      setUploadedVideoPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setUploadedVideoPreview(null);
  }, [message.uploadedVideoFile]);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* WhatsApp-style message bubble */}
      <div className="rounded-2xl bg-gradient-to-b from-primary-lighter to-white border border-[rgba(var(--color-primary-rgb),0.3)] shadow-lg overflow-hidden">
        {/* Header Image/Video - Only show if uploaded or video */}
        {(uploadedImagePreview || uploadedVideoPreview || message.headerVideo) && (
          <div className="relative w-full h-48 bg-surface-active overflow-hidden rounded-t-2xl">
            {uploadedImagePreview && (
              <img
                src={uploadedImagePreview}
                alt="Header"
                className="w-full h-full object-cover"
              />
            )}
            {uploadedVideoPreview && (
              <video
                src={uploadedVideoPreview}
                className="w-full h-full object-cover"
                controls
              />
            )}
            {!uploadedVideoPreview && message.headerVideo && (
              <video
                src={message.headerVideo}
                className="w-full h-full object-cover"
                controls
              />
            )}
          </div>
        )}

        {/* Header Image Placeholder - Only show if template expects header but none uploaded */}
        {!uploadedImagePreview && !uploadedVideoPreview && !message.headerVideo && message.hasHeaderComponent && (
          <div className="relative w-full h-48 bg-border-strong overflow-hidden rounded-t-2xl flex items-center justify-center">
            <Plus className="w-16 h-16 text-muted-foreground" strokeWidth={1.5} />
          </div>
        )}

        {/* Body Content */}
        <div className="px-4 py-3">
          {/* Body Text */}
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {message.body}
          </p>

          {/* Footer */}
          {message.footer && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
              {message.footer}
            </p>
          )}
        </div>

        {/* Buttons */}
        {message.buttons && message.buttons.length > 0 && (
          <div className="px-4 py-2 bg-[var(--color-success-light)] border-t border-primary-soft space-y-2">
            {message.buttons.map((button, index) => (
              <button
                key={index}
                disabled
                className="w-full py-2 px-3 bg-gradient-to-b from-info to-info hover:from-info hover:to-info text-white text-sm font-medium rounded-full border border-info shadow-sm transition-all"
              >
                {button.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp branding footer */}
      <div className="text-center mt-2 text-xs text-muted-foreground">
        <p>WhatsApp Preview</p>
      </div>
    </div>
  );
}