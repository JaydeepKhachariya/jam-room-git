"use client";

import { useSyncExternalStore } from "react";

/**
 * A value kept in localStorage and shared live between components and
 * tabs. Falls back to memory when storage is unavailable (private mode).
 */
export function createLocalStore<T>(
  key: string,
  parse: (value: unknown) => T,
  fallback: T
) {
  const changeEvent = `jam-rooms:store:${key}`;
  let memory: string | null = null;
  // Snapshots must be stable between reads, so parse once per raw value.
  let cachedRaw: string | null | undefined;
  let cached = fallback;

  function readRaw() {
    try {
      return window.localStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  }

  function read(): T {
    const raw = readRaw();
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    try {
      cached = raw === null ? fallback : parse(JSON.parse(raw));
    } catch {
      cached = fallback;
    }
    return cached;
  }

  function write(value: T) {
    const raw = JSON.stringify(value);
    memory = raw;
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      // Storage full or unavailable: keep it for this page load.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(changeEvent, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(changeEvent, onChange);
    };
  }

  return {
    read,
    write,
    update(change: (value: T) => T) {
      write(change(read()));
    },
    useValue() {
      return useSyncExternalStore(subscribe, read, () => fallback);
    },
  };
}
