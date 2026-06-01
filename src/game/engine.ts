import { createDeck, drawCards, returnCardsToDeck, shuffleDeck } from "./deck";
import {
  CARDS_PER_PLAYER,
  RESPONSE_DURATION_SECONDS,
  STARTING_COINS,
  TURN_DURATION_SECONDS,
  responseOptionsForAction,
  responsePromptForAction
} from "./rules";
import { getActivePlayer, getPlayer } from "./validation";
import type {
  AmbassadorExchange,
  Card,
  CardType,
  CheckContinuation,
  GameLogEntry,
  GameState,
  InfluenceLossContinuation,
  InfluenceLossReason,
  PendingActionType,
  PendingCheck,
  PendingInfluenceLoss,
  PendingResponse,
  Player,
  PlayerId,
  ResponseType,
  TurnAction
} from "./types";

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const createGame = (playerNames: string[]): GameState => {
  const playerCount = Math.min(5, Math.max(3, playerNames.length));
  let deck = shuffleDeck(createDeck());

  const players: Player[] = playerNames.slice(0, playerCount).map((name, index) => {
    const dealt = drawCards(deck, CARDS_PER_PLAYER);
    deck = dealt.deck;

    return {
      id: `player-${index + 1}`,
      name: name.trim() || `Player ${index + 1}`,
      coins: STARTING_COINS,
      cards: dealt.drawn,
      eliminated: false
    };
  });

  return startGame({
    id: makeId("game"),
    phase: "setup",
    players,
    deck,
    discard: [],
    currentPlayerIndex: 0,
    turnNumber: 1,
    timer: TURN_DURATION_SECONDS,
    winCounts: {},
    log: []
  });
};

export const startGame = (gameState: GameState): GameState => ({
  ...startNewSharedTimer({
    ...gameState,
    phase: "playing",
    log: addLog(gameState, "Game started.").log
  })
});

export { getLegalActions } from "./validation";

const timerDurationForPhase = (gameState: GameState) => {
  if (gameState.phase === "playing") return TURN_DURATION_SECONDS;
  if (gameState.phase === "selectingTarget") return TURN_DURATION_SECONDS;
  if (gameState.phase === "pendingCheck") return RESPONSE_DURATION_SECONDS;
  if (gameState.phase === "pendingBlockOrResponse") return RESPONSE_DURATION_SECONDS;
  return 0;
};

export const applySharedTimer = (gameState: GameState, now = Date.now()): GameState => {
  if (gameState.isPaused) {
    const timer = Math.max(0, Math.ceil((gameState.remainingTimerMsWhenPaused ?? gameState.timer * 1000) / 1000));
    return withPendingTimerDisplay(
      {
        ...gameState,
        timer
      },
      timer
    );
  }

  const duration = timerDurationForPhase(gameState);

  if (!duration) {
    return {
      ...gameState,
      timer: 0,
      timerStartedAt: undefined,
      timerEndsAt: undefined
    };
  }

  if (gameState.timerStartedAt && gameState.timerEndsAt) {
    const timer = getSharedTimerSeconds(gameState, now);

    return withPendingTimerDisplay({
      ...gameState,
      timer
    }, timer);
  }

  const timerEndsAt = now + duration * 1000;
  return {
    ...withPendingTimerDisplay(gameState, duration),
    timer: duration,
    timerStartedAt: now,
    timerEndsAt
  };
};

export const getSharedTimerSeconds = (gameState: GameState, now = Date.now()) => {
  if (!gameState.timerEndsAt) return gameState.timer;
  return Math.max(0, Math.ceil((gameState.timerEndsAt - now) / 1000));
};

export const withSharedTimerDisplay = (gameState: GameState, now = Date.now()): GameState => {
  if (gameState.isPaused) {
    return applySharedTimer(gameState, now);
  }

  const timer = getSharedTimerSeconds(gameState, now);

  return withPendingTimerDisplay({
    ...gameState,
    timer
  }, timer);
};

const withPendingTimerDisplay = (gameState: GameState, timer: number): GameState => ({
  ...gameState,
  pendingCheck: gameState.pendingCheck
    ? {
        ...gameState.pendingCheck,
        timeRemaining: timer
      }
    : undefined,
  pendingResponse: gameState.pendingResponse
    ? {
        ...gameState.pendingResponse,
        timeRemaining: timer
      }
    : undefined
});

export const expireGameTimer = (gameState: GameState): GameState => {
  if (gameState.isPaused) return gameState;
  if (gameState.phase === "playing") return resolveTurnTimeout(gameState);
  if (gameState.phase === "selectingTarget") return resolveTargetSelectionTimeout(gameState);
  if (gameState.phase === "pendingCheck") return resolveCheck(gameState, undefined);
  if (gameState.phase === "pendingBlockOrResponse") return resolveResponseTimeout(gameState);
  return gameState;
};

