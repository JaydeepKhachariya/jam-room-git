"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Library, Search, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/rooms", label: "Rooms", icon: Users },
  { href: "/library", label: "Library", icon: Library },
];

function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

interface NavLinksProps {
  /** Icon-only, for the narrow top bar. */
  compact?: boolean;
}

function Links({ compact, pathname }: NavLinksProps & { pathname: string | null }) {
  return NAV_ITEMS.map(({ href, label, icon: Icon }) => {
    const active = isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={compact ? label : undefined}
        className={cn(
          "flex items-center rounded-lg font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "size-9 justify-center" : "h-10 gap-3 px-3",
          active
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        )}
      >
        <Icon className="size-4" />
        {!compact && label}
      </Link>
    );
  });
}

function ActiveLinks(props: NavLinksProps) {
  return <Links {...props} pathname={usePathname()} />;
}

/**
 * The main navigation. Reading the path suspends on room pages (their id
 * isn't known while prerendering), so the links show unhighlighted until
 * it resolves rather than holding up the page.
 */
export function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<Links {...props} pathname={null} />}>
      <ActiveLinks {...props} />
    </Suspense>
  );
}
