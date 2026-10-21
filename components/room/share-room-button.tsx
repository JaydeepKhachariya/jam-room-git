"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Copies the room's link so others can join. */
export function ShareRoomButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleClick() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The clipboard needs a secure context (HTTPS or localhost).
      window.prompt("Copy this link to invite others:", url);
    }
  }

  return (
    <Button onClick={handleClick} className="self-start sm:self-auto">
      {copied ? (
        <Check data-icon="inline-start" />
      ) : (
        <Link2 data-icon="inline-start" />
      )}
      {copied ? "Link copied" : "Copy invite link"}
    </Button>
  );
}
