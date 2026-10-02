import { useEffect, useState, type ReactNode } from "react";
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
  const registerPlay = useRegisterCardPlay();
  const id = cardId.trim();
  const bypass = Boolean(skip) || !id;
  const [ready, setReady] = useState(bypass);

  useEffect(() => {
    if (bypass) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void registerPlay(kind, id).then((ok) => {
      if (!cancelled && ok) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bypass, id, kind, registerPlay]);

  if (!ready) {
    return (
      <div className="app-shell app-shell--game">
        <div className="stage-game" aria-busy="true" />
      </div>
    );
  }
  return children;
}
