/**
 * Motion-hand resolve must stay on the opened model.
 * Run: npx tsx src/features/game/modules/session.self-check.ts
 */
import {
  resolveMotionHandFromIds,
  type ThemedMotionCard,
} from "./session.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function motion(
  id: string,
  modelId: string,
  theme: string,
): ThemedMotionCard {
  return {
    id,
    label: `${modelId} ${theme}`,
    bottom: "",
    foreground: `/cards/${id}.mp4`,
    mesh: "",
    chromaKey: false,
    model_id: modelId,
    theme_id: theme.toLowerCase(),
    theme,
  };
}

const pool = [
  motion("julianaval_cop", "julianaval", "Police"),
  motion("julianaval_nurse", "julianaval", "Nurse"),
  motion("halli_cop", "wildhalli", "Police"),
  motion("halli_nurse", "wildhalli", "Nurse"),
  motion("halli_teacher", "wildhalli", "Teacher"),
];

const fromFan = resolveMotionHandFromIds(
  ["reveal-api-halli_cop", "reveal-api-julianaval_nurse"],
  pool,
  { modelId: "wildhalli" },
);
assert(
  fromFan.every((card) => card.model_id === "wildhalli"),
  "halli open ignores juliana catalog ids",
);
assert(
  fromFan.some((card) => card.id === "halli_cop"),
  "halli fan id maps to halli motion",
);
assert(
  !fromFan.some((card) => card.id.startsWith("julianaval")),
  "juliana motion never fills a halli hand",
);

const fromEmpty = resolveMotionHandFromIds([], pool, { modelId: "wildhalli" });
assert(
  fromEmpty.every((card) => card.model_id === "wildhalli"),
  "empty fan deal stays on halli",
);
assert(fromEmpty.length > 0, "halli pool still deals a halli hand");

const unknownModel = resolveMotionHandFromIds(
  ["reveal-api-julianaval_cop"],
  pool,
  { modelId: "missing-model" },
);
assert(unknownModel.length === 0, "unknown model must not fall back to juliana");

console.log("motion hand model scope self-check: ok");
