/**
 * Resume labeling must stay pack-scoped.
 * Run: npx tsx src/services/scratchResume.self-check.ts
 */
import { cardActionForGroup, listAllReadyScratch } from "./scratchResume.ts";
import { getReadyToScratch } from "./readyToScratch.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => void store.clear(),
  key: () => null,
  length: 0,
} as Storage;

(globalThis as { localStorage?: Storage; sessionStorage?: Storage }).localStorage =
  storage;
(globalThis as { localStorage?: Storage; sessionStorage?: Storage }).sessionStorage =
  storage;
(globalThis as { window?: unknown }).window = globalThis;

function motionSession(input: {
  readyPackId: string;
  motionCardIds: string[];
  completedMotionIds: string[];
}) {
  return {
    version: 1 as const,
    phase: "motion" as const,
    modelId: "m1",
    themes: [],
    motionCardIds: input.motionCardIds,
    completedMotionIds: input.completedMotionIds,
    wonPhotoIds: [],
    completedPhotoIds: [],
    diamondTotal: 0,
    photoPrizeTotal: 0,
    walletCredited: false,
    packScratch: {
      readyPackId: input.readyPackId,
      packName: input.readyPackId,
      creator: "Ada",
      openingSession: {
        purchaseId: "tx",
        instanceId: input.readyPackId,
        foilLabel: "",
        foilFaceUrl: "",
        cards: [],
      },
      openingCardIds: input.motionCardIds,
      settledOpeningIds: [],
    },
  };
}

store.set(
  "sugar_scratchie_sessions_v1",
  JSON.stringify({
    version: 1,
    activeKey: "pack-a",
    byKey: {
      "pack-a": motionSession({
        readyPackId: "pack-a",
        motionCardIds: ["c1", "c2"],
        completedMotionIds: ["c1"],
      }),
      "pack-b": motionSession({
        readyPackId: "pack-b",
        motionCardIds: ["c3", "c4"],
        completedMotionIds: [],
      }),
      "pack-c": {
        ...motionSession({
          readyPackId: "pack-c",
          motionCardIds: ["c5"],
          completedMotionIds: ["c5"],
        }),
        phase: "photo_reveal" as const,
      },
    },
  }),
);

// pack-c finished its motion hand but never settled every opening card, so the
// shelf row survived. It must not resurface as a Motion Card tile.
store.set(
  "sugar.v8.readyToScratch",
  JSON.stringify([
    {
      packId: "pack-c",
      packName: "Pack C",
      creator: "Ada",
      creatorId: "ada",
      themeName: "Pack C",
      coverUrl: "",
      packStatus: "opened",
      session: {
        purchaseId: "tx",
        instanceId: "pack-c",
        foilLabel: "",
        foilFaceUrl: "",
        cards: [{ id: "o1", rarity: "Super Rare", reward: 10 }],
      },
      revealed: [],
      savedAt: 0,
    },
  ]),
);

assert(
  cardActionForGroup({ id: "pack-a", kind: "motion" }) === "resume",
  "pack-a with progress → Resume",
);
assert(
  cardActionForGroup({ id: "pack-b", kind: "motion" }) === "scratch",
  "pack-b with no progress → Scratch (not Resume from pack-a)",
);
assert(
  cardActionForGroup({
    id: "motion:c3,c4",
    kind: "motion",
  }) === "scratch",
  "motion: fallback for untouched hand → Scratch",
);
assert(
  cardActionForGroup({
    id: "motion:c1,c2",
    kind: "motion",
  }) === "resume",
  "motion: fallback matching progressed hand → Resume",
);

assert(
  listAllReadyScratch().every((group) => group.id !== "pack-c"),
  "pack past the motion phase shows no Motion Card tile",
);
assert(
  getReadyToScratch("pack-c") === null,
  "stale shelf row is pruned from storage",
);

console.log("scratchResume.self-check: ok");
