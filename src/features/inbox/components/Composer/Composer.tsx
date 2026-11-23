/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { EmojiClickData } from "emoji-picker-react";
import { FileText, Image as ImageIcon, LayoutTemplate, Mic, Paperclip, SendHorizontal, Smile, Square, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import styles from "./Composer.module.css";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface ComposerProps {
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedGalleryMedia: any;
  setSelectedGalleryMedia: (m: any) => void;
  audioBlob: Blob | null;
  setAudioBlob: (b: Blob | null) => void;
  recordingTime: number;
  setRecordingTime: (t: number) => void;
  finalRecordingTimeRef: React.MutableRefObject<number>;
  formatTime: (s: number) => string;
  isRecording: boolean;
  cancelRecording: () => void;
  stopRecording: () => void;
  startRecording: () => void;
  isWindowOpenFromAPI: boolean;
  showAttachMenu: boolean;
  setShowAttachMenu: React.Dispatch<React.SetStateAction<boolean>>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowGalleryPicker: (b: boolean) => void;
  setShowTemplateSelector: (b: boolean) => void;
  register: any;
  setValue: (name: "message", value: string) => void;
  handleSend: () => void;
  messageValue: string;
  sendMessageMutation: any;
  isSendingMedia: boolean;
}

export const Composer = ({
  selectedFile,
  setSelectedFile,
  fileInputRef,
  selectedGalleryMedia,
  setSelectedGalleryMedia,
  audioBlob,
  setAudioBlob,
  recordingTime,
  setRecordingTime,
  finalRecordingTimeRef,
  formatTime,
  isRecording,
  cancelRecording,
  stopRecording,
  startRecording,
  isWindowOpenFromAPI,
  showAttachMenu,
  setShowAttachMenu,
  handleFileSelect,
  setShowGalleryPicker,
  setShowTemplateSelector,
  register,
  setValue,
  handleSend,
  messageValue,
  sendMessageMutation,
  isSendingMedia,
}: ComposerProps) => {
  const { resolvedTheme } = useTheme();
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const { ref: registerRef, ...messageField } = register("message");
  const hasContent = !!(messageValue?.trim() || selectedFile || audioBlob || selectedGalleryMedia);
  const isSending = sendMessageMutation.isPending || isSendingMedia;
  const windowClosed = !isWindowOpenFromAPI;

  // Auto-grow the textarea with its content (and shrink after send/reset)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [messageValue]);

  // Close the emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const onDown = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showEmoji]);

  const insertEmoji = (data: EmojiClickData) => {
    const el = textareaRef.current;
    const current = messageValue || "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + data.emoji + current.slice(end);
    setValue("message", next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + data.emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className={styles.composer}>
      {/* Previews */}
      {(selectedFile || selectedGalleryMedia || audioBlob || isRecording) && (
        <div className={styles.previews}>
          {selectedFile && (
            <div className={styles.preview}>
              <span className={styles.previewThumb}>
                <FileText size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn(styles.previewTitle, "truncate")}>{selectedFile.name}</p>
                <p className={styles.previewMeta}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <IconButton
                aria-label="Remove attachment"
                size="sm"
                icon={<X size={16} />}
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
            </div>
          )}

          {selectedGalleryMedia && (
            <div className={styles.preview}>
              <span className={styles.previewThumb}>
                {selectedGalleryMedia.type?.startsWith("image/") ? (
                  <img src={selectedGalleryMedia.url} alt={selectedGalleryMedia.name} />
                ) : (
                  <FileText size={18} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn(styles.previewTitle, "truncate")}>{selectedGalleryMedia.name}</p>
                <p className={styles.previewMeta}>From gallery · {selectedGalleryMedia.size}</p>
              </div>
              <IconButton
                aria-label="Remove media"
                size="sm"
                icon={<X size={16} />}
                onClick={() => setSelectedGalleryMedia(null)}
              />
            </div>
          )}

          {audioBlob && (
            <div className={styles.preview}>
              <span className={styles.previewThumb}>
                <Mic size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={styles.previewTitle}>Voice message</p>
                <p className={styles.previewMeta}>{formatTime(finalRecordingTimeRef.current || recordingTime)}</p>
              </div>
              <IconButton
                aria-label="Discard voice message"
                size="sm"
                icon={<X size={16} />}
                onClick={() => {
                  setAudioBlob(null);
                  setRecordingTime(0);
                }}
              />
            </div>
          )}

          {isRecording && (
            <div className={cn(styles.preview, styles.recording)}>
              <span className={styles.recordingDot} aria-hidden />
              <span className={styles.recordingText}>Recording… {formatTime(recordingTime)}</span>
              <Button size="sm" variant="ghost" onClick={cancelRecording}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" leftIcon={<Square size={12} />} onClick={stopRecording}>
                Stop
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Attach menu */}
      {showAttachMenu && (
        <div className={cn(styles.popover, "attach-menu")}>
          <div className={styles.menu} role="menu">
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                fileInputRef.current?.click();
                setShowAttachMenu(false);
              }}
            >
              <span className={styles.menuIcon}>
                <Upload size={15} />
              </span>
              Upload file
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                setShowAttachMenu(false);
                setShowGalleryPicker(true);
              }}
            >
              <span className={styles.menuIcon}>
                <ImageIcon size={15} />
              </span>
              From gallery
            </button>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div ref={emojiRef} className={cn(styles.popover, styles.emoji)}>
          <EmojiPicker
            onEmojiClick={insertEmoji}
            theme={(resolvedTheme === "dark" ? "dark" : "light") as any}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            width={320}
            height={380}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        onChange={handleFileSelect}
      />

      <div className={styles.bar}>
        <div className={cn(styles.field, windowClosed && styles.fieldDisabled)}>
          <IconButton
            aria-label="Emoji"
            className={styles.tool}
            round
            disabled={windowClosed || isRecording}
            active={showEmoji}
            icon={<Smile size={20} />}
            onClick={() => setShowEmoji((v) => !v)}
          />
          <IconButton
            aria-label="Attach"
            className={cn(styles.tool, "attach-button")}
            round
            disabled={windowClosed}
            active={showAttachMenu}
            icon={<Paperclip size={19} />}
            onClick={() => setShowAttachMenu(!showAttachMenu)}
          />

          <textarea
            {...messageField}
            ref={(el) => {
              registerRef(el);
              textareaRef.current = el;
            }}
            rows={1}
            className={styles.textarea}
            aria-label="Message"
            placeholder={windowClosed ? "24-hour window closed — send a template to reply" : "Type a message"}
            disabled={isRecording || windowClosed}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <IconButton
            aria-label="Send a template"
            className={cn(styles.tool, windowClosed && styles.toolHighlight)}
            round
            icon={<LayoutTemplate size={19} />}
            onClick={() => setShowTemplateSelector(true)}
          />
        </div>

        {hasContent ? (
          <button
            type="button"
            className={styles.send}
            onClick={handleSend}
            disabled={isSending || windowClosed}
            aria-label="Send message"
          >
            {isSending ? <span className={styles.sendSpinner} aria-hidden /> : <SendHorizontal size={19} />}
          </button>
        ) : (
          <button
            type="button"
            className={cn(styles.send, isRecording && styles.sendRecording)}
            disabled={windowClosed}
            onClick={() => {
              if (windowClosed) return;
              if (isRecording) stopRecording();
              else startRecording();
            }}
            aria-label={windowClosed ? "Voice messages are unavailable until the customer replies" : isRecording ? "Stop recording" : "Record voice message"}
            title={windowClosed ? "Please wait for the customer to reply (24h window)" : isRecording ? "Stop recording" : "Voice message"}
          >
            {isRecording ? <Square size={16} /> : <Mic size={19} />}
          </button>
        )}
      </div>
    </div>
  );
};
