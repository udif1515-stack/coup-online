import { ACTION_COSTS } from "./rules";
import type { GameState, LegalActions, PlayerId, TurnAction } from "./types";

const TURN_ACTIONS: TurnAction[] = ["A", "K", "J", "3", "3?", "Drop", "Check"];

export const getActivePlayer = (gameState: GameState) => gameState.players[gameState.currentPlayerIndex];

export const getPlayer = (gameState: GameState, playerId: PlayerId) =>
  gameState.players.find((player) => player.id === playerId);

export const getLegalActions = (gameState: GameState, playerId: PlayerId): LegalActions => {
  const player = getPlayer(gameState, playerId);
  const activePlayer = getActivePlayer(gameState);
  const base = Object.fromEntries(
    TURN_ACTIONS.map((action) => [action, { enabled: false, reason: "Not available" }])
  ) as LegalActions;

  if (!player || player.eliminated) {
    return withReason(base, "Player is eliminated");
  }

  if (gameState.phase === "pendingCheck" && gameState.pendingCheck) {
    return withReason(base, "COUP open");
  }

  if (gameState.phase !== "playing") {
    return withReason(base, "Waiting");
  }

  if (activePlayer.id !== playerId) {
    return withReason(base, "Not your turn");
  }

  if (player.coins >= 10) {
    for (const action of TURN_ACTIONS) {
      base[action] = action === "Drop" ? { enabled: true } : { enabled: false, reason: "DROP required" };
    }

    return base;
  }

  for (const action of TURN_ACTIONS) {
    base[action] = { enabled: true };
  }

  for (const [action, cost] of Object.entries(ACTION_COSTS) as [TurnAction, number][]) {
    if (player.coins < cost) {
      base[action] = { enabled: false, reason: `Need ${cost} coins` };
    }
  }

  return base;
};

const withReason = (actions: LegalActions, reason: string): LegalActions => {
  for (const action of TURN_ACTIONS) {
    actions[action] = { enabled: false, reason };
  }

  return actions;
};
