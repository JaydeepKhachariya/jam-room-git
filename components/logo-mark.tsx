import { cn } from "@/lib/utils";

/**
 * The Jam Rooms mark. It is the favicon file itself (`app/icon.svg`),
 * so the sidebar and the browser tab can never drift apart.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny SVG
    <img
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    />
  );
}
