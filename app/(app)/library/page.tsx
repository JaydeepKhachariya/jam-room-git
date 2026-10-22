import type { Metadata } from "next";

import { LibraryView } from "@/components/pages/library-view";

export const metadata: Metadata = { title: "Library · Jam Rooms" };

export default function LibraryPage() {
  return <LibraryView />;
}
