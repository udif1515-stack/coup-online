const PLAYER_ID_KEY = "bluff_table_player_id";

export const getStoredPlayerId = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(PLAYER_ID_KEY) ?? undefined;
};

export const storePlayerId = (playerId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_ID_KEY, playerId);
};

export const clearStoredPlayerId = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLAYER_ID_KEY);
};