export const tickGameTimer = (gameState: GameState): GameState => {
  if (gameState.isPaused) return gameState;

  if (gameState.phase === "playing") {
    if (gameState.timer > 1) {
      return { ...gameState, timer: gameState.timer - 1 };
    }

    return resolveTurnTimeout(gameState);
  }

  if (gameState.phase === "selectingTarget") {
    if (gameState.timer > 1) {
      return { ...gameState, timer: gameState.timer - 1 };
    }

    return resolveTargetSelectionTimeout(gameState);
  }

  if (gameState.phase === "pendingCheck" && gameState.pendingCheck) {
    if (gameState.timer > 1) {
      const nextTimer = gameState.timer - 1;
      return {
        ...gameState,
        timer: nextTimer,
        pendingCheck: {
          ...gameState.pendingCheck,
          timeRemaining: nextTimer
        }
      };
    }

    return resolveCheck(gameState, undefined);
  }

  if (gameState.phase === "pendingBlockOrResponse" && gameState.pendingResponse) {
    if (gameState.timer > 1) {
      const nextTimer = gameState.timer - 1;
      return {
        ...gameState,
        timer: nextTimer,
        pendingResponse: {
          ...gameState.pendingResponse,
          timeRemaining: nextTimer
        }
      };
    }

    return resolveResponseTimeout(gameState);
  }

  return gameState;
};

export const pauseGame = (gameState: GameState, pausedByPlayerId: PlayerId, now = Date.now()): GameState => {
  if (gameState.isPaused || gameState.phase === "setup" || gameState.phase === "gameOver") return gameState;

  const remainingTimerMs = gameState.timerEndsAt
    ? Math.max(0, gameState.timerEndsAt - now)
    : Math.max(0, gameState.timer * 1000);
  const timer = Math.ceil(remainingTimerMs / 1000);

  return withPendingTimerDisplay(
    {
      ...gameState,
      isPaused: true,
      pausedByPlayerId,
      pausedAt: now,
      remainingTimerMsWhenPaused: remainingTimerMs,
      timer,
      timerStartedAt: undefined,
      timerEndsAt: undefined
    },
    timer
  );
};

export const resumeGame = (gameState: GameState, now = Date.now()): GameState => {
  if (!gameState.isPaused) return gameState;

  const duration = timerDurationForPhase(gameState);
  const remainingTimerMs = Math.max(0, gameState.remainingTimerMsWhenPaused ?? gameState.timer * 1000);
  const timer = Math.ceil(remainingTimerMs / 1000);
  const resumed: GameState = {
    ...gameState,
    isPaused: false,
    pausedByPlayerId: undefined,
    pausedAt: undefined,
    remainingTimerMsWhenPaused: undefined,
    timer
  };

  if (!duration) {
    return {
      ...withPendingTimerDisplay(resumed, 0),
      timer: 0,
      timerStartedAt: undefined,
      timerEndsAt: undefined
    };
  }

  return withPendingTimerDisplay(
    {
      ...resumed,
      timerStartedAt: now,
      timerEndsAt: now + remainingTimerMs
    },
    timer
  );
};

export const selectAction = (gameState: GameState, playerId: PlayerId, action: TurnAction): GameState => {
  if (gameState.isPaused) return gameState;

  const player = getPlayer(gameState, playerId);
  const activePlayer = getActivePlayer(gameState);

  if (!player || player.eliminated || activePlayer.id !== playerId || gameState.phase !== "playing") {
    return gameState;
  }

  if (player.coins >= 10 && action !== "Drop") {
    return addLog(gameState, `${player.name} has 10+ coins and must use DROP.`);
  }

  const gameStateWithBubble = addActionBubble(gameState, playerId, action === "Check" ? "CHECK" : action.toUpperCase());

  if (action === "Check") {
    const next = updatePlayer(gameStateWithBubble, playerId, (current) => ({ ...current, coins: current.coins + 1 }));
    return nextTurn(addLog(next, `${player.name} used CHECK and gained 1 coin.`));
  }

  if (action === "A") {
    return beginCheck(gameStateWithBubble, {
      claimantId: playerId,
      claimedCard: "A",
      sourceAction: "A",
      onAllowed: "ambassador-exchange",
      onFalseClaim: "cancel-turn",
      logMessage: `${player.name} claims A.`
    });
  }

  if (action === "K" || action === "J" || action === "Drop") {
    if (action === "J" && player.coins < 3) return gameState;
    if (action === "Drop" && player.coins < 7) return gameState;

    return {
      ...startNewSharedTimer({
        ...addLog(gameStateWithBubble, `${player.name} is selecting a target for ${action === "Drop" ? "DROP" : action}.`),
        phase: "selectingTarget",
        targetSelection: { action, actorId: playerId }
      })
    };
  }

  if (action === "3") {
    return beginCheck(gameStateWithBubble, {
      claimantId: playerId,
      claimedCard: "3",
      sourceAction: "3",
      onAllowed: "duke-income",
      onFalseClaim: "cancel-turn",
      logMessage: `${player.name} claims 3.`
    });
  }

  if (action === "3?") {
    return {
      ...startNewSharedTimer({
        ...addLog(gameStateWithBubble, `${player.name} asks for 2 coins with 3?.`),
        phase: "pendingBlockOrResponse",
        pendingResponse: createPendingResponse(gameState, "3?", playerId)
      })
    };
  }

  return gameState;
};

