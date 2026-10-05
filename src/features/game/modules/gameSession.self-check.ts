import {
  clearPracticeCards,
  isPracticeCard,
  setPracticeCard,
} from "./gameSession.ts";
import { pickWonPhotocards, type PhotoCard } from "./session.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const photos: PhotoCard[] = [
  {
    id: "a",
    label: "Police 1",
    background: "",
    bikini: "",
    clothes: "",
    mesh: "",
  },
  {
    id: "b",
    label: "Nurse 1",
    background: "",
    bikini: "",
    clothes: "",
    mesh: "",
  },
  {
    id: "c",
    label: "Gym 1",
    background: "",
    bikini: "",
    clothes: "",
    mesh: "",
  },
];

const first = pickWonPhotocards(photos, 1, ["Police"]);
assert(first.length === 1, "awards one photo");
const second = pickWonPhotocards(
  photos,
  1,
  ["Police"],
  first.map((photo) => photo.id),
);
assert(second.length === 1, "awards another photo");
assert(second[0]!.id !== first[0]!.id, "does not reroll the first photo");

console.log("photo award uniqueness self-check passed");

const session = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};

const USER_ID_KEY = "sugar.v8.authUserId";

function withAuthUserId(userId: string | null, fn: () => void) {
  const prev = sessionStorage.getItem(USER_ID_KEY);
  try {
    if (userId) sessionStorage.setItem(USER_ID_KEY, userId);
    else sessionStorage.removeItem(USER_ID_KEY);
    fn();
  } finally {
    if (prev == null) sessionStorage.removeItem(USER_ID_KEY);
    else sessionStorage.setItem(USER_ID_KEY, prev);
  }
}

clearPracticeCards();
withAuthUserId("user-a", () => {
  setPracticeCard("card-1", true);
  assert(isPracticeCard("card-1"), "user-a marks card practice");
});
withAuthUserId("user-b", () => {
  assert(
    !isPracticeCard("card-1"),
    "user-b does not inherit user-a practice flags",
  );
  setPracticeCard("card-1", true);
  assert(
    isPracticeCard("card-1"),
    "user-b can mark the same card id independently",
  );
});
clearPracticeCards();
withAuthUserId("user-a", () => {
  assert(!isPracticeCard("card-1"), "clearPracticeCards drops all owners");
});

console.log("practice card scope self-check passed");
