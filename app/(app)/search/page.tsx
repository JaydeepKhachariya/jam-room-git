import type { Metadata } from "next";

import { SearchView } from "@/components/pages/search-view";

export const metadata: Metadata = { title: "Search · Jam Rooms" };

export default function SearchPage() {
  return <SearchView />;
}
