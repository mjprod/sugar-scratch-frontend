import { useEffect, useMemo, useRef, useState } from 'react'
import { memoryNavigate } from '@/lib/memory/memoryNavigate'
import { CtaButton, ctaButtonPropsFromTemplate } from '@/components/cta'
import { CoinLottie } from '@/components/ui/CoinLottie'
import { DiamondLottie } from '@/components/ui/DiamondLottie'
import { CardFan } from '@/features/reveal/components/CardFan'
import {
  DEFAULT_BACK_URL,
  type RevealCard,
} from '@/features/reveal/lib/cards'
import { HOLO_EFFECTS } from '@/features/reveal/lib/effects'
import { loadFanDrag } from '@/features/reveal/lib/fanDrag'
import { loadFanLayout } from '@/features/reveal/lib/fanLayout'
import { useCatalog } from '@/shared/catalog/CatalogContext'
import { useMarkPageReady } from '@/shared/ui/PageTransition'
import { unlockCountdownSound } from './modules/InitialCountdown'
import { PackNoMatchResult } from './modules/PackNoMatchResult'
import { useWallet } from '@/contexts/WalletContext'
import { Paths } from '@/routes/Paths'
import {
  beginPhotoPhase,
  clearGameSession,
  gameSessionStorageKey,
  firstMissingMotionCardId,
  loadGameSession,
  settleHubWalletFromSession,
  motionPlayHref,
  persistGameProgress,
  photoPlayHref,
  startMotionSession,
  type GameSession,
} from './modules/gameSession'
import {
  buildDealtRound,
  loadGameCatalog,
  type PhotoCard,
  type ThemedMotionCard,
} from './modules/session'
import '@/features/reveal/reveal.css'
import './gameHub.css'

type Phase =
  | 'loading'
  | 'idle'
  | 'dealing'
  | 'ready'
  | 'photo_reveal'
  | 'done'

const PRIZE_REVEAL_MS = 420

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function PhotoLayers({ photo }: { photo: PhotoCard }) {
  return (
    <div className="game-hub-pack__photo-layers">
      <img alt="" src={photo.background} />
      <img alt="" src={photo.bikini} />
      <img alt="" src={photo.clothes} />
    </div>
  )
}

function motionHandToRevealCards(
  hand: ThemedMotionCard[],
  overlay: {
    name: string
    city?: string
    country?: string
    flagEmoji?: string
    flagSvgUrl?: string
    gradientColor?: string
    gradientColorEnd?: string
  },
): RevealCard[] {
  return hand.map((card, index) => {
    const effect = HOLO_EFFECTS[index % HOLO_EFFECTS.length]!
    return {
      id: card.id,
      name: card.label,
      mediaType: 'video' as const,
      // Card face = front (clothed) clip; bottom is the under-scratch background.
      mediaUrl: card.foreground || card.bottom,
      backUrl: DEFAULT_BACK_URL,
      effect,
      overlay: {
        ...overlay,
        name: overlay.name || card.label,
        cardNumber: String(index + 1).padStart(2, '0'),
      },
    }
  })
}

function HubCtaButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="game-hub-pack__cta-primary">
      <CtaButton
        {...ctaButtonPropsFromTemplate('squircleCTA')}
        fillParent
        type="button"
        label={label}
        costAmount={null}
        fontSize={15}
        strokeWidth={1}
        disabled={disabled}
        onClick={onClick}
      />
    </div>
  )
}

