import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import {
  useRegisterCardPlayOutcome,
  type CardPlayOutcome,
} from "@/hooks/useRegisterCardPlay";
import type { CardKind } from "@/services/cardPlays";

type GateStatus = "pending" | "ready" | "failed";

/**
 * Charge / register a hub play before the scratch surface mounts, or claim the
 * play the launching screen registered just before navigating here.
 * Skip for pack-linked `game=1` hands and StageNav playlists — those are not
 * pay-to-play collection launches.
 */
export function PaidCardPlayGate({
  kind,
  cardId,
  skip,
  onLeave,
  children,
}: {
  kind: CardKind;
  cardId: string;
  skip?: boolean;
  onLeave: () => void;
  children: ReactNode;
}) {
  const { authReady } = useAuthSession();
  const registerPlay = useRegisterCardPlayOutcome();
  // Register once per card after the session probe; later auth / wallet churn
  // must not tear down a surface that is already mounted.
  const registerPlayRef = useRef(registerPlay);
  useEffect(() => {
    registerPlayRef.current = registerPlay;
  }, [registerPlay]);
  const id = cardId.trim();
  const bypass = Boolean(skip) || !id;
  const [status, setStatus] = useState<GateStatus>(bypass ? "ready" : "pending");
  const [attempt, setAttempt] = useState(0);
  // A re-run of the same attempt (StrictMode, auth churn) must reuse its
  // request: the claimed handoff is gone, so a new call would charge again.
  const pendingRef = useRef<{
    key: string;
    request: Promise<CardPlayOutcome>;
  } | null>(null);

  useEffect(() => {
    if (bypass) {
      setStatus("ready");
      return;
    }
    setStatus("pending");
    // `authed` is false until the session probe lands — registering earlier
    // would take the guest path and mount a signed-in user's card unpaid.
    if (!authReady) return;
    let cancelled = false;
    const key = `${attempt}:${kind}:${id}`;
    if (pendingRef.current?.key !== key) {
      pendingRef.current = {
        key,
        request: registerPlayRef.current(kind, id, "claim"),
      };
    }
    void pendingRef.current.request.then((outcome) => {
      if (cancelled) return;
      if (outcome === "ok") setStatus("ready");
      else if (outcome === "failed") setStatus("failed");
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, authReady, bypass, id, kind]);

  if (status === "ready") return children;
  return (
    <div className="app-shell app-shell--game">
      <div className="stage-game" aria-busy={status === "pending"}>
        {status === "failed" ? (
          <div className="play-gate-error" role="alert">
            <p className="play-gate-error__title">Couldn’t start this card</p>
            <p className="play-gate-error__copy">
              Check your connection, then try again.
            </p>
            <div className="play-gate-error__actions">
              <button
                type="button"
                className="play-gate-error__cta"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Try again
              </button>
              <button
                type="button"
                className="play-gate-error__cta play-gate-error__cta--ghost"
                onClick={onLeave}
              >
                Back
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
