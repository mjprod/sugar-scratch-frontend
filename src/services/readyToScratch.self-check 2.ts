import { buildOpeningSession } from "./purchase.ts";
import {
  clearReadyToScratch,
  getReadyToScratch,
  listReadyToScratch,
  remainingCount,
  upsertReadyToScratch,
} from "./readyToScratch.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

clearReadyToScratch();
assert(listReadyToScratch().length === 0, "starts empty");

const session = buildOpeningSession(1);
const saved = upsertReadyToScratch({
  packId: "cyber",
  packName: "Cyber Nights",
  creator: "Emily",
  session,
  revealed: [],
});

assert(saved != null, "opened pack is saved");
assert(remainingCount(saved!) === 3, "all cards ready");
assert(listReadyToScratch()[0]?.count === 3, "lists remaining count");
assert(listReadyToScratch()[0]?.collectionName === "Cyber Nights", "keeps theme");

const afterOne = upsertReadyToScratch({
  packId: "cyber",
  packName: "Cyber Nights",
  creator: "Emily",
  session,
  revealed: [session.cards[0].id],
});
assert(remainingCount(afterOne!) === 2, "finish later keeps remaining");
assert(
  getReadyToScratch("cyber")?.revealed.includes(session.cards[0].id),
  "revealed cards stay revealed",
);

const done = upsertReadyToScratch({
  packId: "cyber",
  packName: "Cyber Nights",
  creator: "Emily",
  session,
  revealed: session.cards.map((card) => card.id),
});
assert(done == null, "fully revealed pack leaves ready inventory");
assert(listReadyToScratch().length === 0, "ready section empties when done");
assert(getReadyToScratch("cyber") == null, "opened pack never returns as unopened");

console.log("v8 ready-to-scratch self-check passed");
