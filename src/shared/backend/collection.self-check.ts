/**
 * Collection regroup self-check.
 * Run: npx tsx src/shared/backend/collection.self-check.ts
 */
import { regroupCollectionGroups, type BackendCollectionGroup } from "./collection";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function card(id: string, label: string): BackendCollectionGroup["cards"][number] {
  return {
    id,
    label,
    videoUrl: "",
    photoScratchDone: 0,
    photoUrls: [],
  };
}

const groups: BackendCollectionGroup[] = [
  {
    id: "julianaval-police-1",
    modelId: "julianaval",
    title: "Juliana Police",
    themeName: "Police",
    themeId: "police",
    cards: [card("julianaval_cop", "Julianaval Cop")],
  },
  {
    id: "julianaval-motion-1",
    modelId: "julianaval",
    title: "Juliana Motion",
    themeName: "Motion",
    themeId: null,
    cards: [
      card("juliana_1", "Julianaval Cop 2"),
      card("thai_1", "Julianaval Cop 3"),
      card("asian_2", "Julianaval Teacher 3"),
    ],
  },
  {
    id: "julianaval-motion-2",
    modelId: "julianaval",
    title: "Juliana Motion 2",
    themeName: "Motion",
    themeId: null,
    cards: [
      card("julianaval_teacher", "Julianaval Teacher"),
      card("juliana_2", "Julianaval Nurse"),
      card("ju_gym", "Julianaval Nurse 2"),
    ],
  },
  {
    id: "julianaval-motion-3",
    modelId: "julianaval",
    title: "Juliana Motion 3",
    themeName: "Motion",
    themeId: null,
    cards: [
      card("asia_gym", "Julianaval Nurse 3"),
      card("julianaval_gym", "Julianaval gym"),
      card("asia_gym2", "Julianaval gym 2"),
    ],
  },
  {
    id: "julianaval-motion-4",
    modelId: "julianaval",
    title: "Juliana Motion 4",
    themeName: "Motion",
    themeId: null,
    cards: [
      card("glaucamp_1", "Julianaval firegirl 2"),
      card("julianaval_firegirl", "Julianaval firegirl"),
    ],
  },
  {
    id: "julianaval-teacher-1",
    modelId: "julianaval",
    title: "Juliana Teacher",
    themeName: "Teacher",
    themeId: "teacher",
    cards: [card("juliana_3", "Julianaval Teacher 2")],
  },
];

const regrouped = regroupCollectionGroups(groups);
const names = regrouped.map((group) => group.themeName);

assert(names.filter((name) => name === "Police").length === 1, "police appears once");
assert(
  names.join(",") === "Police,Teacher,Nurse,Gym,Firegirl",
  `costume order is Police, Teacher, Nurse, Gym, Firegirl (got ${names.join(", ")})`,
);
assert(
  regrouped.every((group) => group.themeName !== "Motion"),
  "mixed motion buckets are gone",
);

const police = regrouped.find((group) => group.themeId === "police");
assert(police?.cards.some((entry) => entry.id === "julianaval_cop"), "keeps themed police card");
assert(police?.cards.some((entry) => entry.id === "juliana_1"), "absorbs motion cop cards");

console.log("collection regroup self-check: ok");
