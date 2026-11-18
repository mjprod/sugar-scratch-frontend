import { resolveCssCtaTone } from "./ctaCssTone";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  resolveCssCtaTone(["#aa085f", "#e00083", "#eb6a00"], "#42001b") === "default",
  "pink squircle → default",
);
assert(
  resolveCssCtaTone(["#d37217", "#ff9c66", "#ff9f1a"], "#3d2808") === "gold",
  "gold pill → gold",
);
assert(
  resolveCssCtaTone(["#b6bac3", "#8b9099", "#686d76"], "#1d1f24") === "black",
  "black pill → black",
);
assert(
  resolveCssCtaTone(["#8d00aa", "#d503ff", "#b44bff"], "#1b0042") === "purple",
  "profile diamonds → purple",
);

console.log("ctaCssTone.self-check: ok");