export const selectTarget = (gameState: GameState, playerId: PlayerId, targetId: PlayerId): GameState => {
  if (gameState.isPaused) return gameState;

  const selection = gameState.targetSelection;
  const actor = getPlayer(gameState, playerId);
  const target = getPlayer(gameState, targetId);

  if (!selection || selection.actorId !== playerId || !actor || !target || target.eliminated || actor.id === target.id) {
    return gameState;
  }

  if (selection.action === "Drop") {
    if (actor.coins < 7) return gameState;

    let next = updatePlayer(addActionBubble(gameState, actor.id, "DROP"), actor.id, (player) => ({ ...player, coins: player.coins - 7 }));
    next = addLog(next, `${actor.name} used DROP on ${target.name}.`);
    next = clearPending(next);
    return requestInfluenceLoss(next, target.id, "drop", { type: "next-turn" });
  }

  if (selection.action === "J") {
    if (actor.coins < 3) return gameState;

    const charged = updatePlayer(addActionBubble(gameState, actor.id, "J"), actor.id, (player) => ({ ...player, coins: player.coins - 3 }));
    return beginCheck(charged, {
      claimantId: actor.id,
      claimedCard: "J",
      sourceAction: "J",
      targetId: target.id,
      onAllowed: "assassin-response",
      onFalseClaim: "cancel-turn",
      logMessage: `${actor.name} pays 3 coins and claims J against ${target.name}.`
    });
  }

  return beginCheck(addActionBubble(gameState, actor.id, "K"), {
    claimantId: actor.id,
    claimedCard: "K",
    sourceAction: "K",
    targetId: target.id,
    onAllowed: "captain-response",
    onFalseClaim: "cancel-turn",
    logMessage: `${actor.name} claims K against ${target.name}.`
  });
};

export const resolveCheck = (gameState: GameState, checkerId?: PlayerId): GameState => {
  if (gameState.isPaused) return gameState;

  const pending = gameState.pendingCheck;
  if (!pending || gameState.phase !== "pendingCheck") return gameState;

  const claimant = getPlayer(gameState, pending.claimantId);
  if (!claimant) return gameState;

  if (!checkerId) {
    return continueAfterCheck(clearPendingCheck(addLog(gameState, `No COUP. ${claimant.name}'s ${pending.claimedCard} continues.`)), pending.onAllowed, pending);
  }

  if (!pending.eligibleCheckerIds.includes(checkerId)) return gameState;

  const checker = getPlayer(gameState, checkerId);
  if (!checker) return gameState;

  let next = addLog(gameState, `${checker.name} used COUP on ${claimant.name}'s ${pending.claimedCard} claim.`);
  const realCard = claimant.cards.find((card) => !card.revealed && card.type === pending.claimedCard);

  if (realCard) {
    next = revealAndReplaceClaimedCard(next, claimant.id, realCard);
    next = addLog(next, `${claimant.name} had ${pending.claimedCard}. ${checker.name} loses one influence.`);
    return requestInfluenceLoss(clearPendingCheck(next), checker.id, "failed_coup", {
      type: "continue-after-coup",
      pendingCheck: pending,
      continuation: pending.onAllowed
    });
  }

  next = addLog(next, `${claimant.name} did not have ${pending.claimedCard}. ${claimant.name} loses one influence.`);
  next = addLog(next, "The action was cancelled because the claim was false.");
  return requestInfluenceLoss(clearPendingCheck(next), claimant.id, "successful_coup", {
    type: "continue-after-coup",
    pendingCheck: pending,
    continuation: pending.onFalseClaim
  });
};

