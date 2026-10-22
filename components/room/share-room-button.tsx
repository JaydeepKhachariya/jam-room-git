"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Copies a room's link (this page's, by default) so others can join. */
export function ShareRoomButton({
  url,
  label = "Copy invite link",
  primary = false,
  className,
}: {
  url?: string;
  label?: string;
  /** White, rather than the quieter dark button. */
  primary?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleClick() {
    const link = url ?? window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // The clipboard needs a secure context (HTTPS or localhost).
      window.prompt("Copy this link to invite others:", link);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border bg-secondary hover:bg-accent",
        className
      )}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      <span aria-live="polite">{copied ? "Link copied" : label}</span>
    </button>
  );
}
