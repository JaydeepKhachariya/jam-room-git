import type { Metadata } from "next";

import { RoomsView } from "@/components/pages/rooms-view";

export const metadata: Metadata = { title: "Rooms · Jam Rooms" };

export default function RoomsPage() {
  return <RoomsView />;
}