export const continueCheck = (gameState: GameState, playerId: PlayerId): GameState => {
  if (gameState.isPaused) return gameState;

  const pending = gameState.pendingCheck;
  const claimant = pending ? getPlayer(gameState, pending.claimantId) : undefined;

  if (!pending || !claimant || gameState.phase !== "pendingCheck") return gameState;

  const eligibleCheckerIds = getEligibleCheckers(gameState, pending);
  const currentPassedPlayerIds = pending.passedPlayerIds ?? [];
  if (!eligibleCheckerIds.includes(playerId) || currentPassedPlayerIds.includes(playerId)) {
    return gameState;
  }

  const passedPlayerIds = [...new Set([...currentPassedPlayerIds, playerId])].filter((id) =>
    eligibleCheckerIds.includes(id)
  );

  if (eligibleCheckerIds.every((id) => passedPlayerIds.includes(id))) {
    const next = clearPendingCheck(
      addLog(gameState, `Everyone continued. ${claimant.name}'s ${pending.claimedCard} continues.`)
    );
    return continueAfterCheck(next, pending.onAllowed, pending);
  }

  return {
    ...gameState,
    pendingCheck: {
      ...pending,
      eligibleCheckerIds,
      passedPlayerIds
    }
  };
};

export const resolveResponse = (gameState: GameState, playerId: PlayerId, response: ResponseType): GameState => {
  if (gameState.isPaused) return gameState;

  const pending = gameState.pendingResponse;

  if (!pending || gameState.phase !== "pendingBlockOrResponse") return gameState;

  const actor = getPlayer(gameState, pending.actorId);
  const target = pending.targetId ? getPlayer(gameState, pending.targetId) : undefined;
  const responder = getPlayer(gameState, playerId);

  if (!actor || !responder) return gameState;
  if (pending.responderId && pending.responderId !== playerId) return gameState;
  if (responder.eliminated) return gameState;

  if (pending.action === "K") {
    if (response === "give-coins" && target) {
      return resolveCaptainSteal(gameState, actor.id, target.id);
    }

    if ((response === "claim-k" || response === "claim-a") && target) {
      const claimedCard: CardType = response === "claim-k" ? "K" : "A";
      return beginCheck(clearPendingResponse(addActionBubble(gameState, responder.id, claimedCard)), {
        claimantId: responder.id,
        claimedCard,
        sourceAction: "K",
        targetId: target.id,
        onAllowed: "captain-blocked",
        onFalseClaim: "captain-steal",
        logMessage: `${responder.name} blocks with ${claimedCard}.`
      });
    }
  }

  if (pending.action === "J") {
    if (response === "accept-attack" && target) {
      return resolveAssassinHit(gameState, actor.id, target.id);
    }

    if (response === "claim-q" && target) {
      return beginCheck(clearPendingResponse(addActionBubble(gameState, responder.id, "Q")), {
        claimantId: responder.id,
        claimedCard: "Q",
        sourceAction: "J",
        targetId: target.id,
        onAllowed: "assassin-blocked",
        onFalseClaim: "assassin-hit",
        logMessage: `${responder.name} blocks with Q.`
      });
    }
  }

  if (pending.action === "3?") {
    if (response === "claim-duke") {
      if (responder.id === actor.id) return gameState;
      if ((pending.passedPlayerIds ?? []).includes(responder.id)) return gameState;

      return beginCheck(clearPendingResponse(addActionBubble(gameState, responder.id, "3")), {
        claimantId: responder.id,
        claimedCard: "3",
        sourceAction: "3?",
        onAllowed: "foreign-aid-blocked",
        onFalseClaim: "foreign-aid-income",
        logMessage: `${responder.name} blocks 3? with 3.`
      });
    }

    if (response === "do-not-block" || response === "allow") {
      const eligibleResponderIds = getEligibleForeignAidResponders(gameState, pending);
      const currentPassedPlayerIds = pending.passedPlayerIds ?? [];

      if (!eligibleResponderIds.includes(responder.id) || currentPassedPlayerIds.includes(responder.id)) {
        return gameState;
      }

      const passedPlayerIds = [...new Set([...currentPassedPlayerIds, responder.id])].filter((id) =>
        eligibleResponderIds.includes(id)
      );

      if (eligibleResponderIds.every((id) => passedPlayerIds.includes(id))) {
        return resolveForeignAidIncome(
          {
            ...gameState,
            pendingResponse: {
              ...pending,
              passedPlayerIds
            }
          },
          actor.id
        );
      }

      return {
        ...gameState,
        pendingResponse: {
          ...pending,
          passedPlayerIds
        }
      };
    }
  }

  return gameState;
};

