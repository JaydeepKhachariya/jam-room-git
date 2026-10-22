"use client";

import { FormEvent, useState } from "react";
import { Users } from "lucide-react";

import { FormCard, TextField } from "@/components/form-card";
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
    <FormCard
      icon={<Users className="size-4" />}
      title={`Join ${roomName}`}
      description="Everyone in the room hears the same song at the same time."
      onSubmit={handleSubmit}
      submitLabel="Join room"
      submitDisabled={!name.trim()}
    >
      <TextField
        id="join-name"
        label="Your name"
        hint="Shown to everyone in the room."
        value={name}
        onChange={setName}
        placeholder="How others see you"
        maxLength={MEMBER_NAME_MAX}
        autoComplete="nickname"
        autoFocus
        required
      />
    </FormCard>
  );
}
