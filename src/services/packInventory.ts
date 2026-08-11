/**
 * Persistent pack ownership. Purchase creates unopened instances immediately;
 * Tear Completion is the only path to opened (cards live in readyToScratch).
 */
import { PACK_PHOTOS } from "../lib/photos";
import type { UnopenedPack } from "./collection";

export type PackStatus = "unopened" | "opened";

export type OwnedPackInstance = {
  instanceId: string;
  catalogPackId: string;
  packName: string;
  creator: string;
  creatorId: string;
  themeName: string;
  coverUrl: string;
  status: PackStatus;
  purchaseId: string;
  savedAt: number;
};

const KEY = "sugar.v8.packInventory";

function readAll(): OwnedPackInstance[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid);
  } catch {
    return [];
  }
}

function writeAll(packs: OwnedPackInstance[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(packs));
  } catch {
    /* storage unavailable */
  }
}

function isValid(value: unknown): value is OwnedPackInstance {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<OwnedPackInstance>;
  return (
    typeof data.instanceId === "string" &&
    typeof data.catalogPackId === "string" &&
    typeof data.packName === "string" &&
    typeof data.creator === "string" &&
    typeof data.purchaseId === "string" &&
    (data.status === "unopened" || data.status === "opened")
  );
}

function slugId(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "creator";
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when this purchaseId already created inventory (duplicate prevention). */
export function purchaseAlreadyOwned(purchaseId: string) {
  return readAll().some((pack) => pack.purchaseId === purchaseId);
}

/**
 * Persist N unopened packs for a successful purchase.
 * No-ops (returns existing) if purchaseId was already processed.
 */
export function addUnopenedFromPurchase(input: {
  purchaseId: string;
  catalogPackId: string;
  packName: string;
  creator: string;
  count: number;
  coverUrl?: string;
  themeName?: string;
}): OwnedPackInstance[] {
  if (input.count < 1) return [];
  const existing = readAll();
  if (existing.some((pack) => pack.purchaseId === input.purchaseId)) {
    return existing.filter(
      (pack) =>
        pack.purchaseId === input.purchaseId && pack.status === "unopened",
    );
  }

  const coverUrl =
    input.coverUrl ?? PACK_PHOTOS[input.catalogPackId] ?? PACK_PHOTOS.ep1;
  const creatorId = slugId(input.creator);
  const themeName = input.themeName ?? input.packName;
  const created: OwnedPackInstance[] = Array.from(
    { length: input.count },
    () => ({
      instanceId: newId("pack"),
      catalogPackId: input.catalogPackId,
      packName: input.packName,
      creator: input.creator,
      creatorId,
      themeName,
      coverUrl,
      status: "unopened",
      purchaseId: input.purchaseId,
      savedAt: Date.now(),
    }),
  );

  writeAll([...created, ...existing]);
  return created;
}

/** All owned pack instances (unopened + opened). */
export function listOwnedPacks(): OwnedPackInstance[] {
  return readAll();
}

export function countOwnedPacks(): number {
  return readAll().length;
}

export function getPackInstance(instanceId: string): OwnedPackInstance | null {
  return readAll().find((pack) => pack.instanceId === instanceId) ?? null;
}

export function listUnopenedInstances(): OwnedPackInstance[] {
  return readAll().filter((pack) => pack.status === "unopened");
}

/** Group unopened packs for My Bag (catalog + theme). */
export function listUnopenedGroups(): UnopenedPack[] {
  const groups = new Map<string, UnopenedPack & { instanceIds: string[] }>();
  for (const pack of listUnopenedInstances()) {
    const key = `${pack.catalogPackId}::${pack.themeName}::${pack.creatorId}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
      current.instanceIds.push(pack.instanceId);
      continue;
    }
    groups.set(key, {
      id: key,
      name: pack.themeName,
      creator: pack.creator,
      creatorId: pack.creatorId,
      count: 1,
      coverUrl: pack.coverUrl,
      catalogPackId: pack.catalogPackId,
      instanceIds: [pack.instanceId],
    });
  }
  return [...groups.values()].map(({ instanceIds: _, ...group }) => group);
}

/** First unopened instance for a bag group id (or catalog pack id). */
export function peekUnopenedInstance(
  groupOrCatalogId: string,
): OwnedPackInstance | null {
  const unopened = listUnopenedInstances();
  const byGroup = unopened.find((pack) => {
    const key = `${pack.catalogPackId}::${pack.themeName}::${pack.creatorId}`;
    return key === groupOrCatalogId || pack.catalogPackId === groupOrCatalogId;
  });
  return byGroup ?? null;
}

export function countUnopened(): number {
  return listUnopenedInstances().length;
}

/** Tear Completion boundary — pack never returns to unopened. */
export function markPackOpened(instanceId: string): OwnedPackInstance | null {
  const packs = readAll();
  const index = packs.findIndex((pack) => pack.instanceId === instanceId);
  if (index === -1) return null;
  if (packs[index].status === "opened") return packs[index];
  packs[index] = {
    ...packs[index],
    status: "opened",
    savedAt: Date.now(),
  };
  writeAll(packs);
  return packs[index];
}

export function nextUnopenedInPurchase(
  purchaseId: string,
): OwnedPackInstance | null {
  return (
    listUnopenedInstances().find((pack) => pack.purchaseId === purchaseId) ??
    null
  );
}

export function clearPackInventory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
