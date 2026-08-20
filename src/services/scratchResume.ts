import {
  firstMissingMotionCardId,
  loadGameSession,
  photoPlayHref,
  motionPlayHref,
} from "@/features/game/modules/gameSession";
import { resolveInventoryCoverUrl } from "@/lib/photos";
import {
  getReadyToScratch,
  listReadyToScratch,
  type ReadyScratchGroup,
} from "@/services/readyToScratch";
import {
  listUnopenedGroups,
  peekUnopenedInstance,
} from "@/services/packInventory";
import type { UnopenedPack } from "@/services/collection";

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
      collectionName: pack?.packName
        ? `${pack.packName} · Photos`
        : "Photo Cards",
      count: remaining.length,
      coverUrl: resolveInventoryCoverUrl({
        coverUrl: pack?.coverUrl,
        packId: pack?.readyPackId,
        themeName: pack?.packName,
        creator: pack?.creator,
      }),
      kind: "photo",
    },
  ];
}

/**
 * Opened pack with unfinished Motion Scratch that isn't already in readyToScratch.
 * Covers mid-session Save & Exit when inventory write lagged.
 */
function listReadyMotionFromSession(): ReadyScratchGroup[] {
  const session = loadGameSession();
  if (!session || session.phase !== "motion") return [];
  const remaining = session.motionCardIds.filter(
    (id) => !session.completedMotionIds.includes(id),
  );
  if (remaining.length === 0) return [];
  const pack = session.packScratch;
  const packId = pack?.readyPackId;
  if (packId && getReadyToScratch(packId)) return [];
  return [
    {
      id: packId ?? `motion:${session.motionCardIds.join(",")}`,
      creatorId: pack?.creator
        ? pack.creator.trim().toLowerCase().replace(/\s+/g, "-")
        : "motion",
      creatorName: pack?.creator ?? "Motion Cards",
      collectionName: pack?.packName
        ? `${pack.packName} · Motion`
        : "Motion Cards",
      count: remaining.length,
      coverUrl: resolveInventoryCoverUrl({
        coverUrl: pack?.coverUrl,
        packId: pack?.readyPackId,
        themeName: pack?.packName,
        creator: pack?.creator,
      }),
      kind: "motion",
    },
  ];
}

/**
 * Unscratched Cards shelf:
 * - opened packs with unfinished Motion Scratch
 * - Photo Cards won but not yet photo-scratched
 *
 * Never includes sealed (unopened) packs.
 */
export function listAllReadyScratch(): ReadyScratchGroup[] {
  const motion = listReadyToScratch().map((group) => ({
    ...group,
    kind: "motion" as const,
    collectionName: group.collectionName.includes("Motion")
      ? group.collectionName
      : `${group.collectionName} · Motion`,
  }));
  const fromSession = listReadyMotionFromSession();
  const photos = listReadyPhotoScratch();
  return [...motion, ...fromSession, ...photos];
}

/** Unopened Packs shelf — sealed packs only (never torn / opened). */
export function listUnopenedPackShelf(): UnopenedPack[] {
  return listUnopenedGroups();
}

export function resolveUnopenedOpenTarget(pack: UnopenedPack): {
  catalogPackId: string;
  instanceId?: string;
  purchaseId?: string;
} {
  const instance =
    peekUnopenedInstance(pack.id) ??
    (pack.catalogPackId
      ? peekUnopenedInstance(pack.catalogPackId)
      : null);
  return {
    catalogPackId:
      instance?.catalogPackId ?? pack.catalogPackId ?? pack.id,
    instanceId: instance?.instanceId,
    purchaseId: instance?.purchaseId,
  };
}

export function resumeHrefForScratchGroup(
  group: ReadyScratchGroup,
): string | null {
  const session = loadGameSession();
  if (group.kind === "photo") {
    if (!session) return null;
    return photoPlayHref(session);
  }
  if (session?.phase === "motion") {
    return motionPlayHref(session, firstMissingMotionCardId(session));
  }
  return null;
}
