"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applySharedTimer,
  cancelTargetSelection,
  completeAmbassadorExchange,
  continueCheck,
  expireGameTimer,
  getLegalActions,
  pauseGame,
  revealInfluence,
  resumeGame,
  resolveCheck,
  resolveResponse,
  selectAction,
  selectTarget,
  withSharedTimerDisplay
} from "@/game/engine";
import { getActivePlayer } from "@/game/validation";
import type { GameState, PlayerId, ResponseType, TurnAction } from "@/game/types";
import { ActionButtons } from "./ActionButtons";
import { ActionModal } from "./ActionModal";
import { Card } from "./Card";
import { CheckModal } from "./CheckModal";
import { InfluenceLossModal } from "./InfluenceLossModal";
import { ResponseModal } from "./ResponseModal";
import { TargetSelection } from "./TargetSelection";

const COUP_RESULT_DELAY_MS = 1100;
const COUP_FLASH_DURATION_MS = 2800;

type GameBoardProps = {
  initialGame: GameState;
  onGameOver: (gameState: GameState) => void;
  viewerPlayerId?: PlayerId;
  hideViewerSelect?: boolean;
  onlineMode?: boolean;
  enableTimers?: boolean;
  isHost?: boolean;
  hostPlayerId?: PlayerId;
  onGameStateChange?: (gameState: GameState) => void | Promise<void>;
  onContinueCheck?: (playerId: PlayerId) => Promise<GameState | undefined>;
};

