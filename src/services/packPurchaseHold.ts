/**
 * Unpaid pack held when a buy fails for lack of diamonds.
 * Get Diamonds returns to the page the user left. A completed recharge
 * opens Pack Pocket so they can finish the purchase.
 */

import { addPackToCart, type CartAddInput } from "./cart";

const KEY = "sugar.v8.packPurchaseHold";

export type PackPurchaseHold = {
  returnPath: string;
  quantity: number;
  pack: CartAddInput;
};

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function readPackPurchaseHold(): PackPurchaseHold | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PackPurchaseHold>;
    if (
      !parsed.pack ||
      typeof parsed.pack.packId !== "string" ||
      typeof parsed.returnPath !== "string" ||
      !parsed.returnPath.startsWith("/")
    ) {
      return null;
    }
    return {
      returnPath: parsed.returnPath,
      quantity: Math.max(1, Number(parsed.quantity) || 1),
      pack: parsed.pack,
    };
  } catch {
    return null;
  }
}

export function clearPackPurchaseHold() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

function writeHold(hold: PackPurchaseHold) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(hold));
  } catch {
    /* storage unavailable */
  }
}

/** Remember the page Get Diamonds should return to. Does not add a pack. */
export function rememberPackPurchaseReturn(pack: CartAddInput): PackPurchaseHold {
  const hold: PackPurchaseHold = {
    returnPath: currentPath(),
    quantity: 1,
    pack,
  };
  writeHold(hold);
  return hold;
}

/** Park the pack in Pack Pocket and remember where Get Diamonds should return. */
export function holdPackForDiamondTopUp(
  pack: CartAddInput,
  quantity = 1,
): PackPurchaseHold {
  const count = Math.max(1, Math.floor(quantity));
  for (let i = 0; i < count; i += 1) addPackToCart(pack);
  const hold: PackPurchaseHold = {
    returnPath: currentPath(),
    quantity: count,
    pack,
  };
  writeHold(hold);
  return hold;
}
