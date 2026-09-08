import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type WalletContextValue = {
  coins: number;
  diamonds: number;
  setCoins: Dispatch<SetStateAction<number>>;
  setDiamonds: Dispatch<SetStateAction<number>>;
  addCoins: (n: number) => void;
  addDiamonds: (n: number) => void;
  spendDiamonds: (n: number) => void;
  spendCoins: (n: number) => boolean;
  resetWallet: () => void;
  refreshWallet: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const INITIAL_COINS = 0;
const INITIAL_DIAMONDS = 0;

/** Temporary broke-state override — HUD diamonds stay 0. Flip to false to restore live balance. */
const FORCE_EMPTY_DIAMONDS = true;

export function WalletProvider({ children }: { children: ReactNode }) {
  const { authed } = useAuth();
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [diamonds, setDiamonds] = useState(INITIAL_DIAMONDS);
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  const authedRef = useRef(authed);
  const walletEpochRef = useRef(0);
  authedRef.current = authed;

  const refreshWallet = useCallback(async () => {
    const epoch = walletEpochRef.current;
    const data = await apiFetch<{ diamonds: number; coins: number }>(
      "/api/me/wallet",
    );
    // Ignore responses that finished after logout / a newer refresh.
    if (!data || epoch !== walletEpochRef.current || !authedRef.current) {
      return;
    }
    setDiamonds(FORCE_EMPTY_DIAMONDS ? 0 : data.diamonds);
    setCoins(data.coins);
  }, []);

  useEffect(() => {
    // Invalidate any in-flight fetch from the previous auth state.
    walletEpochRef.current += 1;
    if (!authed) {
      setCoins(INITIAL_COINS);
      setDiamonds(INITIAL_DIAMONDS);
      return;
    }
    void refreshWallet();
  }, [authed, refreshWallet]);

  const addCoins = useCallback((n: number) => {
    setCoins((c) => c + n);
  }, []);

  const addDiamonds = useCallback((n: number) => {
    setDiamonds((d) => d + n);
  }, []);

  const spendDiamonds = useCallback((n: number) => {
    setDiamonds((d) => Math.max(0, d - n));
  }, []);

  const spendCoins = useCallback((n: number) => {
    if (!Number.isFinite(n) || n <= 0) return false;
    if (coinsRef.current < n) return false;
    // Update the ref immediately so a second sync call can't double-spend
    // before React re-renders.
    coinsRef.current -= n;
    setCoins(coinsRef.current);
    return true;
  }, []);

  const resetWallet = useCallback(() => {
    walletEpochRef.current += 1;
    setCoins(INITIAL_COINS);
    setDiamonds(INITIAL_DIAMONDS);
    if (authedRef.current) void refreshWallet();
  }, [refreshWallet]);

  const value = useMemo(
    () => ({
      coins,
      diamonds,
      setCoins,
      setDiamonds,
      addCoins,
      addDiamonds,
      spendDiamonds,
      spendCoins,
      resetWallet,
      refreshWallet,
    }),
    [addCoins, addDiamonds, coins, diamonds, refreshWallet, resetWallet, spendCoins, spendDiamonds],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
