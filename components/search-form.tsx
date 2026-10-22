"use client";

import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface SearchFormProps {
  defaultValue?: string;
  onSearch: (query: string) => void;
  /** Shown as an × in the box while there's text. */
  onClear?: () => void;
  searching?: boolean;
  /** The white button style, for when search is the main action. */
  primary?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function SearchForm({
  defaultValue = "",
  onSearch,
  onClear,
  searching = false,
  primary = false,
  autoFocus = false,
  className,
}: SearchFormProps) {
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn("flex w-full max-w-md gap-2", className)}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search songs or artists"
          aria-label="Search songs or artists"
          maxLength={200}
          autoFocus={autoFocus}
          className="h-10 w-full rounded-lg border border-input bg-transparent pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && onClear && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              onClear();
            }}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={searching}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70",
          primary
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-input bg-secondary text-foreground hover:bg-accent"
        )}
      >
        {searching && <Spinner />}
        {searching ? "Searching" : "Search"}
      </button>
    </form>
  );
}
