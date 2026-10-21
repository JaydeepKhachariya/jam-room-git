"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { saveDisplayName, useDisplayName } from "@/hooks/use-display-name";
import { MEMBER_NAME_MAX, ROOM_NAME_MAX } from "@/lib/room";

export default function NewRoomPage() {
  const router = useRouter();
  const savedName = useDisplayName();
  // Null until edited, so the saved name can fill in after hydration.
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const name = nameInput ?? savedName ?? "";
  const defaultRoomName = name.trim() ? `${name.trim()}'s room` : "Jam Room";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim() || defaultRoomName }),
      });
      const data: { id?: string; error?: string } = await response.json();
      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Couldn't create the room.");
      }

      saveDisplayName(name.trim());
      router.push(`/rooms/${data.id}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Something went wrong.");
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>

        <Card>
          <form onSubmit={handleSubmit} className="contents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" />
                Start a room
              </CardTitle>
              <CardDescription>
                Share the link and everyone in the room hears the same song
                at the same time.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Your name
                <Input
                  value={name}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="How others see you"
                  maxLength={MEMBER_NAME_MAX}
                  autoComplete="nickname"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Room name
                <Input
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder={defaultRoomName}
                  maxLength={ROOM_NAME_MAX}
                />
              </label>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Couldn&apos;t create the room</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={creating || !name.trim()}
              >
                {creating && <Spinner data-icon="inline-start" />}
                {creating ? "Creating room" : "Create room"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
