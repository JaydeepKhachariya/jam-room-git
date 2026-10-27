"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useResumeOnGesture } from "@/hooks/use-resume-on-gesture";
import {
  useYouTubePlayer,
  type PlayerStatus,
} from "@/hooks/use-youtube-player";
import {
  readPlaybackSession,
  writePlaybackSession,
  type RepeatMode,
} from "@/lib/playback-session";
import { moveInQueue, toLocalEntry, type LocalQueueEntry } from "@/lib/queue";
import { recordPlay } from "@/lib/interests";
import { isSong, type Song } from "@/lib/song";

/** Keeps the saved session small when a long list follows a pick. */
const MAX_QUEUE = 200;

export interface PersonalPlayer {
  queue: LocalQueueEntry[];
  queueIndex: number;
  current: LocalQueueEntry | null;
  status: PlayerStatus;
  /** Playing, or about to (buffering towards playback). */
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  autoplayBlocked: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string;
  hasNext: boolean;
  hasPrevious: boolean;
  /** Plays `songs[index]` now, with the songs after it following. */
  playFromList: (songs: Song[], index: number) => void;
  togglePlay: () => void;
  addToQueue: (song: Song) => void;
  jump: (queueId: string) => void;
  remove: (queueId: string) => void;
  move: (queueId: string, afterQueueId: string | null) => void;
  /** Drops everything after the current song. */
  clearUpcoming: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

interface Progress {
  currentTime: number;
  duration: number;
}

interface Shell {
  /** A room is open: it has its own player, so this one stays quiet. */
  roomActive: boolean;
  setRoomActive: (active: boolean) => void;
  /** Where a room renders its player bar. */
  footerSlot: HTMLElement | null;
  setFooterSlot: (element: HTMLElement | null) => void;
  /** The side panel, shown as a sheet on narrow screens. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PersonalPlayer | null>(null);
// Changes twice a second while playing, so it's kept apart from the rest.
const ProgressContext = createContext<Progress>({ currentTime: 0, duration: 0 });
const ShellContext = createContext<Shell | null>(null);

function required<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`${name} must be used inside <PlayerProvider>.`);
  return value;
}

export const usePlayer = () =>
  required(useContext(PlayerContext), "usePlayer");
export const usePlayerProgress = () => useContext(ProgressContext);
export const usePlayerShell = () =>
  required(useContext(ShellContext), "usePlayerShell");

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Your own player, outside rooms. It lives in the app shell, so music
 * keeps playing while you move between pages.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<LocalQueueEntry[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [error, setError] = useState("");

  const [roomActive, setRoomActive] = useState(false);
  const roomActiveRef = useRef(false);
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const current = queue[queueIndex] ?? null;
  const hasNext =
    queueIndex < queue.length - 1 || (repeat === "all" && queue.length > 0);
  const hasPrevious = queueIndex > 0;

  const player = useYouTubePlayer({
    onEnded: () => {
      if (repeat === "one") {
        player.seek(0);
        player.resume();
      } else {
        advance();
      }
    },
    onError: (message) => {
      // Never wraps around, so a queue where nothing plays can't loop.
      if (queueIndex < queue.length - 1) {
        playAt(queue, queueIndex + 1);
        setError(`${message} Skipped to the next track.`);
      } else {
        setError(message);
      }
    },
  });

  const {
    whenReady,
    load,
    pause,
    resume,
    setVolume,
    setMuted,
    autoplayBlocked,
    status,
    currentTime,
    duration,
    volume,
    muted,
  } = player;

  // Restore the last session after a reload: same queue, track and position.
  useEffect(() => {
    const saved = readPlaybackSession();
    if (!saved) return;

    let cancelled = false;

    void whenReady().then(() => {
      if (cancelled) return;
      setQueue(saved.queue);
      setQueueIndex(saved.index);
      setShuffle(saved.shuffle);
      setRepeat(saved.repeat);
      setVolume(saved.volume);
      setMuted(saved.muted);
      void load(saved.queue[saved.index].id, {
        startSeconds: saved.position,
        duration: saved.duration,
        // Opened straight into a room: that room does the playing.
        autoplay: saved.wasPlaying && !roomActiveRef.current,
        mayBeBlocked: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [whenReady, load, setVolume, setMuted]);

  // Keep the session saved so a reload can pick up where it left off.
  useEffect(() => {
    if (!current) return;

    writePlaybackSession({
      queue,
      index: queueIndex,
      position: currentTime,
      duration,
      volume,
      muted,
      // A blocked resume still counts as "playing": the user never paused it.
      wasPlaying:
        status === "playing" || status === "loading" || autoplayBlocked,
      shuffle,
      repeat,
    });
  }, [
    current,
    queue,
    queueIndex,
    currentTime,
    duration,
    volume,
    muted,
    status,
    autoplayBlocked,
    shuffle,
    repeat,
  ]);

  // A room has its own player: stop this one while it's open.
  useEffect(() => {
    roomActiveRef.current = roomActive;
    if (roomActive) pause();
  }, [roomActive, pause]);

  useResumeOnGesture(autoplayBlocked && !roomActive, resume);

  // Keep the queue stocked with songs like the current one, so playback
  // carries on in the same vein instead of stopping or wandering.
  const filledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!current || roomActive) return;
    if (queueIndex < queue.length - 2) return;
    if (filledRef.current === current.queueId) return;
    filledRef.current = current.queueId;

    const seed = current.queueId;
    fetch(`/api/radio?id=${encodeURIComponent(current.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { results?: unknown[] } | null) => {
        const related = (data?.results ?? []).filter(isSong);
        if (related.length === 0) return;

        setQueue((prev) => {
          // The queue was replaced while this loaded: these are stale.
          if (!prev.some((entry) => entry.queueId === seed)) return prev;
          const known = new Set(prev.map((entry) => entry.id));
          let added = related
            .filter((song) => !known.has(song.id))
            .map((song) => toLocalEntry(song));
          if (shuffle) added = shuffled(added);
          return [...prev, ...added].slice(0, MAX_QUEUE);
        });
      })
      .catch(() => {});
  }, [current, roomActive, queue.length, queueIndex, shuffle]);

  function playAt(
    nextQueue: LocalQueueEntry[],
    index: number,
    autoplay = true
  ) {
    const song = nextQueue[index];
    if (!song) return;
    setQueue(nextQueue);
    setQueueIndex(index);
    setError("");
    recordPlay(song);
    void load(song.id, { autoplay, duration: song.duration });
  }

  /** On to the next song; past the end only when repeating the queue. */
  function advance() {
    if (queueIndex < queue.length - 1) playAt(queue, queueIndex + 1);
    else if (repeat === "all") playAt(queue, 0);
  }

