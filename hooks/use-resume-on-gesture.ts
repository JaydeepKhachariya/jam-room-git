"use client";

import { useEffect } from "react";

/**
 * Browsers block audio that starts without a user gesture. While
 * `blocked`, resume playback on the first click or key press.
 */
export function useResumeOnGesture(blocked: boolean, resume: () => void) {
  useEffect(() => {
    if (!blocked) return;

    function handleGesture(event: Event) {
      const target = event.target;
      // The player bar's own controls handle play/pause themselves.
      if (target instanceof Element && target.closest("[data-player-bar]")) {
        return;
      }
      resume();
    }

    document.addEventListener("click", handleGesture, true);
    document.addEventListener("keydown", handleGesture, true);

    return () => {
      document.removeEventListener("click", handleGesture, true);
      document.removeEventListener("keydown", handleGesture, true);
    };
  }, [blocked, resume]);
}
