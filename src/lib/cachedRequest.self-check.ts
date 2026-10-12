/**
 * Catalog request dedup self-check.
 * Run: npx tsx src/lib/cachedRequest.self-check.ts
 */
import { cachedRequest, clearCachedRequest } from "./cachedRequest.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let calls = 0;
  const load = async () => {
    calls += 1;
    await sleep(5);
    return [calls];
  };

  const [a, b] = await Promise.all([
    cachedRequest("models", 50, load),
    cachedRequest("models", 50, load),
  ]);
  assert(calls === 1, "concurrent callers share one request");
  assert(a === b, "concurrent callers get the same result");

  await cachedRequest("models", 50, load);
  assert(calls === 1, "hit within TTL");

  await sleep(60);
  await cachedRequest("models", 50, load);
  assert(calls === 2, "refetch after TTL");

  let emptyCalls = 0;
  const loadEmpty = async () => {
    emptyCalls += 1;
    return null;
  };
  await cachedRequest("cards", 10_000, loadEmpty, 20);
  await cachedRequest("cards", 10_000, loadEmpty, 20);
  assert(emptyCalls === 1, "empty result cached briefly");
  await sleep(30);
  await cachedRequest("cards", 10_000, loadEmpty, 20);
  assert(emptyCalls === 2, "empty result retried after short TTL");

  let failCalls = 0;
  const loadFail = async () => {
    failCalls += 1;
    throw new Error("down");
  };
  await cachedRequest("fail", 10_000, loadFail).catch(() => null);
  await cachedRequest("fail", 10_000, loadFail).catch(() => null);
  assert(failCalls === 2, "rejections are not cached");

  clearCachedRequest("models");
  await cachedRequest("models", 10_000, load);
  assert(calls === 3, "clear forces refetch");

  console.log("cachedRequest self-check ok");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
