/**
 * Creator Home Feed self-check — pagination + purchase mapping.
 * Run: npx tsx src/v8/flow/creatorFeed.self-check.ts
 */

import {
  clearHomeFeedCache,
  feedPackLabel,
  feedVisibleTags,
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
  const videoUrls = page1.items
    .map((item) => item.videoUrl)
    .filter((url): url is string => Boolean(url));
  assert(
    new Set(videoUrls).size === videoUrls.length,
    "first page should not repeat videos",
  );
  if (page1.items.length === 0) {
    assert(!page1.hasMore, "empty catalog should not have more");
    assert(page1.nextCursor === null, "empty catalog should not return cursor");
  } else {
    const first = page1.items[0]!;
    assert(first.creatorName.length > 0, "creator name required");
    assert(first.creatorId.length > 0, "creator id required");
    assert(first.packId.length > 0, "pack id required");
    assert(first.diamondCost > 0, "diamond cost required");
    assert(first.packName.length > 0, "pack name required");
    assert(feedVisibleTags(first.tags).length <= 3, "at most 3 visible tags");
    if (first.mediaType === "video") {
      assert(Boolean(first.videoUrl), "video cards need a backend video url");
    }

    const pack = toPurchasePack(first);
    assert(pack.packId === first.packId, "purchase pack id");
    assert(pack.price.includes(String(first.diamondCost)), "price includes diamonds");

    if (page1.hasMore) {
      assert(page1.nextCursor, "first page should return cursor");
      const page2 = await fetchHomeFeedPage(page1.nextCursor);
      assert(page2.items[0]!.id !== first.id, "next page should advance ids");
    }
  }
  assert(feedPackLabel("Golden Hour Pack") === "Golden Hour", "strip Pack suffix");
  assert(feedPackLabel("Cyber Nights") === "Cyber Nights", "keep bare titles");

  // Paginated pages must reuse the in-memory catalog (no reshuffle / re-seed).
  clearHomeFeedCache();
  const seeded = await fetchHomeFeedPage(null);
  if (seeded.hasMore && seeded.nextCursor) {
    const next = await fetchHomeFeedPage(seeded.nextCursor);
    assert(next.items.length > 0 || !next.hasMore, "page 2 should slice catalog");
    // Same shuffle order: page2 ids are offset continuations of page1 seeds.
    if (seeded.items[0] && next.items[0]) {
      assert(
        next.items[0].id !== seeded.items[0].id,
        "page 2 advances without rebuilding catalog",
      );
    }
  }

  writeHomeFeedCache({
    items: page1.items,
    cursor: page1.nextCursor,
    hasMore: page1.hasMore,
    activeId: page1.items[0]?.id ?? null,
    scrollIndex: 2,
  });
  const cached = readHomeFeedCache();
  assert(cached?.scrollIndex === 2, "cache scroll index");
  assert(cached?.activeId === (page1.items[0]?.id ?? null), "cache active id");

  clearHomeFeedCache();
  assert(readHomeFeedCache() === null, "cache cleared");

  console.log("v8 creator feed self-check passed");
}

void main();
