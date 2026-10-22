import { Suspense } from "react";

import { RoomSkeleton, RoomView } from "@/components/room/room-view";

export default function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  // Params are request-time data, so they're read inside Suspense.
  return (
    <Suspense fallback={<RoomSkeleton />}>
      {params.then(({ id }) => (
        <RoomView roomId={id} />
      ))}
    </Suspense>
  );
}
