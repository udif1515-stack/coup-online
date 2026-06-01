"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameBoard } from "@/components/GameBoard";
import type { GameState } from "@/game/types";
import {
  getAppState,
  getPlayer,
  OnlineAppState,
  OnlinePlayer,
  returnToLobbyForNextRound,
  subscribeAppState,
  unsubscribe,
  updateOnlineGameState
} from "@/services/onlineGameService";
import { getStoredPlayerId } from "@/services/playerSession";

export default function GamePage() {
  const router = useRouter();
  const [playerId, setPlayerId] = useState<string>();
  const [player, setPlayer] = useState<OnlinePlayer | null>(null);
  const [appState, setAppState] = useState<OnlineAppState>();
  const [gameState, setGameState] = useState<GameState>();
  const [error, setError] = useState<string>();

  const winner = useMemo(
    () => gameState?.players.find((gamePlayer) => gamePlayer.id === gameState.winnerId),
    [gameState]
  );
  const hostPlayerId = appState?.host_player_id ?? (player?.is_host ? player.id : undefined);
  const isCurrentHost = Boolean(playerId && hostPlayerId === playerId);

  useEffect(() => {
    const storedId = getStoredPlayerId();
    if (!storedId) {
      router.replace("/");
      return;
    }

    setPlayerId(storedId);
    let isMounted = true;

    const syncAppState = (nextAppState: OnlineAppState) => {
      if (!isMounted) return;

      setAppState(nextAppState);
      if (nextAppState.status === "waiting") {
        router.replace("/lobby");
        return;
      }

      if (nextAppState.game_state_json) {
        setGameState(nextAppState.game_state_json);
      }
    };

    const load = async () => {
      const [nextPlayer, nextAppState] = await Promise.all([getPlayer(storedId), getAppState()]);
      if (!isMounted) return;

      if (!nextPlayer) {
        router.replace("/");
        return;
      }

      setPlayer(nextPlayer);
      syncAppState(nextAppState);
    };

    load().catch((caught) => {
      if (isMounted) setError(caught instanceof Error ? caught.message : "Could not load game");
    });

    const channel = subscribeAppState(syncAppState);
    const pollingInterval = window.setInterval(() => {
      getAppState().then(syncAppState).catch(() => undefined);
    }, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(pollingInterval);
      unsubscribe(channel);
    };
  }, [router]);

  const handleGameStateChange = async (nextGameState: GameState) => {
    try {
      await updateOnlineGameState(nextGameState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sync game");
    }
  };

  const handleGameOver = async (finishedGame: GameState) => {
    try {
      await updateOnlineGameState(finishedGame, "finished");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not finish game");
    }
  };

  const handlePlayAgain = async () => {
    try {
      if (!playerId) throw new Error("Could not find your player session");

      await returnToLobbyForNextRound(playerId);
      router.push("/lobby");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not return to lobby");
    }
  };

  if (error) {
    return (
      <main className="min-h-dvh bg-[#f4efe5] px-5 py-6 text-slate-950">
        <div className="mx-auto max-w-md rounded-xl border-2 border-red-200 bg-white p-4 text-red-700">
          <p className="font-black">Error</p>
          <p className="mt-2 text-sm font-bold">{error}</p>
          <Link href="/" className="mt-4 block rounded-lg bg-slate-950 px-4 py-3 text-center font-black text-white">
            Back
          </Link>
        </div>
      </main>
    );
  }

  if (!playerId || !player || !appState || !gameState) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4efe5] px-5 text-slate-950">
        <p className="font-black">Loading online game...</p>
      </main>
    );
  }

  if (appState.status === "finished" && winner) {
    return (
      <main className="min-h-dvh bg-[#f4efe5] px-5 py-6 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col justify-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-700">Game Over</p>
          <h1 className="mt-3 text-5xl font-black leading-none">{winner.name.toUpperCase()} WINS</h1>

          <section className="mt-6 rounded-xl border-2 border-slate-950 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-500">Lobby wins</p>
            <div className="mt-3 grid gap-2">
              {gameState.players.map((scorePlayer) => (
                <div key={scorePlayer.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-black">{scorePlayer.name}</span>
                  <span className="text-xl font-black text-lime-600">
                    {(gameState.winCounts ?? {})[scorePlayer.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled={!isCurrentHost}
            onClick={handlePlayAgain}
            className="mt-6 rounded-lg bg-slate-950 px-4 py-4 text-center font-black text-white disabled:bg-slate-300 disabled:text-slate-600"
          >
            {isCurrentHost ? "PLAY AGAIN" : "WAITING FOR HOST"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <GameBoard
      key={gameState.id}
      initialGame={gameState}
      viewerPlayerId={playerId}
      hideViewerSelect
      onlineMode
      enableTimers={Boolean(player.is_host)}
      isHost={isCurrentHost}
      hostPlayerId={hostPlayerId}
      onGameStateChange={handleGameStateChange}
      onGameOver={handleGameOver}
    />
  );
}
