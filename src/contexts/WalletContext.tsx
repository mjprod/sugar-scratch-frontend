import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type WalletContextValue = {
  coins: number;
  diamonds: number;
  setCoins: Dispatch<SetStateAction<number>>;
  setDiamonds: Dispatch<SetStateAction<number>>;
  addCoins: (n: number) => void;
  addDiamonds: (n: number) => void;
  spendDiamonds: (n: number) => void;
  resetWallet: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const INITIAL_COINS = 120;
const INITIAL_DIAMONDS = 3;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [diamonds, setDiamonds] = useState(INITIAL_DIAMONDS);

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
  }, []);

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
    }),
    [addCoins, addDiamonds, coins, diamonds, resetWallet, spendDiamonds],
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
