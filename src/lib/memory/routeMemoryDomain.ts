import { Paths } from "@/routes/Paths";

/** Coarse route buckets for memory pressure / purge policy. */
export type RouteMemoryDomain =
  | "packs"
  | "game"
  | "feed"
  | "collection"
  | "light";

/**
 * Map a pathname to a memory domain. Search/hash are ignored — domain is
 * about which heavy assets tend to live on that surface.
 */
export function routeMemoryDomain(pathname: string): RouteMemoryDomain {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";

  if (
    path === Paths.game ||
    path === Paths.gameUi ||
    path === Paths.photoScratch ||
    path.startsWith(`${Paths.game}/`) ||
    path.startsWith(`${Paths.photoScratch}/`)
  ) {
    return "game";
  }

  if (path.startsWith("/purchase/")) {
    return "packs";
  }

  if (
    path === Paths.home ||
    path === Paths.coverflowV2 ||
    path === Paths.mobileCarousel ||
    path === Paths.search ||
    path.startsWith("/browse")
  ) {
    return "packs";
  }

  if (path.startsWith(Paths.discover) || path.startsWith("/creator/")) {
    return "feed";
  }

  if (path.startsWith(Paths.collection)) {
    return "collection";
  }

  return "light";
}

/** Domains that hold video decoders / WebGL and warrant a black transition. */
export function isHeavyMemoryDomain(domain: RouteMemoryDomain): boolean {
  return domain === "packs" || domain === "game" || domain === "feed";
}

/**
 * Whether intentional nav should run the full fade → purge → navigate sequence.
 * light ↔ light stays instant. Same-domain light hops stay instant.
 * Any hop involving packs/game (or crossing heavy domains) transitions.
 */
export function shouldMemoryTransition(
  fromPath: string,
  toPath: string,
): boolean {
  const from = routeMemoryDomain(fromPath);
  const to = routeMemoryDomain(toPath);
  if (from === to && from === "light") return false;
  if (from === to && !isHeavyMemoryDomain(from)) return false;
  // Same heavy domain (e.g. /game → /game?card=) — skip full page transition;
  // in-game card swaps must not black out or lose GL context.
  if (from === to) return false;
  return (
    isHeavyMemoryDomain(from) ||
    isHeavyMemoryDomain(to) ||
    from !== to
  );
}

/** Safety-net: location already changed; only cover when a heavy boundary was crossed. */
export function shouldSafetyNetTransition(
  fromPath: string,
  toPath: string,
): boolean {
  const from = routeMemoryDomain(fromPath);
  const to = routeMemoryDomain(toPath);
  if (from === to) return false;
  return isHeavyMemoryDomain(from) || isHeavyMemoryDomain(to);
}

/** Parse a to-target into pathname (+ optional search) for domain checks. */
export function pathFromTarget(to: string): { pathname: string; search: string } {
  try {
    const url = new URL(to, "http://local.invalid");
    return { pathname: url.pathname, search: url.search };
  } catch {
    const q = to.indexOf("?");
    if (q === -1) return { pathname: to || "/", search: "" };
    return { pathname: to.slice(0, q) || "/", search: to.slice(q) };
  }
}