export const completeAmbassadorExchange = (
  gameState: GameState,
  playerId: PlayerId,
  oldCardId: string,
  offeredCardId: string
): GameState => {
  if (gameState.isPaused) return gameState;

  const exchange = gameState.ambassadorExchange;
  const player = getPlayer(gameState, playerId);

  if (!exchange || exchange.playerId !== playerId || !player) return gameState;

  const oldCard = player.cards.find((card) => card.id === oldCardId && !card.revealed);
  const offeredCard = exchange.offeredCards.find((card) => card.id === offeredCardId);

  if (!oldCard || !offeredCard) return gameState;

  const returnedCards = [
    { ...oldCard, revealed: false },
    ...exchange.offeredCards.filter((card) => card.id !== offeredCardId)
  ];

  let next = updatePlayer(gameState, playerId, (current) => ({
    ...current,
    cards: current.cards.map((card) => (card.id === oldCardId ? { ...offeredCard, revealed: false } : card))
  }));

  next = {
    ...next,
    phase: "playing",
    ambassadorExchange: undefined,
    deck: returnCardsToDeck(next.deck, returnedCards)
  };

  return nextTurn(addLog(next, `${player.name} exchanged one card with A.`));
};

export const selectAmbassadorExchangeOldCard = (
  gameState: GameState,
  playerId: PlayerId,
  oldCardId: string
): GameState => {
  if (gameState.isPaused) return gameState;

  const exchange = gameState.ambassadorExchange;
  const player = getPlayer(gameState, playerId);

  if (!exchange || exchange.playerId !== playerId || !player || gameState.phase !== "ambassadorExchange") {
    return gameState;
  }

  const oldCard = player.cards.find((card) => card.id === oldCardId && !card.revealed);
  if (!oldCard) return gameState;

  return {
    ...gameState,
    ambassadorExchange: {
      ...exchange,
      selectedOldCardId: oldCardId,
      selectedOfferedCardId: undefined
    }
  };
};

export const selectAmbassadorExchangeOfferedCard = (
  gameState: GameState,
  playerId: PlayerId,
  offeredCardId: string
): GameState => {
  if (gameState.isPaused) return gameState;

  const exchange = gameState.ambassadorExchange;

  if (!exchange || exchange.playerId !== playerId || !exchange.selectedOldCardId || gameState.phase !== "ambassadorExchange") {
    return gameState;
  }

  const offeredCard = exchange.offeredCards.find((card) => card.id === offeredCardId);
  if (!offeredCard) return gameState;

  return {
    ...gameState,
    ambassadorExchange: {
      ...exchange,
      selectedOfferedCardId: offeredCardId
    }
  };
};

export const cancelTargetSelection = (gameState: GameState): GameState =>
  gameState.isPaused
    ? gameState
    : startNewSharedTimer({
    ...gameState,
    phase: "playing",
    targetSelection: undefined
  });

export const nextTurn = (gameState: GameState): GameState => {
  const alivePlayers = gameState.players.filter((player) => !player.eliminated);
  if (alivePlayers.length <= 1) return checkWinner(gameState);

  let nextIndex = gameState.currentPlayerIndex;

  for (let i = 0; i < gameState.players.length; i += 1) {
    nextIndex = (nextIndex + 1) % gameState.players.length;
    if (!gameState.players[nextIndex].eliminated) break;
  }

  const nextPlayer = gameState.players[nextIndex];

  return addLog(
    startNewSharedTimer({
      ...gameState,
      phase: "playing",
      currentPlayerIndex: nextIndex,
      turnNumber: gameState.turnNumber + 1,
      pendingResponse: undefined,
      pendingCheck: undefined,
      pendingInfluenceLoss: undefined,
      targetSelection: undefined,
      ambassadorExchange: undefined
    }),
    `${nextPlayer.name}'s turn.`
  );
};

export const requestInfluenceLoss = (
  gameState: GameState,
  playerId: PlayerId,
  reason: InfluenceLossReason,
  afterResolve: InfluenceLossContinuation
): GameState => {
  const player = getPlayer(gameState, playerId);
  if (!player) return gameState;

  const liveCards = player.cards.filter((card) => !card.revealed);
  if (liveCards.length === 0) {
    return continueAfterInfluenceLoss(eliminatePlayerIfNeeded(gameState, playerId), {
      id: makeId("influence"),
      playerId,
      reason,
      prompt: `${player.name} must reveal one card.`,
      afterResolve
    });
  }

  const pendingInfluenceLoss: PendingInfluenceLoss = {
    id: makeId("influence"),
    playerId,
    reason,
    prompt: `${player.name} must reveal one card.`,
    afterResolve
  };

  return {
    ...gameState,
    phase: "pendingInfluenceLoss",
    timer: 0,
    pendingInfluenceLoss,
    pendingCheck: undefined,
    pendingResponse: undefined,
    targetSelection: undefined
  };
};

