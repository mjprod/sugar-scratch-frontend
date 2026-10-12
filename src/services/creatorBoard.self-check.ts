/**
 * Creator board parser — drop malformed cards, keep null socials null.
 * Run: npx tsx src/services/creatorBoard.self-check.ts
 */
import { parseCreatorBoard } from "./creatorBoard.ts";

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

console.log("creatorBoard.self-check: ok");