  function togglePlay() {
    if (!current) return;
    player.togglePlay();
  }

  function playFromList(songs: Song[], index: number) {
    const song = songs[index];
    if (!song) return;
    if (current?.id === song.id) {
      togglePlay();
      return;
    }

    // Songs added with "Add to queue" stay up next; after them the queue
    // fills with songs like this one (see the effect above), rather than
    // whatever happened to come next in the list it was picked from.
    const added = queue.slice(queueIndex + 1).filter((entry) => entry.manual);
    playAt([toLocalEntry(song), ...added], 0);
  }

  /** Lines a song up after the current one and anything added before it. */
  function addToQueue(song: Song) {
    const entry = toLocalEntry(song, true);
    if (!current) {
      playAt([entry], 0);
      return;
    }

    let at = queueIndex + 1;
    while (queue[at]?.manual) at++;
    setQueue(
      [...queue.slice(0, at), entry, ...queue.slice(at)].slice(0, MAX_QUEUE)
    );
  }

  function jump(queueId: string) {
    playAt(queue, queue.findIndex((entry) => entry.queueId === queueId));
  }

  function remove(queueId: string) {
    const index = queue.findIndex((entry) => entry.queueId === queueId);
    if (index === -1) return;
    const nextQueue = queue.filter((entry) => entry.queueId !== queueId);

    if (index < queueIndex) {
      setQueue(nextQueue);
      setQueueIndex(queueIndex - 1);
    } else if (index > queueIndex) {
      setQueue(nextQueue);
    } else if (nextQueue[index]) {
      // The current song was removed: go on to the one after it.
      playAt(nextQueue, index, status === "playing" || status === "loading");
    } else {
      player.stop();
      setQueue(nextQueue);
      setQueueIndex(-1);
    }
  }

