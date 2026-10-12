/**
 * Creator board parser — drop malformed cards, keep null socials null.
 * Run: npx tsx src/services/creatorBoard.self-check.ts
 */
import { collectionProgressFromBoard, parseCreatorBoard } from "./creatorBoard.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const board = parseCreatorBoard({
  creator: {
    id: "juliana",
    name: "Juliana",
    instagramUrl: "https://instagram.com/juliana",
    tiktokUrl: null,
    xUrl: "",
    onlyfansUrl: "onlyfans.com/juliana",
    joinedAt: 10,
  },
  pack: { id: "pack-1", price: 50 },
  motionCardsOwned: 2,
  totalMotionCardsOwned: 4,
  themes: [
    {
      id: "nurse",
      label: "Nurse",
      motionCards: [
        {
          id: "motion-1",
          price: 5,
          status: "unlocked",
          freePlayable: true,
          staticCardsOwned: 1,
          staticCardsTotal: 8,
          staticCards: [
            {
              id: "photo-1",
              slotId: "slot-1",
              price: 2,
              owned: true,
              unlocked: true,
              freePlayable: true,
            },
            { id: "" },
          ],
        },
        { price: 1 },
      ],
      premium: {
        id: "premium-1",
        price: 20,
        replayPrice: 4,
        maxWin: 100,
        unlocked: false,
        freePlayable: false,
      },
    },
    { label: "missing id" },
  ],
  ultra: null,
});

assert(board?.creator.instagramUrl === "https://instagram.com/juliana", "instagram kept");
assert(board?.creator.tiktokUrl === null, "null tiktok stays hidden");
assert(board?.creator.xUrl === null, "blank x is hidden");
assert(board?.themes.length === 1, "theme without id dropped");
assert(board?.themes[0]?.motionCards.length === 1, "motion card without id dropped");
assert(board?.themes[0]?.motionCards[0]?.staticCardsTotal === 8, "static total kept");
assert(board?.themes[0]?.motionCards[0]?.staticCards.length === 1, "blank static dropped");
assert(board?.themes[0]?.premium?.replayPrice === 4, "premium replay price kept");
assert(board?.ultra === null, "null ultra stays null");
assert(parseCreatorBoard({ creator: { name: "no id" } }) === null, "board without creator id rejected");

const progress = collectionProgressFromBoard(board);
assert(progress.staticOwned === 1, "static owned counts the owned slot");
assert(progress.staticTotal === 8, "static total uses staticCardsTotal");
assert(progress.motionOwned === 1, "unlocked motion counts, locked premium does not");
assert(progress.motionTotal === 2, "premium slot is reserved even while locked");
assert(progress.ultraOwned === 0 && progress.ultraTotal === 1, "ultra slot is reserved");
assert(progress.owned === 2 && progress.total === 11, "total is static + motion + ultra");
assert(progress.pct < 100, "locked ultra keeps total under 100%");
assert(
  collectionProgressFromBoard({
    ...board!,
    themes: board!.themes.map((theme) => ({
      ...theme,
      motionCards: theme.motionCards.map((card) => ({
        ...card,
        status: "unlocked",
        staticCardsOwned: card.staticCardsTotal,
        staticCards: card.staticCards.map((slot) => ({ ...slot, owned: true })),
      })),
      premium: theme.premium ? { ...theme.premium, unlocked: true } : null,
    })),
    ultra: board!.themes[0]?.premium
      ? { ...board!.themes[0].premium, unlocked: true }
      : null,
  }).pct === 100,
  "total reaches 100% only once ultra is unlocked",
);

console.log("creatorBoard.self-check: ok");
