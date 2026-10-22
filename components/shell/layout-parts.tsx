"use client";

import type { ReactNode } from "react";

import { usePlayerShell } from "@/components/player/player-provider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** A page's scrolling main column. */
export function PageMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      data-scroll-root
      className="min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pt-6 pb-8 sm:px-8",
          className
        )}
      >
        {children}
      </div>
    </main>
  );
}

/**
 * The panel on the right (queue, room). Below 1280px it's a sheet,
 * opened from the player bar.
 */
export function SidePanel({
  label,
  children,
}: {
  /** Names the panel for screen readers. */
  label: string;
  children: ReactNode;
}) {
  const { panelOpen, setPanelOpen } = usePlayerShell();

  return (
    <>
      <aside
        aria-label={label}
        className="hidden w-[22rem] shrink-0 flex-col gap-4 overflow-y-auto border-l px-4 py-5 xl:flex"
      >
        {children}
      </aside>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent
          side="right"
          className="w-[22rem] max-w-[90vw] overflow-y-auto bg-background px-4 pt-12 pb-5 xl:hidden"
        >
          <SheetTitle className="sr-only">{label}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SectionHeader({
  title,
  action,
  as: Heading = "h2",
}: {
  title: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Heading className="min-w-0 truncate text-lg font-semibold tracking-tight">
        {title}
      </Heading>
      {action}
    </div>
  );
}