export const revealInfluence = (gameState: GameState, playerId: PlayerId, cardId: string): GameState => {
  if (gameState.isPaused) return gameState;

  const pending = gameState.pendingInfluenceLoss;
  const player = getPlayer(gameState, playerId);
  if (!pending || pending.playerId !== playerId || !player || gameState.phase !== "pendingInfluenceLoss") {
    return gameState;
  }

  const cardToReveal = player.cards.find((card) => card.id === cardId && !card.revealed);
  if (!cardToReveal) return gameState;

  let next = updatePlayer(gameState, playerId, (current) => ({
    ...current,
    cards: current.cards.map((card) => (card.id === cardToReveal.id ? { ...card, revealed: true } : card))
  }));

  next = addLog(next, `${player.name} revealed ${cardToReveal.type} and lost one influence.`);
  next = eliminatePlayerIfNeeded(next, playerId);
  next = checkWinner(next);

  if (next.phase === "gameOver") return next;

  return continueAfterInfluenceLoss(next, pending);
};

export const eliminatePlayerIfNeeded = (gameState: GameState, playerId: PlayerId): GameState => {
  const player = getPlayer(gameState, playerId);

  if (!player || player.cards.some((card) => !card.revealed)) return gameState;

  return addLog(
    updatePlayer(gameState, playerId, (current) => ({ ...current, eliminated: true })),
    `${player.name} has been eliminated.`
  );
};

export const checkWinner = (gameState: GameState): GameState => {
  if (gameState.phase === "gameOver" && gameState.winnerId) return gameState;

  const alive = gameState.players.filter((player) => !player.eliminated);

  if (alive.length === 1) {
    const winner = alive[0];
    const winCounts = gameState.winCounts ?? {};

    return addLog(
      {
        ...clearPending(gameState),
        phase: "gameOver",
        timer: 0,
        winnerId: winner.id,
        winCounts: {
          ...winCounts,
          [winner.id]: (winCounts[winner.id] ?? 0) + 1
        }
      },
      `${winner.name} wins the game.`
    );
  }

  return gameState;
};

const beginCheck = (
  gameState: GameState,
  options: {
    claimantId: PlayerId;
    claimedCard: CardType;
    sourceAction: PendingActionType;
    targetId?: PlayerId;
    onAllowed: CheckContinuation;
    onFalseClaim: CheckContinuation;
    logMessage: string;
  }
): GameState => {
  const claimant = getPlayer(gameState, options.claimantId);
  if (!claimant) return gameState;

  const pendingCheck: PendingCheck = {
    id: makeId("check"),
    claimantId: options.claimantId,
    claimedCard: options.claimedCard,
    sourceAction: options.sourceAction,
    targetId: options.targetId,
    eligibleCheckerIds: gameState.players
      .filter((player) => player.id !== options.claimantId && !player.eliminated)
      .map((player) => player.id),
    passedPlayerIds: [],
    prompt: `${claimant.name} claims ${options.claimedCard}.`,
    timeRemaining: RESPONSE_DURATION_SECONDS,
    onAllowed: options.onAllowed,
    onFalseClaim: options.onFalseClaim
  };

  return startNewSharedTimer({
    ...addLog(gameState, options.logMessage),
    phase: "pendingCheck",
    pendingCheck,
    pendingResponse: undefined,
    targetSelection: undefined
  });
};

const continueAfterCheck = (
  gameState: GameState,
  continuation: CheckContinuation,
  pending: PendingCheck
): GameState => {
  if (continuation === "ambassador-exchange") return startAmbassadorExchange(gameState, pending.claimantId);
  if (continuation === "captain-response" && pending.targetId) return startCaptainResponse(gameState, pending.claimantId, pending.targetId);
  if (continuation === "captain-blocked") return nextTurn(addLog(gameState, "K was blocked."));
  if (continuation === "captain-steal" && pending.targetId) return resolveCaptainSteal(gameState, getActivePlayer(gameState).id, pending.targetId);
  if (continuation === "assassin-response" && pending.targetId) return startAssassinResponse(gameState, pending.claimantId, pending.targetId);
  if (continuation === "assassin-blocked") return nextTurn(addLog(gameState, "J was blocked."));
  if (continuation === "assassin-hit" && pending.targetId) return resolveAssassinHit(gameState, getActivePlayer(gameState).id, pending.targetId);
  if (continuation === "duke-income") return resolveDukeIncome(gameState, pending.claimantId);
  if (continuation === "foreign-aid-blocked") return nextTurn(addLog(gameState, "3? was blocked."));
  if (continuation === "foreign-aid-income") return resolveForeignAidIncome(gameState, getActivePlayer(gameState).id);
  return nextTurn(gameState);
};

const continueAfterInfluenceLoss = (gameState: GameState, pending: PendingInfluenceLoss): GameState => {
  const next = {
    ...gameState,
    pendingInfluenceLoss: undefined
  };

  if (pending.afterResolve.type === "continue-after-coup") {
    return continueAfterCheck(next, pending.afterResolve.continuation, pending.afterResolve.pendingCheck);
  }

  return nextTurn(next);
};

