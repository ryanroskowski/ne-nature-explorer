"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SpeciesAudio } from "@/lib/types";

interface BirdAudioPlayerProps {
  audio: SpeciesAudio[];
  commonName: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  song: { label: "Song", icon: "🎵" },
  call: { label: "Call", icon: "🔊" },
  alarm: { label: "Alarm", icon: "⚠️" },
  drumming: { label: "Drumming", icon: "🥁" },
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseDuration(length: string): number {
  const parts = length.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

export default function BirdAudioPlayer({ audio, commonName }: BirdAudioPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  const current = audio[activeIndex];
  if (!current) return null;

  const typeInfo = TYPE_LABELS[current.type] || { label: current.type, icon: "🔊" };

  const getActiveAudio = () => audioRefs.current[activeIndex];

  const togglePlay = useCallback(() => {
    const el = getActiveAudio();
    if (!el) return;

    if (isPlaying) {
      el.pause();
    } else {
      setError(null);
      setIsLoading(true);
      el.play().catch(() => {
        setError("Unable to play audio");
        setIsLoading(false);
      });
    }
  }, [isPlaying, activeIndex]);

  const switchTrack = useCallback((index: number) => {
    if (index === activeIndex) return;
    // Pause current track
    const el = getActiveAudio();
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setActiveIndex(index);
    setIsPlaying(false);
    setCurrentTime(0);
    setError(null);
    // Read duration from new track's audio element
    const newEl = audioRefs.current[index];
    setDuration(newEl && isFinite(newEl.duration) ? newEl.duration : 0);
  }, [activeIndex]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = getActiveAudio();
    const bar = progressRef.current;
    if (!el || !bar) return;

    let dur = el.duration;
    if (!isFinite(dur)) {
      dur = parseDuration(audio[activeIndex].length);
    }
    if (dur <= 0) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * dur;
  }, [activeIndex, audio]);

  // Attach event listeners to the active audio element
  useEffect(() => {
    const el = getActiveAudio();
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setIsLoading(false);
    };
    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      setError("Unable to load audio");
      setIsLoading(false);
      setIsPlaying(false);
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    // If already loaded, grab the duration
    if (isFinite(el.duration)) {
      setDuration(el.duration);
    }

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [activeIndex]);

  const parsedDuration = parseDuration(current.length);
  const effectiveDuration = duration > 0 ? duration : parsedDuration;
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Track selector tabs (if multiple recordings) */}
      {audio.length > 1 && (
        <div className="flex border-b border-border">
          {audio.map((track, i) => {
            const info = TYPE_LABELS[track.type] || { label: track.type, icon: "🔊" };
            return (
              <button
                key={track.xenoCantoId}
                onClick={() => switchTrack(i)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-ui transition-colors ${
                  i === activeIndex
                    ? "bg-forest/10 text-forest border-b-2 border-forest -mb-px"
                    : "text-text-secondary hover:text-text-primary hover:bg-background-alt"
                }`}
              >
                <span>{info.icon}</span>
                <span>{info.label}</span>
                <span className="text-xs text-text-muted">({track.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Player area */}
      <div className="p-4 sm:p-5">
        {/* Play button + progress */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!!error}
            className="w-11 h-11 shrink-0 rounded-full bg-forest text-white flex items-center justify-center hover:bg-forest/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            {/* Progress bar */}
            <div
              ref={progressRef}
              onClick={handleSeek}
              className="h-2 bg-border rounded-full cursor-pointer group relative"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-forest rounded-full transition-[width] duration-100 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-forest rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Time display */}
            <div className="flex justify-between mt-1 text-xs text-text-muted font-ui">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-rose font-ui">{error}</p>
        )}

        {/* Attribution */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-text-muted font-ui leading-relaxed">
            <span className="inline-flex items-center gap-1">
              {typeInfo.icon} {commonName} {typeInfo.label.toLowerCase()}
            </span>
            {" · "}
            Recording by{" "}
            <a
              href={current.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest hover:underline"
            >
              {current.recordist}
            </a>
            {" · "}
            <a
              href="https://xeno-canto.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest hover:underline"
            >
              Xeno-canto
            </a>
            {" · "}
            <a
              href={current.license}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest hover:underline"
            >
              CC License
            </a>
          </p>
        </div>
      </div>

      {/* All audio elements — preloaded in parallel */}
      {audio.map((track, i) => (
        <audio
          key={track.xenoCantoId}
          ref={(el) => { audioRefs.current[i] = el; }}
          src={`/api/audio-proxy?url=${encodeURIComponent(track.audioUrl)}`}
          preload="auto"
        />
      ))}
    </div>
  );
}
