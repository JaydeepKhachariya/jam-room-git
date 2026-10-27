import type { Metadata } from "next";

import { NowPlayingView } from "@/components/pages/now-playing-view";

export const metadata: Metadata = { title: "Now playing · Jam Rooms" };

export default function NowPlayingPage() {
  return <NowPlayingView />;
}
