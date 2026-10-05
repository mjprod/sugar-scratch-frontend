import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRegisterCardPlay } from "@/hooks/useRegisterCardPlay";
import type { CardKind } from "@/services/cardPlays";

/**
 * Charge / register a hub play before the scratch surface mounts.
 * Skip for pack-linked `game=1` hands and StageNav playlists — those are not
 * pay-to-play collection launches.
 */
export function PaidCardPlayGate({
  kind,
  cardId,
  skip,
  children,
}: {
  kind: CardKind;
  cardId: string;
  skip?: boolean;
  children: ReactNode;
}) {
  const { authReady } = useAuthSession();
  const registerPlay = useRegisterCardPlay();
  // Register once per card after the session probe; later auth / wallet churn
  // must not tear down a surface that is already mounted.
  const registerPlayRef = useRef(registerPlay);
  useEffect(() => {
    registerPlayRef.current = registerPlay;
  }, [registerPlay]);
  const id = cardId.trim();
  const bypass = Boolean(skip) || !id;
  const [ready, setReady] = useState(bypass);

  useEffect(() => {
    if (bypass) {
      setReady(true);
      return;
    }
    setReady(false);
    // `authed` is false until the session probe lands — registering earlier
    // would take the guest path and mount a signed-in user's card unpaid.
    if (!authReady) return;
    let cancelled = false;
    void registerPlayRef.current(kind, id).then((ok) => {
      if (!cancelled && ok) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, bypass, id, kind]);

  if (!ready) {
    return (
      <div className="app-shell app-shell--game">
        <div className="stage-game" aria-busy="true" />
      </div>
    );
  }
  return children;
}