const startAmbassadorExchange = (gameState: GameState, playerId: PlayerId): GameState => {
  const player = getPlayer(gameState, playerId);
  if (!player) return gameState;

  const drawn = drawCards(gameState.deck, 2);
  const exchange: AmbassadorExchange = {
    playerId,
    offeredCards: drawn.drawn
  };

  return addLog(
    {
      ...gameState,
      phase: "ambassadorExchange",
      timer: 0,
      deck: drawn.deck,
      ambassadorExchange: exchange
    },
    `${player.name} starts A exchange.`
  );
};

const startCaptainResponse = (gameState: GameState, actorId: PlayerId, targetId: PlayerId): GameState =>
  startNewSharedTimer({
    ...addLog(gameState, `${getPlayer(gameState, targetId)?.name ?? "Target"} must respond to K.`),
    phase: "pendingBlockOrResponse",
    pendingResponse: createPendingResponse(gameState, "K", actorId, targetId, targetId)
  });

const startAssassinResponse = (gameState: GameState, actorId: PlayerId, targetId: PlayerId): GameState =>
  startNewSharedTimer({
    ...addLog(gameState, `${getPlayer(gameState, targetId)?.name ?? "Target"} must respond to J.`),
    phase: "pendingBlockOrResponse",
    pendingResponse: createPendingResponse(gameState, "J", actorId, targetId, targetId)
  });

const resolveDukeIncome = (gameState: GameState, playerId: PlayerId): GameState => {
  const player = getPlayer(gameState, playerId);
  if (!player) return gameState;

  const next = updatePlayer(gameState, playerId, (current) => ({ ...current, coins: current.coins + 3 }));
  return nextTurn(addLog(next, `${player.name} gained 3 coins.`));
};

const resolveForeignAidIncome = (gameState: GameState, actorId: PlayerId): GameState => {
  const actor = getPlayer(gameState, actorId);
  if (!actor) return gameState;

  const next = updatePlayer(clearPendingResponse(gameState), actorId, (player) => ({ ...player, coins: player.coins + 2 }));
  return nextTurn(addLog(next, `${actor.name} gained 2 coins.`));
};

const resolveCaptainSteal = (gameState: GameState, actorId: PlayerId, targetId: PlayerId): GameState => {
  const actor = getPlayer(gameState, actorId);
  const target = getPlayer(gameState, targetId);
  if (!actor || !target) return gameState;

  const amount = Math.min(2, target.coins);
  let next = updatePlayer(clearPendingResponse(gameState), target.id, (player) => ({ ...player, coins: player.coins - amount }));
  next = updatePlayer(next, actor.id, (player) => ({ ...player, coins: player.coins + amount }));
  return nextTurn(addLog(next, `${actor.name} took ${amount} coins from ${target.name}.`));
};

const resolveAssassinHit = (gameState: GameState, actorId: PlayerId, targetId: PlayerId): GameState => {
  const actor = getPlayer(gameState, actorId);
  const target = getPlayer(gameState, targetId);
  if (!actor || !target) return gameState;

  const next = addLog(clearPendingResponse(gameState), `${actor.name}'s J hit ${target.name}.`);
  return requestInfluenceLoss(next, target.id, "assassin", { type: "next-turn" });
};

const createPendingResponse = (
  gameState: GameState,
  action: PendingActionType,
  actorId: PlayerId,
  targetId?: PlayerId,
  responderId?: PlayerId
): PendingResponse => {
  const actorName = getPlayer(gameState, actorId)?.name ?? "Player";
  const targetName = targetId ? getPlayer(gameState, targetId)?.name : undefined;
  const claimedCard: PendingResponse["claimedCard"] =
    action === "K" ? "K" : action === "J" ? "J" : action === "3" || action === "3?" ? "3" : undefined;

  return {
    id: makeId("response"),
    action,
    actorId,
    targetId,
    responderId,
    claimedCard,
    passedPlayerIds: [],
    prompt: responsePromptForAction(action, actorName, targetName),
    options: responseOptionsForAction(action),
    timeRemaining: RESPONSE_DURATION_SECONDS
  };
};

const resolveResponseTimeout = (gameState: GameState): GameState => {
  const pending = gameState.pendingResponse;
  if (!pending || gameState.phase !== "pendingBlockOrResponse") return gameState;

  const actor = getPlayer(gameState, pending.actorId);
  if (!actor) return nextTurn(clearPendingResponse(gameState));

  if (pending.action === "3?") {
    return resolveForeignAidIncome(gameState, actor.id);
  }

  if (pending.action === "K" && pending.targetId) {
    return resolveCaptainSteal(gameState, actor.id, pending.targetId);
  }

  if (pending.action === "J" && pending.targetId) {
    return resolveAssassinHit(gameState, actor.id, pending.targetId);
  }

  return nextTurn(clearPendingResponse(gameState));
};

