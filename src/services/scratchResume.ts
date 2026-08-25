import {
  activateGameSessionForPack,
  firstMissingMotionCardId,
  listStoredGameSessions,
  loadGameSession,
  loadGameSessionForPack,
  motionPlayHref,
  photoPlayHref,
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

function photoScratchGroupFromSession(
  session: NonNullable<ReturnType<typeof loadGameSession>>,
): ReadyScratchGroup | null {
  if (session.phase !== "photo_reveal" && session.phase !== "photo") {
    return null;
  }
  const remaining = session.wonPhotoIds.filter(
    (id) => !session.completedPhotoIds.includes(id),
  );
  if (remaining.length === 0) return null;
  const pack = session.packScratch;
  const readyPackId = pack?.readyPackId ?? "session";
  return {
    id: `photo:${readyPackId}`,
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
  };
}

function motionScratchGroupFromSession(
  session: NonNullable<ReturnType<typeof loadGameSession>>,
): ReadyScratchGroup | null {
  if (session.phase !== "motion") return null;
  const remaining = session.motionCardIds.filter(
    (id) => !session.completedMotionIds.includes(id),
  );
  if (remaining.length === 0) return null;
  const pack = session.packScratch;
  const packId = pack?.readyPackId;
  if (packId && getReadyToScratch(packId)) return null;
  return {
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
  };
}

/** Unfinished Photo Scratch items for Collection / Ready to Scratch. */
export function listReadyPhotoScratch(): ReadyScratchGroup[] {
  return listStoredGameSessions()
    .map((session) => photoScratchGroupFromSession(session))
    .filter((group): group is ReadyScratchGroup => Boolean(group));
}

/**
 * Opened pack with unfinished Motion Scratch that isn't already in readyToScratch.
 * Covers mid-session Save & Exit when inventory write lagged.
 */
function listReadyMotionFromSession(): ReadyScratchGroup[] {
  return listStoredGameSessions()
    .map((session) => motionScratchGroupFromSession(session))
    .filter((group): group is ReadyScratchGroup => Boolean(group));
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
  if (group.kind === "photo") {
    const packId = group.id.startsWith("photo:")
      ? group.id.slice("photo:".length)
      : null;
    // Prefer pack-keyed session. Only use the active session when the tile is
    // explicitly the generic "photo:session" fallback — never cross-pack.
    const session =
      packId && packId !== "session"
        ? (activateGameSessionForPack(packId) ??
          loadGameSessionForPack(packId))
        : loadGameSession();
    if (!session) return null;
    if (
      packId &&
      packId !== "session" &&
      session.packScratch?.readyPackId &&
      session.packScratch.readyPackId !== packId
    ) {
      return null;
    }
    if (session.phase !== "photo" && session.phase !== "photo_reveal") {
      return null;
    }
    return photoPlayHref(session);
  }

  // Motion: pack-keyed only. Do not fall back to whatever motion hand is active.
  const session =
    activateGameSessionForPack(group.id) ??
    loadGameSessionForPack(group.id) ??
    motionSessionMatchingGroupId(group.id);
  if (session?.phase === "motion") {
    if (
      session.packScratch?.readyPackId &&
      session.packScratch.readyPackId !== group.id &&
      !group.id.startsWith("motion:")
    ) {
      return null;
    }
    return motionPlayHref(session, firstMissingMotionCardId(session));
  }
  return null;
}

/** Session whose motion card list matches a `motion:id1,id2,…` shelf id. */
function motionSessionMatchingGroupId(
  groupId: string,
): ReturnType<typeof loadGameSession> {
  if (!groupId.startsWith("motion:")) return null;
  const encoded = groupId.slice("motion:".length);
  return (
    listStoredGameSessions().find(
      (session) =>
        session.phase === "motion" &&
        session.motionCardIds.join(",") === encoded,
    ) ?? null
  );
}

function motionGroupMatchesSession(
  groupId: string,
  session: NonNullable<ReturnType<typeof loadGameSession>>,
): boolean {
  const packId = session.packScratch?.readyPackId;
  if (packId && packId === groupId) return true;
  if (groupId.startsWith("motion:")) {
    return groupId.slice("motion:".length) === session.motionCardIds.join(",");
  }
  return false;
}

/** Scratch = never started; Resume = existing progress on this asset. */
export function cardActionForGroup(group: {
  id: string;
  kind?: "motion" | "photo";
}): "scratch" | "resume" {
  if (group.kind === "photo") {
    const packId = group.id.startsWith("photo:")
      ? group.id.slice("photo:".length)
      : null;
    for (const session of listStoredGameSessions()) {
      if (session.phase !== "photo" && session.phase !== "photo_reveal") {
        continue;
      }
      const sessionPack = session.packScratch?.readyPackId ?? "session";
      if (packId && packId !== sessionPack && packId !== "session") continue;
      if (session.completedPhotoIds.length > 0) return "resume";
    }
    return "scratch";
  }

  const inventory = getReadyToScratch(group.id);
  if (inventory && inventory.revealed.length > 0) return "resume";

  for (const session of listStoredGameSessions()) {
    if (session.phase !== "motion") continue;
    if (session.completedMotionIds.length === 0) continue;
    if (motionGroupMatchesSession(group.id, session)) return "resume";
  }
  return "scratch";
}
