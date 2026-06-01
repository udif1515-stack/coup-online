import type { CardType, PendingActionType, ResponseType, TurnAction } from "./types";

export const CARD_LABELS: Record<CardType, string> = {
  A: "Ambassador",
  K: "Captain",
  Q: "Contessa",
  J: "Assassin",
  "3": "Duke"
};

export const ACTION_LABELS: Record<TurnAction, string> = {
  A: "A",
  K: "K",
  J: "J",
  "3": "3",
  "3?": "3?",
  Drop: "DROP",
  Check: "CHECK"
};

export const ACTION_COSTS: Partial<Record<TurnAction, number>> = {
  J: 3,
  Drop: 7
};

export const STARTING_COINS = 2;
export const CARDS_PER_PLAYER = 2;
export const TURN_DURATION_SECONDS = 30;
export const RESPONSE_DURATION_SECONDS = 10;

export const RESPONSE_LABELS: Record<ResponseType, string> = {
  "claim-k": "K",
  "claim-a": "A",
  "give-coins": "Give 2 coins",
  "claim-q": "Q",
  "accept-attack": "Accept attack",
  "claim-duke": "3",
  "do-not-block": "Allow",
  check: "COUP",
  allow: "Allow"
};

export const responsePromptForAction = (
  action: PendingActionType,
  actorName: string,
  targetName?: string
) => {
  if (action === "K") {
    return `${actorName} claims K against ${targetName}. Choose response:`;
  }

  if (action === "J") {
    return `${actorName} attacks ${targetName} with J. Choose response:`;
  }

  if (action === "3?") {
    return `${actorName} wants 2 coins. Does anyone block with 3?`;
  }

  if (action === "3") {
    return `${actorName} claims 3. COUP?`;
  }

  return `${actorName} claimed ${action}. Choose response:`;
};

export const responseOptionsForAction = (action: PendingActionType): ResponseType[] => {
  if (action === "K") return ["claim-k", "claim-a", "give-coins"];
  if (action === "J") return ["claim-q", "accept-attack"];
  if (action === "3?") return ["claim-duke", "do-not-block"];
  if (action === "3") return ["check", "allow"];
  return ["check", "allow"];
};
