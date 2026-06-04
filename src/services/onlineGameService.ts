import type { RealtimeChannel } from "@supabase/supabase-js";
import { applySharedTimer, continueCheck, createGame } from "@/game/engine";
import type { GameState } from "@/game/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getStoredPlayerId, storePlayerId } from "./playerSession";

export type OnlineStatus = "waiting" | "playing" | "finished";

export type OnlinePlayer = {
  id: string;
  name: string;
  seat_index: number;
  is_host: boolean;
  is_connected: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OnlineAppState = {
  id: "main";
  status: OnlineStatus;
  host_player_id: string | null;
  game_state_json: GameState | null;
  created_at: string;
  updated_at: string;
};

const MAIN_ID = "main";

const makeChannelName = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const statusForGameState = (gameState: GameState): OnlineStatus =>
  gameState.phase === "gameOver" ? "finished" : "playing";

export const ensureAppState = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("app_state").select("*").eq("id", MAIN_ID).maybeSingle();

  if (error) throw error;
  if (data) return data as OnlineAppState;

  const inserted = await supabase
    .from("app_state")
    .insert({ id: MAIN_ID, status: "waiting" })
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data as OnlineAppState;
};

export const getPlayers = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("seat_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OnlinePlayer[];
};

export const getPlayer = async (playerId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();

  if (error) throw error;
  return data as OnlinePlayer | null;
};

export const getAppState = async () => ensureAppState();

export const createLobby = async (name: string) => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  await ensureAppState();

  const resetState = await supabase
    .from("app_state")
    .upsert({
      id: MAIN_ID,
      status: "waiting",
      host_player_id: null,
      game_state_json: null,
      updated_at: now
    })
    .select("*")
    .single();

  if (resetState.error) throw resetState.error;

  const deletedPlayers = await supabase.from("players").delete().not("id", "is", null);
  if (deletedPlayers.error) throw deletedPlayers.error;

  const { data, error } = await supabase
    .from("players")
    .insert({
      name,
      seat_index: 0,
      is_host: true,
      is_connected: true,
      last_seen_at: now
    })
    .select("*")
    .single();

  if (error) throw error;

  const player = data as OnlinePlayer;
  storePlayerId(player.id);

  const updatedState = await supabase
    .from("app_state")
    .update({ host_player_id: player.id, updated_at: new Date().toISOString() })
    .eq("id", MAIN_ID);

  if (updatedState.error) throw updatedState.error;

  return player;
};

