import type { RealtimeChannel } from "@supabase/supabase-js";
import { applySharedTimer, continueCheck, createGame } from "@/game/engine";
import type { GameState } from "@/game/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getStoredPlayerId, storeRoomSession } from "./playerSession";

export type OnlineStatus = "lobby" | "playing" | "finished";

export type OnlinePlayer = {
  id: string;
  room_id: string;
  name: string;
  seat_index: number;
  is_host: boolean;
  is_connected: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OnlineRoom = {
  id: string;
  code: string;
  status: OnlineStatus;
  host_player_id: string | null;
  game_state_json: GameState | null;
  created_at: string;
  updated_at: string;
};

export type OnlineAppState = OnlineRoom;

const ROOM_CODE_LENGTH = 6;
const ROOM_MAX_AGE_HOURS = 2;

const makeChannelName = (roomId: string, suffix: string) => `room-${roomId}-${suffix}`;

const statusForGameState = (gameState: GameState): OnlineStatus =>
  gameState.phase === "gameOver" ? "finished" : "playing";

const normalizeRoomCode = (code: string) => code.trim().replace(/\D/g, "");

const generateRoomCode = () =>
  Math.floor(Math.random() * 10 ** ROOM_CODE_LENGTH)
    .toString()
    .padStart(ROOM_CODE_LENGTH, "0");

const touchRoom = async (roomId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("rooms").update({ updated_at: new Date().toISOString() }).eq("id", roomId);
  if (error) throw error;
};

export const cleanupInactiveRooms = async () => {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - ROOM_MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("rooms").delete().lt("updated_at", cutoff);

  if (error) throw error;
};

export const getRoom = async (roomId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();

  if (error) throw error;
  return data as OnlineRoom | null;
};

export const getRoomByCode = async (code: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("rooms").select("*").eq("code", normalizeRoomCode(code)).maybeSingle();

  if (error) throw error;
  return data as OnlineRoom | null;
};

export const getPlayers = async (roomId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OnlinePlayer[];
};

export const getPlayer = async (playerId: string, roomId?: string) => {
  const supabase = getSupabaseClient();
  let query = supabase.from("players").select("*").eq("id", playerId);

  if (roomId) query = query.eq("room_id", roomId);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data as OnlinePlayer | null;
};

export const getAppState = async (roomId: string) => {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  return room;
};

export const createLobby = async (name: string) => {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  await cleanupInactiveRooms();

  let room: OnlineRoom | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const insertedRoom = await supabase
      .from("rooms")
      .insert({
        code: generateRoomCode(),
        status: "lobby",
        created_at: now,
        updated_at: now
      })
      .select("*")
      .single();

    if (!insertedRoom.error) {
      room = insertedRoom.data as OnlineRoom;
      break;
    }

    if (insertedRoom.error.code !== "23505") throw insertedRoom.error;
  }

  if (!room) throw new Error("Could not create a unique room code");

  const { data, error } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
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
  const updatedRoom = await supabase
    .from("rooms")
    .update({ host_player_id: player.id, updated_at: new Date().toISOString() })
    .eq("id", room.id);

  if (updatedRoom.error) throw updatedRoom.error;

  storeRoomSession(room.id, room.code, player.id);

  return { room: { ...room, host_player_id: player.id }, player };
};

export const joinLobby = async (name: string, roomCode: string) => {
  const supabase = getSupabaseClient();
  const normalizedCode = normalizeRoomCode(roomCode);

  if (normalizedCode.length !== ROOM_CODE_LENGTH) throw new Error("Enter a 6 digit room code");

  await cleanupInactiveRooms();

  const room = await getRoomByCode(normalizedCode);
  if (!room) throw new Error("Room code not found");
  if (room.status !== "lobby") throw new Error("Game already started");

  const storedId = getStoredPlayerId();
  if (storedId) {
    const existing = await getPlayer(storedId, room.id);
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
        .eq("room_id", room.id)
        .select("*")
        .single();

      if (error) throw error;
      await touchRoom(room.id);
      storeRoomSession(room.id, room.code, storedId);
      return { room, player: data as OnlinePlayer };
    }
  }

  const players = await getPlayers(room.id);
  if (players.length >= 5) throw new Error("Game is full");

  const usedSeats = new Set(players.map((player) => player.seat_index));
  const seatIndex = [0, 1, 2, 3, 4].find((seat) => !usedSeats.has(seat)) ?? players.length;
  const isHost = players.length === 0;

  const { data, error } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
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
  storeRoomSession(room.id, room.code, player.id);

  if (isHost || !room.host_player_id) {
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ host_player_id: player.id, updated_at: new Date().toISOString() })
      .eq("id", room.id);

    if (updateError) throw updateError;
  } else {
    await touchRoom(room.id);
  }

  return { room, player };
};

