"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Users } from "lucide-react";

import { FormCard, SwitchField, TextField } from "@/components/form-card";
import { Logo } from "@/components/shell/sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { saveDisplayName, useDisplayName } from "@/hooks/use-display-name";
import { getClientToken } from "@/lib/client-token";
import { rememberRoom } from "@/lib/my-rooms";
import { CLIENT_HEADER, MEMBER_NAME_MAX, ROOM_NAME_MAX } from "@/lib/room";

const STEPS = [
  {
    title: "Create the room.",
    body: "You're the host and can remove people.",
  },
  {
    title: "Share the invite link.",
    body: "Friends join in one click, no account needed.",
  },
  {
    title: "Add songs together.",
    body: "Everything joins one queue that plays in sync.",
  },
];

export default function NewRoomPage() {
  const router = useRouter();
  const savedName = useDisplayName();
  // Null until edited, so the saved name can fill in after hydration.
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const name = nameInput ?? savedName ?? "";
  const defaultRoomName = `${name.trim() || "Your"}'s room`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError("");

    try {
      const finalName = roomName.trim() || defaultRoomName;
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Makes this browser the room's host.
          [CLIENT_HEADER]: getClientToken(),
        },
        body: JSON.stringify({ name: finalName, open }),
      });
      const data: { id?: string; error?: string } = await response.json();
      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Couldn't create the room.");
      }

      saveDisplayName(name.trim());
      rememberRoom(data.id, finalName);
      router.push(`/rooms/${data.id}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Something went wrong.");
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <Logo />
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </header>

      <main className="flex flex-1 justify-center px-6 py-14">
        <div className="flex w-full max-w-md flex-col gap-6">
          <FormCard
            icon={<Users className="size-4" />}
            title="Start a room"
            description="Share the link and everyone in the room hears the same song at the same time."
            onSubmit={handleSubmit}
            submitLabel={creating ? "Creating room" : "Create room"}
            submitDisabled={!name.trim()}
            pending={creating}
            cancelHref="/"
          >
            <TextField
              id="name"
              label="Your name"
              hint="Shown to everyone in the room."
              value={name}
              onChange={setNameInput}
              placeholder="Enter your name"
              maxLength={MEMBER_NAME_MAX}
              autoComplete="nickname"
              required
            />
            <TextField
              id="room"
              label="Room name"
              optional
              value={roomName}
              onChange={setRoomName}
              placeholder={defaultRoomName}
              maxLength={ROOM_NAME_MAX}
              autoComplete="off"
            />
            <SwitchField
              label="Let everyone add songs"
              description="Turn off to keep the queue host-only."
              checked={open}
              onChange={setOpen}
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Couldn&apos;t create the room</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </FormCard>

          <ol className="flex flex-col gap-3 px-1">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <span className="leading-normal text-muted-foreground">
                  <span className="font-medium text-foreground">{step.title}</span>{" "}
                  {step.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
}
