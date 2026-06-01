import type { Card, CardType, GameState, Player, PlayerId } from "./types";

export const visibleInfluenceCount = (player: Player) => player.cards.filter((card) => !card.revealed).length;

export const isAlive = (player: Player) => !player.eliminated && visibleInfluenceCount(player) > 0;

export const cardSummary = (cardType: CardType) => {
  if (cardType === "A") return "A";
  if (cardType === "K") return "K";
  if (cardType === "Q") return "Q";
  if (cardType === "J") return "J";
  return "3";
};

export const playerName = (gameState: GameState, playerId?: PlayerId) =>
  gameState.players.find((player) => player.id === playerId)?.name ?? "Unknown player";

export const unrevealedCards = (player: Player): Card[] => player.cards.filter((card) => !card.revealed);