function HubRewardTally({
  diamonds,
  coins = 0,
}: {
  diamonds: number;
  coins?: number;
}) {
  const showCoins = coins > 0;
  const showDiamonds = diamonds > 0;
  const noRewards = !showCoins && !showDiamonds;
  const parts = [
    showCoins ? `${coins} coin${coins === 1 ? "" : "s"}` : null,
    showDiamonds
      ? `${diamonds} diamond${diamonds === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return (
    <div
      className="game-hub-pack__tally"
      role="status"
      aria-label={
        noRewards
          ? "Game complete. No rewards this pack."
          : `Game complete. ${parts.join(" and ")} earned.`
      }
    >
      <p className="game-hub-pack__kicker">GAME COMPLETE</p>
      <h2 className="game-hub-pack__tally-title">
        {noRewards ? "Pack Finished" : "Rewards Earned"}
      </h2>
      <p className="game-hub-pack__tally-subtitle">
        {noRewards
          ? "No coins or diamonds this round — try another pack."
          : "Added to your wallet from this pack."}
      </p>
      {!noRewards ? (
        <div className="game-hub-pack__tally-reward">
          {showCoins ? (
            <div className="game-hub-pack__tally-item">
              <div className="game-hub-pack__tally-icon" aria-hidden="true">
                <CoinLottie size={72} loop autoplay />
              </div>
              <p className="game-hub-pack__tally-value">{coins}</p>
              <p className="game-hub-pack__tally-label">
                Coin{coins === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}
          {showDiamonds ? (
            <div className="game-hub-pack__tally-item">
              <div className="game-hub-pack__tally-icon" aria-hidden="true">
                <DiamondLottie size={80} />
              </div>
              <p className="game-hub-pack__tally-value">{diamonds}</p>
              <p className="game-hub-pack__tally-label">
                Diamond{diamonds === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function GameHub() {
  const catalog = useCatalog()
  const { addCoins, addDiamonds } = useWallet()
  const [phase, setPhase] = useState<Phase>('loading')
  const [motionPool, setMotionPool] = useState<ThemedMotionCard[]>([])
  const [photoPool, setPhotoPool] = useState<PhotoCard[]>([])
  const [hand, setHand] = useState<ThemedMotionCard[]>([])
  const [session, setSession] = useState<GameSession | null>(null)
  const [wonPhotos, setWonPhotos] = useState<PhotoCard[]>([])
  const [prizeRevealed, setPrizeRevealed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fanActive, setFanActive] = useState(false)
  const [showPlay, setShowPlay] = useState(false)
  const [fanRunId, setFanRunId] = useState(0)
  const runIdRef = useRef(0)
  const resumedRef = useRef(false)
  const walletCreditRef = useRef(false)
  const [fanLayout] = useState(() => loadFanLayout())
  const [fanDrag] = useState(() => loadFanDrag())

  const shared = catalog.productSharedMedia
  const overlay = useMemo(
    () => ({
      name: shared.girlName.trim() || 'Juliana',
      city: shared.influencerCity,
      country: shared.influencerCountry,
      flagEmoji: shared.flagEmoji,
      flagSvgUrl: shared.flagSvgUrl,
      gradientColor: shared.overlayBackgroundColor,
      gradientColorEnd: shared.overlayBackgroundColorEnd,
    }),
    [shared],
  )

  const revealCards = useMemo(
    () => motionHandToRevealCards(hand, overlay),
    [hand, overlay],
  )

  useEffect(() => {
    const warm = () => unlockCountdownSound()
    window.addEventListener('pointerdown', warm, { capture: true, once: true })
    return () => window.removeEventListener('pointerdown', warm, true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await loadGameCatalog()
        if (cancelled) return
        setMotionPool(loaded.motion)
        setPhotoPool(loaded.photos)

        const existing = loadGameSession()
        if (existing?.phase === 'photo_reveal' || existing?.phase === 'done') {
          setSession(existing)
          const photos = existing.wonPhotoIds
            .map((id) => loaded.photos.find((photo) => photo.id === id))
            .filter((photo): photo is PhotoCard => Boolean(photo))
          setWonPhotos(photos)
          const dealt = existing.motionCardIds
            .map((id) => loaded.motion.find((card) => card.id === id))
            .filter((card): card is ThemedMotionCard => Boolean(card))
          setHand(dealt)
          setFanActive(false)
          setShowPlay(false)
          setPhase(existing.phase === 'done' ? 'done' : 'photo_reveal')
          return
        }

        if (existing?.phase === 'motion' || existing?.phase === 'photo') {
          setSession(existing)
          const dealt = existing.motionCardIds
            .map((id) => loaded.motion.find((card) => card.id === id))
            .filter((card): card is ThemedMotionCard => Boolean(card))
          setHand(dealt)
          setFanActive(true)
          setShowPlay(true)
          setFanRunId((n) => n + 1)
          setPhase('ready')
          return
        }

        setPhase('idle')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load cards')
        setPhase('idle')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useMarkPageReady(phase !== 'loading')

  useEffect(() => {
    if (phase !== 'done' || !session) return
    if (session.walletCredited || walletCreditRef.current) return
    walletCreditRef.current = true
    // Hub: apply coinTotal + diamondTotal once. Pack: reveal/event already
    // credited the wallet — settleHubWalletFromSession only marks credited.
    const marked = settleHubWalletFromSession(addDiamonds, addCoins)
    if (marked) setSession(marked)
  }, [phase, session, addCoins, addDiamonds])

  useEffect(() => {
    if (phase !== 'photo_reveal' || resumedRef.current || wonPhotos.length === 0) {
      return
    }
    resumedRef.current = true
    let cancelled = false
    void (async () => {
      setPrizeRevealed(0)
      for (let i = 0; i < wonPhotos.length; i += 1) {
        if (cancelled) return
        await wait(PRIZE_REVEAL_MS)
        if (cancelled) return
        setPrizeRevealed(i + 1)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase, wonPhotos])

  const handLocked =
    Boolean(session) &&
    (session!.phase === 'motion' || session!.phase === 'photo')
  const canDeal =
    !busy &&
    (phase === 'idle' ||
      phase === 'done' ||
      phase === 'photo_reveal' ||
      (phase === 'ready' && !handLocked))
  const showFan =
    hand.length > 0 && (phase === 'dealing' || phase === 'ready')
  const playLabel =
    session?.phase === 'photo'
      ? 'Continue'
      : session?.phase === 'motion' && session.completedMotionIds.length > 0
        ? 'Continue'
        : 'Play now'
  const statusLabel =
    phase === 'loading'
      ? 'Loading cards…'
      : phase === 'dealing'
        ? 'Opening pack…'
        : handLocked
          ? session!.phase === 'photo'
            ? `Game in progress · ${session!.completedPhotoIds.length}/${session!.wonPhotoIds.length} photos`
            : `Game in progress · ${session!.completedMotionIds.length}/${session!.motionCardIds.length} cards`
          : null

  async function startNewGame() {
    if (!canDeal) return
    if (motionPool.length === 0) {
      setError('No motion cards available.')
      return
    }
    const next = buildDealtRound(motionPool, photoPool)
    if (!next) {
      setError('Need motion cards with distinct themes to deal a hand.')
      return
    }
    clearGameSession("hub")
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setBusy(true)
    setError(null)
    setSession(null)
    setWonPhotos([])
    setPrizeRevealed(0)
    resumedRef.current = false
    walletCreditRef.current = false
    setShowPlay(false)
    setFanActive(false)
    setHand(next.cards)
    setPhase('dealing')
    setFanRunId((n) => n + 1)

    // Let CardFan remount closed, then kick the open animation.
    await wait(40)
    if (runIdRef.current !== runId) return
    setFanActive(true)
  }

  function handleFanComplete() {
    if (phase !== 'dealing' && phase !== 'ready') return
    setPhase('ready')
    setShowPlay(true)
    setBusy(false)
  }

  function playMotionHand() {
    if (busy || hand.length === 0) return
    unlockCountdownSound()
    const existing = loadGameSession()
    if (existing?.phase === 'motion' || existing?.phase === 'photo') {
      if (existing.phase === 'photo') {
        const started = beginPhotoPhase() ?? existing
        memoryNavigate(photoPlayHref(started))
        return
      }
      memoryNavigate(motionPlayHref(existing, firstMissingMotionCardId(existing)))
      return
    }
    const created = startMotionSession(hand)
    setSession(created)
    memoryNavigate(motionPlayHref(created))
  }

  function playPhotoHand() {
    const current = loadGameSession()
    if (!current || current.wonPhotoIds.length === 0) {
      setError('No photo scratches won this round.')
      return
    }
    unlockCountdownSound()
    const started = beginPhotoPhase() ?? current
    setSession(started)
    memoryNavigate(photoPlayHref(started))
  }

  function savePhotoCardsForLater() {
    persistGameProgress()
    memoryNavigate(Paths.collection)
  }

  function deleteGame() {
    if (busy) return
    const hasProgress =
      Boolean(session) ||
      hand.length > 0 ||
      phase === 'photo_reveal' ||
      phase === 'done'
    if (!hasProgress) return
    if (
      !window.confirm(
        'Delete this game? Your hand and any scratch progress will be lost.',
      )
    ) {
      return
    }
    runIdRef.current += 1
    clearGameSession(session ? gameSessionStorageKey(session) : "hub")
    setSession(null)
    setHand([])
    setWonPhotos([])
    setPrizeRevealed(0)
    resumedRef.current = false
    walletCreditRef.current = false
    setError(null)
    setBusy(false)
    setFanActive(false)
    setShowPlay(false)
    setPhase('idle')
  }

  const packNoMatch =
    phase === 'photo_reveal' && session?.wonPhotoIds.length === 0

  const canDelete =
    !busy &&
    phase !== 'loading' &&
    phase !== 'dealing' &&
    (Boolean(session) || hand.length > 0)

  return (
    <div className="stage-game-hub">
      <div className="packs-circle packs-circle--bloom" aria-hidden="true" />
      <div className="packs-circle packs-circle--core" aria-hidden="true" />

      <div className={`game-hub-pack game-hub-pack--${phase}`}>
        {statusLabel ? (
          <p className="game-hub-pack__status" aria-live="polite">
            {statusLabel}
          </p>
        ) : null}
        {error ? <p className="game-hub-pack__error">{error}</p> : null}

        <section className="game-hub-pack__stage" aria-live="polite">
          {phase === 'idle' ? (
            <div className="game-hub-pack__idle">
              <div className="game-hub-pack__idle-stack" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`game-hub-pack__idle-card game-hub-pack__idle-card--${i}`}
                  />
                ))}
              </div>
              <p>New Game deals five themed cards — then Play to scratch</p>
            </div>
          ) : null}

          {showFan ? (
            <div className="game-hub-pack__fan reveal-stage__fan">
              <CardFan
                key={`hub-fan-${fanRunId}`}
                cards={revealCards}
                active={fanActive}
                layout={fanLayout}
                dragConfig={fanDrag}
                liveEdit={false}
                onComplete={handleFanComplete}
              />
            </div>
          ) : null}

          {packNoMatch ? <PackNoMatchResult /> : null}

          {phase === 'photo_reveal' && session && !packNoMatch ? (
            <div className="game-hub-pack__prizes">
              <p className="game-hub-pack__kicker">PACK COMPLETE</p>
              <h2>
                {session.wonPhotoIds.length} Photo Card
                {session.wonPhotoIds.length === 1 ? '' : 's'} Revealed
              </h2>
              <p className="game-hub-pack__owned">Added to your Collection ✓</p>
              {wonPhotos.length > 0 ? (
                <div className="game-hub-pack__prize-grid">
                  {wonPhotos.map((photo, index) => (
                    <article
                      key={photo.id}
                      className={`game-hub-pack__prize${
                        index < prizeRevealed ? ' is-shown' : ''
                      }`}
                    >
                      <div className="game-hub-pack__prize-inner">
                        <PhotoLayers photo={photo} />
                        <span>{photo.label}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === 'done' && session ? (
            <HubRewardTally
              diamonds={session.diamondTotal}
              coins={session.coinTotal ?? 0}
            />
          ) : null}
        </section>

        <div
          className={`game-hub-pack__cta${packNoMatch ? ' is-no-match' : ''}`}
        >
          {phase === 'idle' ? (
            <HubCtaButton
              label="New Game"
              onClick={() => void startNewGame()}
              disabled={!canDeal}
            />
          ) : null}

          {phase === 'photo_reveal' &&
          session &&
          session.wonPhotoIds.length > 0 ? (
            <>
              <HubCtaButton label="Scratch Photo Cards" onClick={playPhotoHand} />
              <button
                type="button"
                className="game-hub-pack__link reveal-replay"
                onClick={savePhotoCardsForLater}
              >
                Save to Collection
              </button>
            </>
          ) : null}

          {phase === 'photo_reveal' &&
          session &&
          session.wonPhotoIds.length === 0 ? (
            <>
              <HubCtaButton
                label="View Collection"
                onClick={() => {
                  persistGameProgress()
                  memoryNavigate(Paths.collection)
                }}
              />
              <button
                type="button"
                className="game-hub-pack__link reveal-replay"
                onClick={() => {
                  clearGameSession(
                    session ? gameSessionStorageKey(session) : "hub",
                  )
                  memoryNavigate(Paths.home)
                }}
              >
                Done
              </button>
            </>
          ) : null}

          {phase === 'done' ? (
            <>
              <HubCtaButton
                label="View Collection"
                onClick={() => {
                  persistGameProgress()
                  memoryNavigate(Paths.collection)
                }}
              />
              <button
                type="button"
                className="game-hub-pack__link reveal-replay"
                onClick={() => {
                  clearGameSession(
                    session ? gameSessionStorageKey(session) : "hub",
                  )
                  memoryNavigate(Paths.home)
                }}
              >
                Done
              </button>
            </>
          ) : null}

          {phase === 'ready' && showPlay ? (
            <HubCtaButton
              label={playLabel}
              onClick={playMotionHand}
              disabled={busy || hand.length === 0}
            />
          ) : null}

          <div className="game-hub-pack__secondary">
            {phase === 'ready' && showPlay && canDeal && !session?.packScratch ? (
              <button
                type="button"
                className="game-hub-pack__link reveal-replay"
                disabled={!canDeal}
                onClick={() => void startNewGame()}
              >
                Replay open
              </button>
            ) : null}
            {canDelete &&
            phase !== 'photo_reveal' &&
            phase !== 'done' &&
            !session?.packScratch ? (
              <button
                type="button"
                className="game-hub-pack__link game-hub-pack__link--danger"
                onClick={deleteGame}
              >
                Delete game
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
