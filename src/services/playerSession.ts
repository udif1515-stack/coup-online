const PLAYER_ID_KEY = "bluff_table_player_id";
const ROOM_ID_KEY = "bluff_table_room_id";
const ROOM_CODE_KEY = "bluff_table_room_code";

export const getStoredPlayerId = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(PLAYER_ID_KEY) ?? undefined;
};

export const storePlayerId = (playerId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_ID_KEY, playerId);
};

export const getStoredRoomId = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(ROOM_ID_KEY) ?? undefined;
};

export const getStoredRoomCode = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(ROOM_CODE_KEY) ?? undefined;
};

export const storeRoomSession = (roomId: string, roomCode: string, playerId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOM_ID_KEY, roomId);
  window.localStorage.setItem(ROOM_CODE_KEY, roomCode);
  window.localStorage.setItem(PLAYER_ID_KEY, playerId);
};

export const clearStoredPlayerId = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLAYER_ID_KEY);
  window.localStorage.removeItem(ROOM_ID_KEY);
  window.localStorage.removeItem(ROOM_CODE_KEY);
};