  function move(queueId: string, afterQueueId: string | null) {
    // The panel lists from the current song on; its top is just after
    // the songs already played.
    const anchor =
      afterQueueId ?? (queueIndex > 0 ? queue[queueIndex - 1].queueId : null);
    const moved = moveInQueue(queue, queueId, anchor);
    if (!moved) return;
    setQueue(moved);
    // The current song keeps playing, wherever it ends up.
    if (current) {
      setQueueIndex(
        moved.findIndex((entry) => entry.queueId === current.queueId)
      );
    }
  }

  function clearUpcoming() {
    setQueue(queue.slice(0, queueIndex + 1));
  }

  function previous() {
    if (currentTime > 3 || !hasPrevious) player.seek(0);
    else playAt(queue, queueIndex - 1);
  }

  function toggleShuffle() {
    if (!shuffle) {
      setQueue([
        ...queue.slice(0, queueIndex + 1),
        ...shuffled(queue.slice(queueIndex + 1)),
      ]);
    }
    setShuffle(!shuffle);
  }

  function cycleRepeat() {
    setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off");
  }

  // Actions read the latest state through a ref, so they're stable and
  // the context only changes when the state it shows does.
  const actionsRef = useRef({
    playFromList,
    togglePlay,
    addToQueue,
    jump,
    remove,
    move,
    clearUpcoming,
    advance,
    previous,
    toggleShuffle,
    cycleRepeat,
  });
  useEffect(() => {
    actionsRef.current = {
      playFromList,
      togglePlay,
      addToQueue,
      jump,
      remove,
      move,
      clearUpcoming,
      advance,
      previous,
      toggleShuffle,
      cycleRepeat,
    };
  });
  const actions = useMemo(
    () => ({
      playFromList: (songs: Song[], index: number) =>
        actionsRef.current.playFromList(songs, index),
      togglePlay: () => actionsRef.current.togglePlay(),
      addToQueue: (song: Song) => actionsRef.current.addToQueue(song),
      jump: (queueId: string) => actionsRef.current.jump(queueId),
      remove: (queueId: string) => actionsRef.current.remove(queueId),
      move: (queueId: string, afterQueueId: string | null) =>
        actionsRef.current.move(queueId, afterQueueId),
      clearUpcoming: () => actionsRef.current.clearUpcoming(),
      next: () => actionsRef.current.advance(),
      previous: () => actionsRef.current.previous(),
      toggleShuffle: () => actionsRef.current.toggleShuffle(),
      cycleRepeat: () => actionsRef.current.cycleRepeat(),
    }),
    []
  );

  const value: PersonalPlayer = useMemo(
    () => ({
      queue,
      queueIndex,
      current,
      status,
      isPlaying: status === "playing" || status === "loading",
      volume,
      muted,
      autoplayBlocked,
      shuffle,
      repeat,
      error,
      hasNext,
      hasPrevious,
      ...actions,
      seek: player.seek,
      setVolume,
      toggleMute: player.toggleMute,
    }),
    [
      queue,
      queueIndex,
      current,
      status,
      volume,
      muted,
      autoplayBlocked,
      shuffle,
      repeat,
      error,
      hasNext,
      hasPrevious,
      actions,
      player.seek,
      setVolume,
      player.toggleMute,
    ]
  );

  const progress = useMemo(
    () => ({ currentTime, duration }),
    [currentTime, duration]
  );
  const shell = useMemo(
    () => ({
      roomActive,
      setRoomActive,
      footerSlot,
      setFooterSlot,
      panelOpen,
      setPanelOpen,
    }),
    [roomActive, footerSlot, panelOpen]
  );

  return (
    <ShellContext.Provider value={shell}>
      <PlayerContext.Provider value={value}>
        <ProgressContext.Provider value={progress}>
          {children}
        </ProgressContext.Provider>
      </PlayerContext.Provider>
    </ShellContext.Provider>
  );
}
