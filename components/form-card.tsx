"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** A form in a bordered card: title, fields, and actions along the bottom. */
export function FormCard({
  icon,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  pending = false,
  cancelHref,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submitDisabled?: boolean;
  pending?: boolean;
  /** Shows a Cancel link back here. */
  cancelHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-md overflow-hidden rounded-xl border bg-card",
        className
      )}
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-secondary">
                {icon}
              </span>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            </div>
            <p className="leading-normal text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>

        <div className="flex gap-2 border-t px-6 py-4">
          {cancelHref && (
            <Link
              href={cancelHref}
              className="flex h-10 items-center rounded-lg border px-4 font-medium outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={submitDisabled || pending}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-accent disabled:text-zinc-500"
          >
            {pending && <Spinner />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TextField({
  id,
  label,
  optional = false,
  hint,
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-10 rounded-lg border border-input bg-transparent px-3 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        {...props}
      />
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}

export function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex h-[22px] w-10 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          checked ? "justify-end bg-primary" : "justify-start bg-accent"
        )}
      >
        <span
          className={cn(
            "size-[18px] rounded-full",
            checked ? "bg-background" : "bg-muted-foreground"
          )}
        />
      </button>
    </div>
  );
}
