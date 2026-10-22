import type { RoomMember } from "@/lib/room";

/** What each tab shares with Realtime Presence. */
export interface PresenceInfo {
  name: string;
  joinedAt: number;
}

/** One entry per person, however many tabs they have open. */
export function membersFrom(state: Record<string, PresenceInfo[]>): RoomMember[] {
  return Object.entries(state)
    .filter(([, tabs]) => tabs.length > 0)
    .map(([id, tabs]) => ({
      id,
      name: tabs[tabs.length - 1].name,
      joinedAt: Math.min(...tabs.map((tab) => tab.joinedAt)),
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}
