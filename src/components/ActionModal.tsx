import { useEffect, useState } from "react";
import type { GameState, PlayerId } from "@/game/types";
import { Card } from "./Card";

type ActionModalProps = {
  gameState: GameState;
  currentPlayerId?: PlayerId;
  onlineMode?: boolean;
  onSelectCard: (playerId: PlayerId, selectedCardIndex: number) => void;
  onConfirm: (playerId: PlayerId, offeredCardId: string) => void;
};

export function ActionModal({
  gameState,
  currentPlayerId,
  onlineMode = false,
  onSelectCard,
  onConfirm
}: ActionModalProps) {
  const pendingSelection = gameState.phase === "ambassadorSelection" ? gameState.pendingAmbassadorSelection : undefined;
  const exchange = gameState.ambassadorExchange;
  const [selectedOfferedCardId, setSelectedOfferedCardId] = useState<string>();

  const offeredCardKey = exchange?.offeredCards.map((card) => card.id).join(":") ?? "";

  useEffect(() => {
    setSelectedOfferedCardId(undefined);
  }, [exchange?.playerId, offeredCardKey]);

  if (pendingSelection) {
    const player = gameState.players.find((item) => item.id === pendingSelection.playerId);
    if (!player) return null;

    if (onlineMode && currentPlayerId !== player.id) {
      return (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3">
          <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
            <p className="text-xs font-black uppercase text-amber-700">A exchange</p>
            <h2 className="mt-1 text-lg font-black">Waiting for {player.name}...</h2>
          </div>
        </div>
      );
    }

    const liveCards = player.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !card.revealed);

    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-3">
        <div className="w-full max-w-sm rounded-t-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl">
          <p className="text-xs font-bold uppercase text-brass">A exchange</p>
          <h2 className="mt-1 text-lg font-black">{player.name}, choose one card slot to replace.</h2>

          <div className="mt-4 flex justify-center gap-2">
            {liveCards.map(({ card, index }) => (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelectCard(player.id, index)}
                className="rounded-lg bg-white/10 p-1 transition active:scale-95"
              >
                <Card card={card} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!exchange) return null;

  const player = gameState.players.find((item) => item.id === exchange.playerId);
  if (!player) return null;

  if (onlineMode && currentPlayerId !== player.id) {
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3">
        <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
          <p className="text-xs font-black uppercase text-amber-700">A exchange</p>
          <h2 className="mt-1 text-lg font-black">Waiting for {player.name}...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-3">
      <div className="w-full max-w-sm rounded-t-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl">
        <p className="text-xs font-bold uppercase text-brass">A exchange</p>
        <h2 className="mt-1 text-lg font-black">{player.name}, choose one offered card.</h2>

        <div className="mt-4">
          <div className="mt-2 grid grid-cols-2 gap-2">
            {exchange.offeredCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedOfferedCardId(card.id)}
                className={[
                  "flex justify-center rounded-lg border p-2 transition",
                  selectedOfferedCardId === card.id ? "border-brass bg-brass/25" : "border-white/10 bg-white/10"
                ].join(" ")}
              >
                <Card card={card} compact />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedOfferedCardId}
          onClick={() =>
            selectedOfferedCardId &&
            onConfirm(exchange.playerId, selectedOfferedCardId)
          }
          className="mt-4 w-full rounded-lg bg-brass px-4 py-3 text-sm font-black text-ink disabled:opacity-40"
        >
          Confirm exchange
        </button>
      </div>
    </div>
  );
}
