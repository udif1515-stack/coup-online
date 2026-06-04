export type PlayerId = string;

export type CardType = "A" | "K" | "Q" | "J" | "3";
export type CardColor = "red" | "green" | "blue";

export type TurnAction = "A" | "K" | "J" | "3" | "3?" | "Drop" | "Check";

export type GamePhase =
  | "setup"
  | "playing"
  | "selectingTarget"
  | "pendingCheck"
  | "pendingBlockOrResponse"
  | "pendingInfluenceLoss"
  | "ambassadorExchange"
  | "gameOver";

export type PendingActionType = "A" | "K" | "J" | "3" | "3?" | "Drop";

export type CheckContinuation =
  | "ambassador-exchange"
  | "captain-response"
  | "captain-blocked"
  | "captain-steal"
  | "assassin-response"
  | "assassin-blocked"
  | "assassin-hit"
  | "duke-income"
  | "foreign-aid-blocked"
  | "foreign-aid-income"
  | "cancel-turn";

export type ResponseType =
  | "claim-k"
  | "claim-a"
  | "give-coins"
  | "claim-q"
  | "accept-attack"
  | "claim-duke"
  | "do-not-block"
  | "check"
  | "allow";

export type Card = {
  id: string;
  type: CardType;
  color?: CardColor;
  revealed: boolean;
};

export type Player = {
  id: PlayerId;
  name: string;
  coins: number;
  cards: Card[];
  eliminated: boolean;
};

export type GameLogEntry = {
  id: string;
  message: string;
  createdAt: number;
};

export type ActionBubble = {
  id: string;
  playerId: PlayerId;
  label: string;
  expiresAt: number;
};

export type CoupFlash = {
  id: string;
  checkerId: PlayerId;
  claimantId: PlayerId;
  result: "success" | "failed";
  resultAt: number;
  expiresAt: number;
};

export type PendingResponse = {
  id: string;
  action: PendingActionType;
  actorId: PlayerId;
  targetId?: PlayerId;
  responderId?: PlayerId;
  claimedCard?: CardType;
  passedPlayerIds: PlayerId[];
  prompt: string;
  options: ResponseType[];
  timeRemaining: number;
};

export type PendingCheck = {
  id: string;
  claimantId: PlayerId;
  claimedCard: CardType;
  sourceAction: PendingActionType;
  targetId?: PlayerId;
  eligibleCheckerIds: PlayerId[];
  passedPlayerIds: PlayerId[];
  prompt: string;
  timeRemaining: number;
  onAllowed: CheckContinuation;
  onFalseClaim: CheckContinuation;
};

export type InfluenceLossReason =
  | "failed_coup"
  | "successful_coup"
  | "assassin"
  | "drop"
  | "other";

export type InfluenceLossContinuation =
  | {
      type: "continue-after-coup";
      pendingCheck: PendingCheck;
      continuation: CheckContinuation;
    }
  | {
      type: "next-turn";
    };

export type PendingInfluenceLoss = {
  id: string;
  playerId: PlayerId;
  reason: InfluenceLossReason;
  prompt: string;
  afterResolve: InfluenceLossContinuation;
};

export type TargetSelection = {
  action: Extract<PendingActionType, "K" | "J" | "Drop">;
  actorId: PlayerId;
};

export type AmbassadorExchange = {
  playerId: PlayerId;
  offeredCards: Card[];
};

export type GameState = {
  id: string;
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  discard: Card[];
  currentPlayerIndex: number;
  turnNumber: number;
  timer: number;
  winCounts: Record<PlayerId, number>;
  actionBubble?: ActionBubble;
  coupFlash?: CoupFlash;
  isPaused?: boolean;
  pausedByPlayerId?: PlayerId;
  pausedAt?: number;
  remainingTimerMsWhenPaused?: number;
  timerStartedAt?: number;
  timerEndsAt?: number;
  targetSelection?: TargetSelection;
  pendingResponse?: PendingResponse;
  pendingCheck?: PendingCheck;
  pendingInfluenceLoss?: PendingInfluenceLoss;
  ambassadorExchange?: AmbassadorExchange;
  log: GameLogEntry[];
  winnerId?: PlayerId;
};

export type LegalActions = Record<TurnAction, { enabled: boolean; reason?: string }>;
