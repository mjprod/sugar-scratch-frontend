/**
 * Creator Home Feed self-check — pagination + purchase mapping.
 * Run: npx tsx src/v8/flow/creatorFeed.self-check.ts
 */

import {
  clearHomeFeedCache,
  fetchHomeFeedPage,
  readHomeFeedCache,
  toPurchasePack,
  writeHomeFeedCache,
} from "./creatorFeed";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  clearHomeFeedCache();
  const page1 = await fetchHomeFeedPage(null);
  assert(page1.items.length === 4, "page size should be 4");
  assert(page1.hasMore, "first page should have more");
  assert(page1.nextCursor, "first page should return cursor");

  const first = page1.items[0]!;
  assert(first.creatorName.length > 0, "creator name required");
  assert(first.packId.length > 0, "pack id required");
  assert(first.diamondCost > 0, "diamond cost required");
  assert(first.description.length > 0, "description required");

  const pack = toPurchasePack(first);
  assert(pack.packId === first.packId, "purchase pack id");
  assert(pack.price.includes(String(first.diamondCost)), "price includes diamonds");

  const page2 = await fetchHomeFeedPage(page1.nextCursor);
  assert(page2.items[0]!.id !== first.id, "next page should advance ids");

  writeHomeFeedCache({
    items: page1.items,
    cursor: page1.nextCursor,
    hasMore: page1.hasMore,
    activeId: first.id,
    scrollIndex: 2,
  });
  const cached = readHomeFeedCache();
  assert(cached?.scrollIndex === 2, "cache scroll index");
  assert(cached?.activeId === first.id, "cache active id");
  assert(first.mediaType === "video", "cards should be video");

  clearHomeFeedCache();
  assert(readHomeFeedCache() === null, "cache cleared");

  console.log("v8 creator feed self-check passed");
}

void main();