const resolveTargetSelectionTimeout = (gameState: GameState): GameState => {
  const selection = gameState.targetSelection;
  if (!selection || gameState.phase !== "selectingTarget") return gameState;

  const actor = getPlayer(gameState, selection.actorId);
  if (!actor || actor.eliminated) return nextTurn(clearPending(gameState));

  const targets = gameState.players.filter((candidate) => candidate.id !== actor.id && !candidate.eliminated);
  const target = targets[Math.floor(Math.random() * targets.length)];

  if (!target) {
    return nextTurn(addLog(clearPending(gameState), `${actor.name}'s target timer expired, but no target was available.`));
  }

  return selectTarget(
    addLog(gameState, `${actor.name}'s target timer expired. Auto-targeted ${target.name}.`),
    actor.id,
    target.id
  );
};

const resolveTurnTimeout = (gameState: GameState): GameState => {
  const player = getActivePlayer(gameState);

  if (!player || player.eliminated) {
    return nextTurn(gameState);
  }

  if (player.coins >= 10) {
    const targets = gameState.players.filter((candidate) => candidate.id !== player.id && !candidate.eliminated);
    const target = targets[Math.floor(Math.random() * targets.length)];

    if (!target || player.coins < 7) {
      return nextTurn(addLog(gameState, `${player.name}'s timer expired, but no DROP target was available.`));
    }

    let next = updatePlayer(gameState, player.id, (current) => ({ ...current, coins: current.coins - 7 }));
    next = clearPending(addLog(next, `${player.name}'s timer expired. DROP auto-targeted ${target.name}.`));
    return requestInfluenceLoss(next, target.id, "drop", { type: "next-turn" });
  }

  const next = updatePlayer(gameState, player.id, (current) => ({ ...current, coins: current.coins + 1 }));
  return nextTurn(addLog(next, `${player.name}'s timer expired. CHECK added 1 coin.`));
};

const revealAndReplaceClaimedCard = (gameState: GameState, playerId: PlayerId, card: Card): GameState => {
  const drawn = drawCards(gameState.deck, 1);

  if (drawn.drawn.length === 0) {
    return updatePlayer(gameState, playerId, (player) => ({
      ...player,
      cards: player.cards.map((item) => (item.id === card.id ? { ...item, revealed: true } : item))
    }));
  }

  return updatePlayer(
    {
      ...gameState,
      deck: returnCardsToDeck(drawn.deck, [{ ...card, revealed: false }])
    },
    playerId,
    (player) => ({
      ...player,
      cards: player.cards.map((item) => (item.id === card.id ? { ...drawn.drawn[0], revealed: false } : item))
    })
  );
};

const clearPending = (gameState: GameState): GameState => ({
  ...gameState,
  pendingResponse: undefined,
  pendingCheck: undefined,
  pendingInfluenceLoss: undefined,
  targetSelection: undefined,
  ambassadorExchange: undefined
});

const clearPendingCheck = (gameState: GameState): GameState => ({
  ...gameState,
  pendingCheck: undefined
});

const clearPendingResponse = (gameState: GameState): GameState => ({
  ...gameState,
  pendingResponse: undefined
});

const startNewSharedTimer = (gameState: GameState): GameState =>
  applySharedTimer({
    ...gameState,
    timerStartedAt: undefined,
    timerEndsAt: undefined
  });

const getEligibleCheckers = (gameState: GameState, pending: PendingCheck): PlayerId[] =>
  pending.eligibleCheckerIds.filter((playerId) => {
    const player = getPlayer(gameState, playerId);
    return Boolean(player && !player.eliminated && player.id !== pending.claimantId);
  });

const getEligibleForeignAidResponders = (gameState: GameState, pending: PendingResponse): PlayerId[] =>
  gameState.players
    .filter((player) => player.id !== pending.actorId && !player.eliminated)
    .map((player) => player.id);

const updatePlayer = (gameState: GameState, playerId: PlayerId, updater: (player: Player) => Player): GameState => ({
  ...gameState,
  players: gameState.players.map((player) => (player.id === playerId ? updater(player) : player))
});

const addLog = (gameState: GameState, message: string): GameState => ({
  ...gameState,
  log: [createLogEntry(message), ...gameState.log].slice(0, 30)
});

const addActionBubble = (gameState: GameState, playerId: PlayerId, label: string): GameState => ({
  ...gameState,
  actionBubble: {
    id: makeId("bubble"),
    playerId,
    label,
    expiresAt: Date.now() + 1800
  }
});

const createLogEntry = (message: string): GameLogEntry => ({
  id: makeId("log"),
  message,
  createdAt: Date.now()
});
