"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAppState,
  getPlayers,
  OnlineAppState,
  OnlinePlayer,
  startOnlineGame,
  subscribeAppState,
  subscribePlayers,
  unsubscribe
} from "@/services/onlineGameService";
import { getStoredPlayerId } from "@/services/playerSession";

export default function LobbyPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [appState, setAppState] = useState<OnlineAppState>();
  const [playerId, setPlayerId] = useState<string>();
  const [error, setError] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);

  const hostPlayerId = appState?.host_player_id ?? players.find((player) => player.is_host)?.id;
  const isCurrentHost = Boolean(playerId && hostPlayerId === playerId);
  const canStart = Boolean(isCurrentHost && players.length >= 3 && players.length <= 5);
  const winCounts = appState?.game_state_json?.winCounts ?? {};
  const hasScoreboard = players.some((player) => (winCounts[player.id] ?? 0) > 0);

  useEffect(() => {
    const storedId = getStoredPlayerId();
    if (!storedId) {
      router.replace("/");
      return;
    }

    setPlayerId(storedId);
    let isMounted = true;

    const refreshLobby = async () => {
      const [nextPlayers, nextAppState] = await Promise.all([getPlayers(), getAppState()]);
      if (!isMounted) return;

      setPlayers(nextPlayers);
      setAppState(nextAppState);

      if (nextAppState.status === "playing") router.replace("/game");
    };

    refreshLobby().catch((caught) => {
      if (isMounted) setError(caught instanceof Error ? caught.message : "Could not load lobby");
    });

    const playersChannel = subscribePlayers(() => {
      refreshLobby().catch(() => undefined);
    });
    const appStateChannel = subscribeAppState((nextState) => {
      if (!isMounted) return;

      setAppState(nextState);
      if (nextState.status === "playing") router.replace("/game");
    });
    const pollingInterval = window.setInterval(() => {
      refreshLobby().catch(() => undefined);
    }, 1500);

    return () => {
      isMounted = false;
      window.clearInterval(pollingInterval);
      unsubscribe(playersChannel);
      unsubscribe(appStateChannel);
    };
  }, [router]);

  const handleStart = async () => {
    setError(undefined);
    setIsStarting(true);

    try {
      if (!playerId) throw new Error("Could not find your player session");

      await startOnlineGame(players, playerId);
      router.push("/game");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start game");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#f4efe5] px-5 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-red-700">Lobby</p>
        <p className="mt-2 text-slate-600">Players joined: {players.length}/5</p>

        <section className="mt-6 rounded-xl border-2 border-slate-950 bg-white p-4 shadow-sm">
          <div className="grid gap-3">
            {players.length === 0 ? (
              <p className="text-sm text-slate-500">Waiting for players...</p>
            ) : (
              players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-black">
                      {player.name} {player.id === playerId ? "(you)" : ""}
                    </p>
                    <p className="text-xs font-bold uppercase text-slate-500">Seat {player.seat_index + 1}</p>
                  </div>
                  {player.id === hostPlayerId ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Host</span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        {hasScoreboard ? (
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-500">Lobby wins</p>
            <div className="mt-3 grid gap-2">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-black">{player.name}</span>
                  <span className="text-xl font-black text-lime-600">{winCounts[player.id] ?? 0}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

        {isCurrentHost ? (
          <button
            type="button"
            disabled={!canStart || isStarting}
            onClick={handleStart}
            className="mt-5 w-full rounded-lg bg-slate-950 px-4 py-4 text-lg font-black text-white disabled:opacity-40"
          >
            {players.length < 3 ? "Need at least 3 players" : isStarting ? "Starting..." : "Start Game"}
          </button>
        ) : null}

        {!isCurrentHost ? <p className="mt-3 text-center text-sm text-slate-500">Waiting for host to start.</p> : null}
        {appState?.status === "finished" ? <p className="mt-3 text-center text-sm text-slate-500">Previous game finished.</p> : null}
      </div>
    </main>
  );
}