export const startOnlineGame = async (roomId: string, players: OnlinePlayer[], requesterPlayerId: string) => {
  const supabase = getSupabaseClient();
  const room = await getAppState(roomId);
  const seatedPlayers = [...players]
    .filter((player) => player.room_id === roomId)
    .sort((a, b) => a.seat_index - b.seat_index)
    .slice(0, 5);
  const hostPlayerId = room.host_player_id ?? seatedPlayers.find((player) => player.is_host)?.id;

  if (hostPlayerId !== requesterPlayerId) throw new Error("Only the host can start the game");
  if (seatedPlayers.length < 3) throw new Error("Need at least 3 players");

  const gameState = applySharedTimer(createGame(seatedPlayers.map((player) => player.name)));
  const previousWinCounts = room.game_state_json?.winCounts ?? {};
  const previousWinnerId = room.game_state_json?.winnerId;
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
    .from("rooms")
    .update({
      status: "playing",
      game_state_json: gameState,
      updated_at: new Date().toISOString()
    })
    .eq("id", roomId);

  if (error) throw error;
  return gameState;
};

export const returnToLobbyForNextRound = async (roomId: string, requesterPlayerId: string) => {
  const supabase = getSupabaseClient();
  const room = await getAppState(roomId);

  if (room.host_player_id !== requesterPlayerId) throw new Error("Only the host can play again");

  const { error } = await supabase
    .from("rooms")
    .update({
      status: "lobby",
      game_state_json: room.game_state_json,
      updated_at: new Date().toISOString()
    })
    .eq("id", roomId);

  if (error) throw error;
};

export const updateOnlineGameState = async (roomId: string, gameState: GameState, status?: OnlineStatus) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("rooms")
    .update({
      status: status ?? statusForGameState(gameState),
      game_state_json: gameState,
      updated_at: new Date().toISOString()
    })
    .eq("id", roomId);

  if (error) throw error;
};

export const continueOnlineCheck = async (roomId: string, playerId: string): Promise<GameState> => {
  const supabase = getSupabaseClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const room = await getAppState(roomId);
    const latestGameState = room.game_state_json;
    if (!latestGameState) throw new Error("No active game");

    const nextGameState = continueCheck(latestGameState, playerId);
    const { data, error } = await supabase
      .from("rooms")
      .update({
        status: statusForGameState(nextGameState),
        game_state_json: nextGameState,
        updated_at: new Date().toISOString()
      })
      .eq("id", roomId)
      .eq("updated_at", room.updated_at)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (data) return (data as OnlineRoom).game_state_json ?? nextGameState;
  }

  const room = await getAppState(roomId);
  if (!room.game_state_json) throw new Error("No active game");
  return room.game_state_json;
};

export const subscribePlayers = (roomId: string, onChange: () => void): RealtimeChannel => {
  const supabase = getSupabaseClient();
  return supabase
    .channel(makeChannelName(roomId, "players"))
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
};

export const subscribeAppState = (roomId: string, onChange: (state: OnlineRoom) => void): RealtimeChannel => {
  const supabase = getSupabaseClient();
  return supabase
    .channel(makeChannelName(roomId, "state"))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => onChange(payload.new as OnlineRoom)
    )
    .subscribe();
};

export const unsubscribe = async (channel: RealtimeChannel) => {
  const supabase = getSupabaseClient();
  await supabase.removeChannel(channel);
};
