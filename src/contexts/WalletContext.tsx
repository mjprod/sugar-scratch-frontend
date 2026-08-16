import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { apiFetch } from "@/lib/api";

type WalletContextValue = {
  coins: number;
  diamonds: number;
  setCoins: Dispatch<SetStateAction<number>>;
  setDiamonds: Dispatch<SetStateAction<number>>;
  addCoins: (n: number) => void;
  addDiamonds: (n: number) => void;
  spendDiamonds: (n: number) => void;
  resetWallet: () => void;
  refreshWallet: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const INITIAL_COINS = 120;
const INITIAL_DIAMONDS = 3;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [diamonds, setDiamonds] = useState(INITIAL_DIAMONDS);

  const refreshWallet = useCallback(async () => {
    const data = await apiFetch<{ diamonds: number; coins: number }>(
      "/api/me/wallet",
    );
    if (!data) return;
    setDiamonds(data.diamonds);
    setCoins(data.coins);
  }, []);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  const addCoins = useCallback((n: number) => {
    setCoins((c) => c + n);
  }, []);

  const addDiamonds = useCallback((n: number) => {
    setDiamonds((d) => d + n);
  }, []);

  const spendDiamonds = useCallback((n: number) => {
    setDiamonds((d) => Math.max(0, d - n));
  }, []);

  const resetWallet = useCallback(() => {
    setCoins(INITIAL_COINS);
    setDiamonds(INITIAL_DIAMONDS);
    void refreshWallet();
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
      resetWallet,
      refreshWallet,
    }),
    [addCoins, addDiamonds, coins, diamonds, refreshWallet, resetWallet, spendDiamonds],
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
