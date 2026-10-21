"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "jam-rooms:name";
const CHANGE_EVENT = "jam-rooms:name-change";

// Used when storage is unavailable (private mode), for this page load.
let memoryName: string | null = null;

function read() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryName;
  } catch {
    return memoryName;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The name shown to other listeners, remembered across visits. */
export function useDisplayName() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function saveDisplayName(name: string) {
  memoryName = name;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage unavailable — the in-memory name still works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