export const joinLobby = async (name: string) => {
  const supabase = getSupabaseClient();
  const appState = await ensureAppState();

  if (appState.status !== "waiting") {
    const storedId = getStoredPlayerId();
    if (storedId) {
      const existing = await getPlayer(storedId);
      if (existing) return existing;
    }

    throw new Error("Game already started");
  }

  const storedId = getStoredPlayerId();
  if (storedId) {
    const existing = await getPlayer(storedId);
    if (existing) {
      const { data, error } = await supabase
        .from("players")
        .update({
          name,
          is_connected: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", storedId)
        .select("*")
        .single();

      if (error) throw error;
      return data as OnlinePlayer;
    }
  }

  const players = await getPlayers();
  if (players.length >= 5) throw new Error("Game is full");

  const usedSeats = new Set(players.map((player) => player.seat_index));
  const seatIndex = [0, 1, 2, 3, 4].find((seat) => !usedSeats.has(seat)) ?? players.length;
  const isHost = players.length === 0;

  const { data, error } = await supabase
    .from("players")
    .insert({
      name,
      seat_index: seatIndex,
      is_host: isHost,
      is_connected: true,
      last_seen_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) throw error;

  const player = data as OnlinePlayer;
  storePlayerId(player.id);

  if (isHost || !appState.host_player_id) {
    await supabase
      .from("app_state")
      .update({ host_player_id: player.id, updated_at: new Date().toISOString() })
      .eq("id", MAIN_ID);
  }

  return player;
};

export const startOnlineGame = async (players: OnlinePlayer[], requesterPlayerId: string) => {
  const supabase = getSupabaseClient();
  const appState = await ensureAppState();
  const seatedPlayers = [...players].sort((a, b) => a.seat_index - b.seat_index).slice(0, 5);
  const hostPlayerId = appState.host_player_id ?? seatedPlayers.find((player) => player.is_host)?.id;

  if (hostPlayerId !== requesterPlayerId) throw new Error("Only the host can start the game");
  if (seatedPlayers.length < 3) throw new Error("Need at least 3 players");

  const gameState = applySharedTimer(createGame(seatedPlayers.map((player) => player.name)));
  const previousWinCounts = appState.game_state_json?.winCounts ?? {};
  const previousWinnerId = appState.game_state_json?.winnerId;
  const startingPlayerIndex = previousWinnerId
    ? seatedPlayers.findIndex((player) => player.id === previousWinnerId)
    : -1;

  gameState.players = gameState.players.map((player, index) => ({
    ...player,
    id: seatedPlayers[index].id,
    name: seatedPlayers[index].name
  }));
  gameState.currentPlayerIndex = startingPlayerIndex >= 0 ? startingPlayerIndex : 0;
  gameState.winCounts = Object.fromEntries(
    seatedPlayers.map((player) => [player.id, previousWinCounts[player.id] ?? 0])
  );

  const { error } = await supabase
    .from("app_state")
    .update({
      status: "playing",
      game_state_json: gameState,
      updated_at: new Date().toISOString()
    })
    .eq("id", MAIN_ID);

  if (error) throw error;
  return gameState;
};

export const returnToLobbyForNextRound = async (requesterPlayerId: string) => {
  const supabase = getSupabaseClient();
  const appState = await ensureAppState();

  if (appState.host_player_id !== requesterPlayerId) throw new Error("Only the host can play again");

  const { error } = await supabase
    .from("app_state")
    .update({
      status: "waiting",
      game_state_json: appState.game_state_json,
      updated_at: new Date().toISOString()
    })
    .eq("id", MAIN_ID);

  if (error) throw error;
};

export const updateOnlineGameState = async (gameState: GameState, status?: OnlineStatus) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("app_state")
    .update({
      status: status ?? statusForGameState(gameState),
      game_state_json: gameState,
      updated_at: new Date().toISOString()
    })
    .eq("id", MAIN_ID);

  if (error) throw error;
};

export const continueOnlineCheck = async (playerId: string): Promise<GameState> => {
  const supabase = getSupabaseClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const appState = await ensureAppState();
    const latestGameState = appState.game_state_json;
    if (!latestGameState) throw new Error("No active game");

    const nextGameState = continueCheck(latestGameState, playerId);
    const { data, error } = await supabase
      .from("app_state")
      .update({
        status: statusForGameState(nextGameState),
        game_state_json: nextGameState,
        updated_at: new Date().toISOString()
      })
      .eq("id", MAIN_ID)
      .eq("updated_at", appState.updated_at)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (data) return (data as OnlineAppState).game_state_json ?? nextGameState;
  }

  const appState = await ensureAppState();
  if (!appState.game_state_json) throw new Error("No active game");
  return appState.game_state_json;
};

export const subscribePlayers = (onChange: () => void): RealtimeChannel => {
  const supabase = getSupabaseClient();
  return supabase
    .channel(makeChannelName("players-changes"))
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, onChange)
    .subscribe();
};

export const subscribeAppState = (onChange: (state: OnlineAppState) => void): RealtimeChannel => {
  const supabase = getSupabaseClient();
  return supabase
    .channel(makeChannelName("app-state-changes"))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_state", filter: `id=eq.${MAIN_ID}` },
      (payload) => onChange(payload.new as OnlineAppState)
    )
    .subscribe();
};

export const unsubscribe = async (channel: RealtimeChannel) => {
  const supabase = getSupabaseClient();
  await supabase.removeChannel(channel);
};
