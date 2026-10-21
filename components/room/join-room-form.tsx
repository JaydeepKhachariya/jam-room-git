"use client";

import { FormEvent, useState } from "react";
import { Users } from "lucide-react";

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
import { saveDisplayName } from "@/hooks/use-display-name";
import { MEMBER_NAME_MAX } from "@/lib/room";

/** Asks for a display name before joining a room for the first time. */
export function JoinRoomForm({ roomName }: { roomName: string }) {
  const [name, setName] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) saveDisplayName(name.trim());
  }

  return (
    <Card className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="contents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Join {roomName}
          </CardTitle>
          <CardDescription>
            Everyone in the room hears the same song at the same time.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Your name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="How others see you"
              maxLength={MEMBER_NAME_MAX}
              autoComplete="nickname"
              autoFocus
              required
            />
          </label>
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            Join room
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