export function GameBoard({
  initialGame,
  onGameOver,
  viewerPlayerId,
  hideViewerSelect = false,
  onlineMode = false,
  enableTimers = true,
  isHost = false,
  hostPlayerId,
  onGameStateChange,
  onContinueCheck
}: GameBoardProps) {
  const [gameState, setGameState] = useState(initialGame);
  const [now, setNow] = useState(() => Date.now());
  const [localViewerId, setLocalViewerId] = useState<PlayerId>(viewerPlayerId ?? initialGame.players[0].id);
  const [localCoupFlash, setLocalCoupFlash] = useState<{
    id: string;
    result: "success" | "failed";
    resultAt: number;
    expiresAt: number;
  }>();
  const handledTimeoutRef = useRef<string | undefined>(undefined);
  const lastCoupFlashIdRef = useRef<string | undefined>(undefined);

  const displayGameState = useMemo(() => withSharedTimerDisplay(gameState, now), [gameState, now]);
  const viewerId = viewerPlayerId ?? localViewerId;
  const viewer = displayGameState.players.find((player) => player.id === viewerId) ?? displayGameState.players[0];
  const activePlayer = getActivePlayer(displayGameState);
  const pausedByPlayer = displayGameState.players.find((player) => player.id === displayGameState.pausedByPlayerId);
  const hostPlayer = displayGameState.players.find((player) => player.id === hostPlayerId);
  const legalActions = useMemo(() => getLegalActions(displayGameState, viewer.id), [displayGameState, viewer.id]);
  const opponents = displayGameState.players.filter((player) => player.id !== viewer.id);
  const hasFivePlayers = displayGameState.players.length === 5;
  const tableTopPlayer = hasFivePlayers ? undefined : opponents[0];
  const tableTopLeftPlayer = hasFivePlayers ? opponents[0] : undefined;
  const tableTopRightPlayer = hasFivePlayers ? opponents[1] : undefined;
  const tableLeftPlayer = hasFivePlayers ? opponents[2] : opponents[1];
  const tableRightPlayer = hasFivePlayers ? opponents[3] : opponents[2];
  const roomyOpponentCards = !hasFivePlayers;
  const visibleActionBubble =
    displayGameState.actionBubble && displayGameState.actionBubble.expiresAt > now
      ? displayGameState.actionBubble
      : undefined;
  const visibleCoupFlash = localCoupFlash && localCoupFlash.expiresAt > now ? localCoupFlash : undefined;
  const showCoupResult = Boolean(visibleCoupFlash?.resultAt && now >= visibleCoupFlash.resultAt);
  const coupFlashText = showCoupResult
    ? visibleCoupFlash?.result === "success"
      ? "SUCCESS"
      : "FAILED"
    : "COUP";
  const coupFlashTextClass = showCoupResult
    ? visibleCoupFlash?.result === "success"
      ? "text-emerald-400 drop-shadow-[0_8px_0_rgba(6,78,59,0.95)]"
      : "text-red-500 drop-shadow-[0_8px_0_rgba(127,29,29,0.95)]"
    : "text-red-700 drop-shadow-[0_8px_0_rgba(15,23,42,0.95)]";

  const commitGameState = (next: GameState) => {
    if (next === gameState) return;

    const nextWithTimer = applySharedTimer(next);
    setGameState(nextWithTimer);
    void onGameStateChange?.(nextWithTimer);
    if (nextWithTimer.phase === "gameOver") {
      onGameOver(nextWithTimer);
    }
  };

  useEffect(() => {
    setGameState(initialGame);
  }, [initialGame]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const nextCoupFlash = gameState.coupFlash;
    if (!nextCoupFlash || nextCoupFlash.id === lastCoupFlashIdRef.current) return;

    const startedAt = Date.now();
    lastCoupFlashIdRef.current = nextCoupFlash.id;
    setLocalCoupFlash({
      id: nextCoupFlash.id,
      result: nextCoupFlash.result,
      resultAt: startedAt + COUP_RESULT_DELAY_MS,
      expiresAt: startedAt + COUP_FLASH_DURATION_MS
    });
    setNow(startedAt);
  }, [gameState.coupFlash]);

  useEffect(() => {
    if (!enableTimers) return;
    if (gameState.isPaused) return;
    if (
      gameState.phase !== "playing" &&
      gameState.phase !== "selectingTarget" &&
      gameState.phase !== "pendingCheck" &&
      gameState.phase !== "pendingBlockOrResponse"
    ) {
      return;
    }

    if (!gameState.timerEndsAt) {
      const nextWithTimer = applySharedTimer(gameState);
      setGameState(nextWithTimer);
      void onGameStateChange?.(nextWithTimer);
      return;
    }

    if (gameState.timerEndsAt > now) return;
    const timeoutKey = [
      gameState.id,
      gameState.phase,
      gameState.turnNumber,
      gameState.currentPlayerIndex,
      gameState.pendingCheck?.id ?? gameState.pendingResponse?.id ?? gameState.targetSelection?.action ?? "turn",
      gameState.timerEndsAt
    ].join(":");

    if (handledTimeoutRef.current === timeoutKey) return;
    handledTimeoutRef.current = timeoutKey;

    const next = expireGameTimer(gameState);
    commitGameState(next);
  }, [enableTimers, gameState, now, onGameStateChange]);

  const handleAction = (action: TurnAction) => {
    if (gameState.isPaused) return;
    const next = selectAction(gameState, viewer.id, action);
    commitGameState(next);
  };

  const handleTarget = (targetId: PlayerId) => {
    if (gameState.isPaused) return;
    commitGameState(selectTarget(gameState, viewer.id, targetId));
  };

  const handleResponse = (playerId: PlayerId, response: ResponseType) => {
    if (gameState.isPaused) return;
    commitGameState(resolveResponse(gameState, playerId, response));
  };

  const handleContinueCheck = async (playerId: PlayerId) => {
    if (gameState.isPaused) return;

    if (onContinueCheck) {
      const nextGameState = await onContinueCheck(playerId);
      if (nextGameState) {
        const nextWithTimer = applySharedTimer(nextGameState);
        setGameState(nextWithTimer);
        if (nextWithTimer.phase === "gameOver") {
          onGameOver(nextWithTimer);
        }
      }
      return;
    }

    commitGameState(continueCheck(gameState, playerId));
  };

  const handleExchange = (playerId: PlayerId, oldCardId: string, offeredCardId: string) => {
    if (gameState.isPaused) return;
    commitGameState(completeAmbassadorExchange(gameState, playerId, oldCardId, offeredCardId));
  };

  const handlePause = () => {
    if (!isHost || gameState.isPaused) return;
    commitGameState(pauseGame(gameState, viewer.id));
  };

  const handleResume = () => {
    if (!isHost || !gameState.isPaused) return;
    commitGameState(resumeGame(gameState));
  };

  const canSelectTarget = (targetId: PlayerId) =>
    !gameState.isPaused &&
    gameState.phase === "selectingTarget" &&
    gameState.targetSelection?.actorId === viewer.id &&
    targetId !== viewer.id &&
    !gameState.players.find((player) => player.id === targetId)?.eliminated;

  const renderHiddenCards = (playerId: PlayerId) => {
    const player = displayGameState.players.find((item) => item.id === playerId);
    return (
      <div className="flex gap-1.5">
        {player?.cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            hidden={!card.revealed}
            compact={!roomyOpponentCards}
            roomy={roomyOpponentCards}
          />
        ))}
      </div>
    );
  };

  const renderActionBubble = (playerId: PlayerId, placement: "top" | "center" = "top") => {
    if (!visibleActionBubble || visibleActionBubble.playerId !== playerId) return null;

    return (
      <div
        className={[
          "pointer-events-none absolute z-30 rounded-lg border-2 border-slate-950 bg-brass px-3 py-2 text-sm font-black text-ink shadow-lg",
          placement === "center"
            ? "left-1/2 top-2 -translate-x-1/2"
            : "left-1/2 top-0 -translate-x-1/2 -translate-y-3"
        ].join(" ")}
      >
        {visibleActionBubble.label}
      </div>
    );
  };

  const renderTablePlayer = (
    playerId: PlayerId | undefined,
    className: string,
    orientation: "horizontal" | "vertical" = "horizontal"
  ) => {
    const player = displayGameState.players.find((item) => item.id === playerId);
    if (!player) return null;

    return (
      <button
        type="button"
        disabled={!canSelectTarget(player.id)}
        onClick={() => handleTarget(player.id)}
        className={[
          "relative z-10 flex min-w-0 items-center gap-2 rounded-md bg-white/80 p-1.5 text-slate-950 transition",
          orientation === "vertical" ? (roomyOpponentCards ? "min-w-[6.5rem]" : "min-w-[6.25rem]") : "",
          canSelectTarget(player.id) ? "ring-4 ring-amber-400 active:scale-95" : "",
          activePlayer.id === player.id ? "outline outline-2 outline-lime-500" : "",
          player.eliminated ? "opacity-40" : "",
          className
        ].join(" ")}
      >
        {renderActionBubble(player.id)}
        {orientation === "vertical" ? (
          <>
            <div className="flex flex-col gap-1.5">
              {player.cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  hidden={!card.revealed}
                  compact={!roomyOpponentCards}
                  roomy={roomyOpponentCards}
                />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="max-w-[5.75rem] whitespace-normal break-words text-xs font-black leading-tight">{player.name}</p>
              <p className="text-xl font-black text-lime-600">{player.coins}</p>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="max-w-[8.5rem] whitespace-normal break-words text-sm font-black leading-tight">{player.name}</p>
              <p className="text-xl font-black text-lime-600">{player.coins}</p>
            </div>
            {renderHiddenCards(player.id)}
          </>
        )}
      </button>
    );
  };

  return (
    <main className="min-h-dvh bg-[#f4efe5] text-slate-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-3 py-3">
        <header className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="w-20" />
          <p className="text-center text-2xl font-black tracking-wide">TIME: {displayGameState.timer}</p>
          <div className="flex w-20 justify-end">
            {isHost && displayGameState.phase !== "gameOver" ? (
              <button
                type="button"
                onClick={displayGameState.isPaused ? handleResume : handlePause}
                className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white active:scale-95"
              >
                {displayGameState.isPaused ? "RESUME" : "PAUSE"}
              </button>
            ) : null}
          </div>
        </header>

        {!hideViewerSelect ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <label htmlFor="viewer" className="text-xs font-bold uppercase text-slate-500">
              View as
            </label>
            <select
              id="viewer"
              value={viewer.id}
              onChange={(event) => setLocalViewerId(event.target.value)}
              className="min-w-0 flex-1 rounded-md bg-slate-100 px-2 py-2 text-sm font-bold text-slate-950"
            >
              {displayGameState.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <TargetSelection gameState={displayGameState} onCancel={() => commitGameState(cancelTargetSelection(gameState))} />

        {displayGameState.phase === "pendingBlockOrResponse" && displayGameState.pendingResponse ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
            Waiting for{" "}
            {displayGameState.players.find((player) => player.id === displayGameState.pendingResponse?.responderId)?.name ??
              "another player"}
            ...
          </div>
        ) : null}

        <section className="mt-3 flex min-h-[24rem] flex-1 flex-col gap-2 overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-2">
            <div
              className={[
                "min-h-[4.75rem]",
                hasFivePlayers ? "grid grid-cols-2 gap-2" : "flex justify-center"
              ].join(" ")}
            >
              {hasFivePlayers ? (
                <>
                  {renderTablePlayer(tableTopLeftPlayer?.id, "justify-center text-center")}
                  {renderTablePlayer(tableTopRightPlayer?.id, "justify-center text-center")}
                </>
              ) : (
                renderTablePlayer(tableTopPlayer?.id, "justify-center text-center")
              )}
            </div>

            <div
              className={[
                "grid min-h-0 items-center gap-2",
                hasFivePlayers
                  ? "grid-cols-[6.25rem_minmax(8rem,1fr)_6.25rem]"
                  : "grid-cols-[6.5rem_minmax(7.5rem,1fr)_6.5rem]"
              ].join(" ")}
            >
              {renderTablePlayer(tableLeftPlayer?.id, "justify-center", "vertical")}

              <div className="relative mx-auto flex h-full max-h-[18rem] min-h-[15rem] w-full max-w-[13rem] flex-col items-center justify-end p-1 pb-0">
                {renderActionBubble(viewer.id, "center")}
                <p className="max-w-full whitespace-normal break-words text-center text-xl font-black leading-tight">{viewer.name}</p>
                <p className="text-4xl font-black text-lime-600">{viewer.coins}</p>
                <div className="mt-2 flex justify-center gap-2">
                  {viewer.cards.map((card) => (
                    <Card key={card.id} card={card} />
                  ))}
                </div>
              </div>

              {renderTablePlayer(tableRightPlayer?.id, "justify-center", "vertical")}
            </div>

            <div className="min-h-[0.25rem]" />
          </div>
        </section>

        <section className="shrink-0 rounded-t-2xl border border-slate-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-sm">
          <ActionButtons legalActions={legalActions} onAction={handleAction} disabled={Boolean(displayGameState.isPaused)} />
        </section>
      </div>

      {displayGameState.isPaused ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 text-white">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-950 p-6 text-center shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Paused</p>
            <h2 className="mt-3 text-4xl font-black leading-none">
              {(pausedByPlayer?.name ?? hostPlayer?.name ?? "HOST").toUpperCase()} PAUSED
            </h2>
            {isHost ? (
              <button
                type="button"
                onClick={handleResume}
                className="mt-6 w-full rounded-lg bg-white px-4 py-4 text-lg font-black text-slate-950 active:scale-95"
              >
                RESUME
              </button>
            ) : (
              <p className="mt-5 text-sm font-bold text-slate-300">Waiting for host to resume.</p>
            )}
          </div>
        </div>
      ) : null}

      {visibleCoupFlash ? (
        <div className="pointer-events-none fixed inset-0 z-[45] flex items-center justify-center bg-black/35 px-4">
          <div key={showCoupResult ? visibleCoupFlash.result : "coup"} className="coup-flash text-center">
            <div className={["text-7xl font-black leading-none", coupFlashTextClass].join(" ")}>
              {coupFlashText}
            </div>
          </div>
        </div>
      ) : null}

      <ActionModal
        gameState={displayGameState}
        currentPlayerId={viewer.id}
        onlineMode={onlineMode}
        onConfirm={handleExchange}
      />
      <CheckModal
        gameState={displayGameState}
        currentPlayerId={viewer.id}
        onlineMode={onlineMode}
        onCoup={(checkerId) => commitGameState(resolveCheck(gameState, checkerId))}
        onContinue={handleContinueCheck}
      />
      <InfluenceLossModal
        gameState={displayGameState}
        currentPlayerId={viewer.id}
        onlineMode={onlineMode}
        onReveal={(playerId, cardId) => commitGameState(revealInfluence(gameState, playerId, cardId))}
      />
      <ResponseModal
        gameState={displayGameState}
        currentPlayerId={viewer.id}
        onlineMode={onlineMode}
        onRespond={handleResponse}
      />
    </main>
  );
}
