"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the YouTube IFrame Player API
// https://developers.google.com/youtube/iframe_api_reference
interface YTVideoRequest {
  videoId: string;
  startSeconds?: number;
}

interface YTPlayer {
  loadVideoById(request: YTVideoRequest): void;
  cueVideoById(request: YTVideoRequest): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      height?: string | number;
      width?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

const ERROR_MESSAGES: Record<number, string> = {
  2: "This track has an invalid ID.",
  5: "This track can't be played in the browser.",
  100: "This track was removed or is private.",
  101: "This track isn't available for streaming here.",
  150: "This track isn't available for streaming here.",
};

// How long a resume attempt may take before we assume the browser
// blocked autoplay and fall back to a paused, ready-to-play state.
const AUTOPLAY_CHECK_MS = 4000;

let apiPromise: Promise<YTNamespace> | undefined;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = undefined;
      script.remove();
      reject(new Error("Couldn't load the player."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended";

interface UseYouTubePlayerOptions {
  onEnded?: () => void;
  onError?: (message: string) => void;
}

export interface LoadOptions {
  /** Position to start from, in seconds. */
  startSeconds?: number;
  /** Start playing immediately (true) or load paused (false). */
  autoplay?: boolean;
  /** Known duration, shown until the player reports its own. */
  duration?: number;
  /**
   * Playback wasn't started by a click (e.g. restoring after reload),
   * so the browser may block it. Falls back to paused if it does.
   */
  mayBeBlocked?: boolean;
}

/**
 * Audio-only playback backed by an off-screen YouTube player.
 * The player element lives outside the React tree because the
 * IFrame API replaces it with its own iframe.
 */
export function useYouTubePlayer({ onEnded, onError }: UseYouTubePlayerOptions = {}) {
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef<Promise<YTPlayer> | null>(null);
  const callbacksRef = useRef({ onEnded, onError });
  const volumeRef = useRef(80);
  const mutedRef = useRef(false);
  const autoplayTimerRef = useRef<number | undefined>(undefined);

  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [muted, setMutedState] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const statusRef = useRef<PlayerStatus>(status);
  // Last known position, for when the player can't report one: a cued
  // video reports 0 until it starts, wherever it was cued.
  const positionRef = useRef(0);
  // The iframe only reports its time every ~250ms; remember when the
  // reported value last changed so reads in between can extrapolate.
  const reportedRef = useRef({ time: -1, at: 0 });
  // Whether we last asked the player to play or to stay paused. It
  // buffers either way (seeking, cueing), but only buffering towards
  // playback is "loading".
  const wantPlayingRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = { onEnded, onError };
  }, [onEnded, onError]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;";
    const mount = document.createElement("div");
    host.appendChild(mount);
    document.body.appendChild(host);

    let cancelled = false;

    readyRef.current = loadYouTubeApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          const player = new YT.Player(mount, {
            height: 1,
            width: 1,
            playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
            events: {
              onReady: () => {
                if (cancelled) return;
                playerRef.current = player;
                resolve(player);
              },
              onStateChange: ({ data }) => {
                if (data === PLAYER_STATE.PLAYING) {
                  // A pause sent while it was buffering didn't take.
                  if (!wantPlayingRef.current) {
                    player.pauseVideo();
                    return;
                  }
                  window.clearTimeout(autoplayTimerRef.current);
                  setAutoplayBlocked(false);
                  setStatus("playing");
                  setDuration(player.getDuration());
                } else if (data === PLAYER_STATE.PAUSED) {
                  positionRef.current = player.getCurrentTime();
                  setCurrentTime(positionRef.current);
                  setStatus("paused");
                } else if (data === PLAYER_STATE.BUFFERING) {
                  setStatus(wantPlayingRef.current ? "loading" : "paused");
                } else if (data === PLAYER_STATE.UNSTARTED) {
                  // Reported mid-load too, so only final once paused.
                  if (!wantPlayingRef.current) setStatus("paused");
                } else if (data === PLAYER_STATE.CUED) {
                  setStatus("paused");
                } else if (data === PLAYER_STATE.ENDED) {
                  setStatus("ended");
                  callbacksRef.current.onEnded?.();
                }
              },
              onError: ({ data }) => {
                window.clearTimeout(autoplayTimerRef.current);
                setStatus("idle");
                callbacksRef.current.onError?.(
                  ERROR_MESSAGES[data] ?? "Playback failed."
                );
              },
            },
          });
        })
    );

    readyRef.current.catch((error: unknown) => {
      callbacksRef.current.onError?.(
        error instanceof Error ? error.message : "Playback failed."
      );
    });

    return () => {
      cancelled = true;
      window.clearTimeout(autoplayTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = null;
      host.remove();
    };
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      positionRef.current = player.getCurrentTime();
      setCurrentTime(positionRef.current);
      setDuration(player.getDuration());
    }, 500);

    return () => window.clearInterval(interval);
  }, [status]);

  // Note when each new time report arrives (see getCurrentTime).
  useEffect(() => {
    if (status !== "playing") return;

    const interval = window.setInterval(() => {
      const time = playerRef.current?.getCurrentTime() ?? -1;
      if (time !== reportedRef.current.time) {
        reportedRef.current = { time, at: performance.now() };
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [status]);

  /** Resolves once the player can accept commands. */
  const whenReady = useCallback(async () => {
    await readyRef.current;
  }, []);

  const load = useCallback(
    async (
      videoId: string,
      {
        startSeconds = 0,
        autoplay = true,
        duration: knownDuration = 0,
        mayBeBlocked = false,
      }: LoadOptions = {}
    ) => {
      window.clearTimeout(autoplayTimerRef.current);
      wantPlayingRef.current = autoplay;
      setAutoplayBlocked(false);
      setStatus(autoplay ? "loading" : "paused");
      positionRef.current = startSeconds;
      setCurrentTime(startSeconds);
      setDuration(knownDuration);

      const player = await readyRef.current;
      if (!player) return;

      player.setVolume(volumeRef.current);
      if (mutedRef.current) player.mute();
      else player.unMute();

      const request = { videoId, startSeconds };

      if (!autoplay) {
        player.cueVideoById(request);
        return;
      }

      player.loadVideoById(request);

      if (mayBeBlocked) {
        autoplayTimerRef.current = window.setTimeout(() => {
          if (statusRef.current === "playing" || !wantPlayingRef.current) {
            return;
          }
          setAutoplayBlocked(true);
          setStatus("paused");
        }, AUTOPLAY_CHECK_MS);
      }
    },
    []
  );

  /** Start playback if it isn't already running. */
  const resume = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    wantPlayingRef.current = true;
    player.playVideo();
  }, []);

  const pause = useCallback(() => {
    const player = playerRef.current;
    wantPlayingRef.current = false;
    // Paused on purpose, so it isn't waiting on autoplay any more.
    window.clearTimeout(autoplayTimerRef.current);
    setAutoplayBlocked(false);
    if (!player) return;

    player.pauseVideo();
    // Paused while buffering (loading, or after a seek), the player
    // stops without reporting it, which would leave it "loading".
    if (statusRef.current === "playing" || statusRef.current === "loading") {
      positionRef.current = player.getCurrentTime();
      setCurrentTime(positionRef.current);
      setStatus("paused");
    }
  }, []);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (status === "playing" || status === "loading") {
      pause();
    } else {
      if (status === "ended") player.seekTo(0, true);
      resume();
    }
  }, [status, pause, resume]);

  /**
   * The position as precisely as it's known: while playing, the player's
   * last report plus the time since. Otherwise the position it was
   * paused, cued or sought at.
   */
  const getCurrentTime = useCallback(() => {
    const player = playerRef.current;
    if (!player || statusRef.current !== "playing") return positionRef.current;

    const time = player.getCurrentTime();
    const reported = reportedRef.current;
    if (time !== reported.time) return time;
    // Cap it, in case playback stalled without a state change.
    return time + Math.min(performance.now() - reported.at, 1000) / 1000;
  }, []);

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    positionRef.current = seconds;
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((value: number) => {
    const player = playerRef.current;
    volumeRef.current = value;
    setVolumeState(value);
    player?.setVolume(value);

    if (value > 0 && mutedRef.current) {
      mutedRef.current = false;
      setMutedState(false);
      player?.unMute();
    }
  }, []);

  const setMuted = useCallback((value: boolean) => {
    const player = playerRef.current;
    mutedRef.current = value;
    setMutedState(value);
    if (value) player?.mute();
    else player?.unMute();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(!mutedRef.current);
  }, [setMuted]);

  const stop = useCallback(() => {
    wantPlayingRef.current = false;
    playerRef.current?.stopVideo();
    setStatus("idle");
    positionRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return {
    status,
    currentTime,
    duration,
    volume,
    muted,
    autoplayBlocked,
    whenReady,
    load,
    togglePlay,
    resume,
    pause,
    getCurrentTime,
    seek,
    setVolume,
    setMuted,
    toggleMute,
    stop,
  };
}
