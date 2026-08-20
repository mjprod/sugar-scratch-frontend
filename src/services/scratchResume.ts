import { loadGameSession } from "@/features/game/modules/gameSession";
import { PACK_PHOTOS } from "@/lib/photos";
import {
  listReadyToScratch,
  type ReadyScratchGroup,
} from "@/services/readyToScratch";

/** Unfinished Photo Scratch items for Collection / Ready to Scratch. */
export function listReadyPhotoScratch(): ReadyScratchGroup[] {
  const session = loadGameSession();
  if (!session) return [];
  if (session.phase !== "photo_reveal" && session.phase !== "photo") {
    return [];
  }
  const remaining = session.wonPhotoIds.filter(
    (id) => !session.completedPhotoIds.includes(id),
  );
  if (remaining.length === 0) return [];
  const pack = session.packScratch;
  return [
    {
      id: `photo:${pack?.readyPackId ?? "session"}`,
      creatorId: pack?.creator
        ? pack.creator.trim().toLowerCase().replace(/\s+/g, "-")
        : "photo",
      creatorName: pack?.creator ?? "Photo Cards",
      collectionName: pack?.packName ?? "Photo Cards",
      count: remaining.length,
      coverUrl: pack?.coverUrl ?? PACK_PHOTOS.ep1,
      kind: "photo",
    },
  ];
}

export function listAllReadyScratch(): ReadyScratchGroup[] {
  return [...listReadyToScratch(), ...listReadyPhotoScratch()];
}
