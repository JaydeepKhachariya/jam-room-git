"use client";

import { memo, useId, useMemo, useState, type CSSProperties } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AudioLines, GripVertical, X } from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { formatTime } from "@/lib/format";
import type { QueueEntry } from "@/lib/queue";
import { cn } from "@/lib/utils";

// Created once: a new array each render would re-render every row.
const DRAG_MODIFIERS = [restrictToVerticalAxis, restrictToFirstScrollableAncestor];

interface QueueListProps<T extends QueueEntry> {
  queue: T[];
  currentIndex: number;
  playing: boolean;
  emptyText: string;
  /** Extra detail after the artists, e.g. who added the song. */
  detail?: (entry: T) => string;
  /** False in a host-only room you don't host: no reorder, jump or remove. */
  editable?: boolean;
  onJump: (queueId: string) => void;
  onRemove: (queueId: string) => void;
  /** Puts `queueId` just after `afterQueueId`, or first when null. */
  onMove: (queueId: string, afterQueueId: string | null) => void;
  className?: string;
}

/** A queue you can reorder by dragging (or with the keyboard). */
export function QueueList<T extends QueueEntry>({
  queue,
  currentIndex,
  playing,
  emptyText,
  detail,
  editable = true,
  onJump,
  onRemove,
  onMove,
  className,
}: QueueListProps<T>) {
  const dndId = useId();
  const sensors = useSensors(
    // A few pixels of travel before dragging, so the handle can be clicked.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // A dropped song stays where it was dropped until the queue changes
  // (a room's update can take a moment to come back).
  const [dropped, setDropped] = useState<{ base: T[]; order: T[] } | null>(
    null
  );
  const shown = dropped?.base === queue ? dropped.order : queue;

  const itemIds = useMemo(() => shown.map((entry) => entry.queueId), [shown]);

  const currentQueueId = queue[currentIndex]?.queueId;
  const shownCurrentIndex = shown.findIndex(
    (entry) => entry.queueId === currentQueueId
  );

  function titleOf(queueId: unknown) {
    return shown.find((entry) => entry.queueId === queueId)?.title ?? "Song";
  }

  function positionOf(queueId: unknown) {
    return shown.findIndex((entry) => entry.queueId === queueId) + 1;
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = shown.findIndex((entry) => entry.queueId === active.id);
    const to = shown.findIndex((entry) => entry.queueId === over.id);
    if (from === -1 || to === -1) return;

    const order = arrayMove(shown, from, to);
    setDropped({ base: queue, order });
    onMove(order[to].queueId, to === 0 ? null : order[to - 1].queueId);
  }

  if (queue.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={DRAG_MODIFIERS}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${titleOf(active.id)} is at position ${positionOf(over.id)} of ${shown.length}.`
              : `${titleOf(active.id)} is no longer over the queue.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `Moved ${titleOf(active.id)} to position ${positionOf(over.id)}.`
              : `${titleOf(active.id)} was dropped back in place.`,
          onDragCancel: ({ active }) =>
            `Moving ${titleOf(active.id)} was cancelled.`,
        },
      }}
    >
      <SortableContext
        items={itemIds}
        strategy={verticalListSortingStrategy}
        disabled={!editable}
      >
        <ol className={cn("flex flex-col gap-0.5", className)}>
          {shown.map((entry, index) => (
            <QueueRow
              key={entry.queueId}
              entry={entry}
              isCurrent={index === shownCurrentIndex}
              played={index < shownCurrentIndex}
              playing={playing}
              detail={detail?.(entry)}
              editable={editable}
              onJump={onJump}
              onRemove={onRemove}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

const QueueRow = memo(function QueueRow({
  entry,
  isCurrent,
  played,
  playing,
  detail,
  editable,
  onJump,
  onRemove,
}: {
  entry: QueueEntry;
  isCurrent: boolean;
  played: boolean;
  playing: boolean;
  detail?: string;
  editable: boolean;
  onJump: (queueId: string) => void;
  onRemove: (queueId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.queueId });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const artists = entry.artists.join(", ");

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/row relative flex items-center gap-2.5 rounded-lg py-1.5 pr-1 pl-1",
        isCurrent ? "bg-secondary" : "hover:bg-secondary/60",
        played && !isDragging && "opacity-50",
        // Solid while lifted, so the rows it passes over don't show through.
        isDragging && "z-10 bg-secondary shadow-lg ring-1 ring-zinc-700"
      )}
    >
      {editable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${entry.title}`}
          className="relative z-10 flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-500 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : (
        <span className="w-1" />
      )}

      <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        <SongThumbnail
          src={entry.thumbnail}
          label={entry.title}
          iconClassName="text-sm"
        />
        {isCurrent && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
            <AudioLines className={cn("size-4", playing && "animate-pulse")} />
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate font-medium">{entry.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {detail ? `${artists} · ${detail}` : artists}
        </span>
      </span>

      {entry.duration && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTime(entry.duration)}
        </span>
      )}

      {editable && (
        <>
          <button
            type="button"
            onClick={() => onJump(entry.queueId)}
            aria-label={`Play ${entry.title} by ${artists}`}
            aria-current={isCurrent || undefined}
            className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            type="button"
            aria-label={`Remove ${entry.title} from the queue`}
            onClick={() => onRemove(entry.queueId)}
            className="relative flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        </>
      )}
    </li>
  );
});
