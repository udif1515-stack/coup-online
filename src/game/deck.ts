import type { Card, CardType } from "./types";

export const DECK_CARD_TYPES: CardType[] = ["A", "K", "Q", "J", "3"];
export const COPIES_PER_CARD_TYPE = 3;
export const TOTAL_DECK_CARDS = DECK_CARD_TYPES.length * COPIES_PER_CARD_TYPE;

export const createDeck = (): Card[] =>
  DECK_CARD_TYPES.flatMap((type) =>
    Array.from({ length: COPIES_PER_CARD_TYPE }, (_, index) => ({
      id: `${type}-${index + 1}-${cryptoRandomId()}`,
      type,
      revealed: false
    }))
  );

export const shuffleDeck = (cards: Card[]): Card[] => {
  const next = [...cards];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
};

export const drawCards = (deck: Card[], count: number): { drawn: Card[]; deck: Card[] } => ({
  drawn: deck.slice(0, count).map((card) => ({ ...card, revealed: false })),
  deck: deck.slice(count)
});

export const returnCardsToDeck = (deck: Card[], cards: Card[]): Card[] =>
  [...deck, ...cards.map((card) => ({ ...card, revealed: false }))];

const cryptoRandomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
};
