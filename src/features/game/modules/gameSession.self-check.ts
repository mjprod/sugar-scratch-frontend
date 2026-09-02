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
