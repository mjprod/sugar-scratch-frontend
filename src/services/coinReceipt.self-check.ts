/**
 * Post-game coin receipt self-check.
 * Run: npx tsx src/services/coinReceipt.self-check.ts
 */
import { noteCoinsReceived, takeCoinReceipt } from "./coinReceipt.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const session = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => void session.set(key, value),
  removeItem: (key: string) => void session.delete(key),
};

assert(takeCoinReceipt("u1") === 0, "empty receipt is 0");

noteCoinsReceived(5, "u1");
noteCoinsReceived(7, "u1");
assert(takeCoinReceipt("u1") === 12, "amounts accumulate");
assert(takeCoinReceipt("u1") === 0, "take clears the receipt");

noteCoinsReceived(0, "u1");
noteCoinsReceived(-3, "u1");
noteCoinsReceived(Number.NaN, "u1");
assert(takeCoinReceipt("u1") === 0, "non-positive / non-finite ignored");

noteCoinsReceived(9, "u1");
assert(takeCoinReceipt("u2") === 0, "other owner gets nothing");
assert(takeCoinReceipt("u1") === 0, "mismatched take still clears");

noteCoinsReceived(4, "u1");
noteCoinsReceived(6, "u2");
assert(takeCoinReceipt("u2") === 6, "account switch restarts the receipt");

noteCoinsReceived(3, null);
assert(takeCoinReceipt("u1") === 0, "signed-out receipt never leaks to a user");

console.log("coinReceipt self-check ok");
