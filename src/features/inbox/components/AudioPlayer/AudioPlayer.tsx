"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./AudioPlayer.module.css";

interface AudioPlayerProps {
  src: string;
  timestamp?: string;
  statusComponent?: React.ReactNode;
  className?: string;
}

export function AudioPlayer({
  src,
  timestamp,
  statusComponent,
  className = "",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Format seconds to m:ss
  const formatTime = useCallback((timeInSeconds: number) => {
    if (!isFinite(timeInSeconds) || isNaN(timeInSeconds) || timeInSeconds < 0) {
      return "0:00";
    }
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);

  // Update duration safely (handling Chromium Infinity bug for recorded streams)
  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    if (isFinite(el.duration) && !isNaN(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    } else {
      // Workaround for Chromium MediaRecorder WebM/stream duration issue
      el.currentTime = 1e10;
      el.ontimeupdate = function () {
        if (el) {
          el.ontimeupdate = null;
          if (isFinite(el.duration) && el.duration > 0) {
            setDuration(el.duration);
          }
          el.currentTime = 0;
        }
      };
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (isDragging) return;
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);

    // If duration wasn't known initially, capture it once available
    if (duration === 0 && isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, [isDragging, duration]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = audioRef.current;
      if (!el) return;

      if (isPlaying) {
        el.pause();
        setIsPlaying(false);
      } else {
        el.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.error("Audio playback error:", err);
            setIsPlaying(false);
          });
      }
    },
    [isPlaying],
  );

  // Playback speed toggle: 1x -> 1.5x -> 2x -> 1x
  const toggleSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1, 1.5, 2];
    setPlaybackRate((prevRate) => {
      const nextRate = rates[(rates.indexOf(prevRate) + 1) % rates.length];
      if (audioRef.current) {
        audioRef.current.playbackRate = nextRate;
      }
      return nextRate;
    });
  }, []);

  // Scrub bar interaction
  const updateProgressFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current || !audioRef.current || !duration || duration <= 0)
        return;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
      const newTime = ratio * duration;
      setCurrentTime(newTime);
      audioRef.current.currentTime = newTime;
    },
    [duration],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateProgressFromEvent(e.clientX);
    },
    [updateProgressFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.stopPropagation();
      updateProgressFromEvent(e.clientX);
    },
    [isDragging, updateProgressFromEvent],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.stopPropagation();
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    },
    [isDragging],
  );

  // Sync playback rate if audio element remounts
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Compute progress percentage
  const progressPercent =
    duration > 0
      ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
      : 0;

  // Display time:
  // Before playing, show total duration if known (e.g. 0:05).
  // While playing or scrubbed, show current playback elapsed time (e.g. 0:02).
  const displayedTime =
    currentTime === 0 && duration > 0 && !isPlaying
      ? formatTime(duration)
      : formatTime(currentTime);

  return (
    <div className={cn(styles.player, className)} onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        className={styles.play}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
      </button>

      <div className={styles.body}>
        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={styles.track}
        >
          <div className={styles.rail}>
            <div className={styles.fill} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.knob} style={{ left: `${progressPercent}%` }} />
        </div>

        <div className={styles.metaRow}>
          <span>{displayedTime}</span>
          <span className={styles.metaRight}>
            {timestamp && <span className="time">{timestamp}</span>}
            {statusComponent && <span className="flex items-center">{statusComponent}</span>}
          </span>
        </div>
      </div>

      {isPlaying ? (
        <button type="button" onClick={toggleSpeed} title="Playback speed" className={styles.speed}>
          {playbackRate}×
        </button>
      ) : (
        <span className={styles.voiceIcon} aria-hidden>
          <Mic size={16} />
        </span>
      )}
    </div>
  );
}
