import { useEffect, useState } from "react";
import type { GameState, PlayerId } from "@/game/types";
import { Card } from "./Card";

type ActionModalProps = {
  gameState: GameState;
  currentPlayerId?: PlayerId;
  onlineMode?: boolean;
  onConfirm: (playerId: PlayerId, oldCardId: string, offeredCardId: string) => void;
};

export function ActionModal({
  gameState,
  currentPlayerId,
  onlineMode = false,
  onConfirm
}: ActionModalProps) {
  const exchange = gameState.ambassadorExchange;
  const [selectedOldCardId, setSelectedOldCardId] = useState<string>();
  const [selectedOfferedCardId, setSelectedOfferedCardId] = useState<string>();

  const offeredCardKey = exchange?.offeredCards.map((card) => card.id).join(":") ?? "";

  useEffect(() => {
    setSelectedOldCardId(undefined);
    setSelectedOfferedCardId(undefined);
  }, [exchange?.playerId, offeredCardKey]);

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

  const liveCards = player.cards.filter((card) => !card.revealed);
  const step = !selectedOldCardId ? 1 : !selectedOfferedCardId ? 2 : 3;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-3">
      <div className="w-full max-w-sm rounded-t-2xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl">
        <p className="text-xs font-bold uppercase text-brass">A exchange - Step {step}</p>
        <h2 className="mt-1 text-lg font-black">{player.name} may replace one card.</h2>

        <div className="mt-4">
          <p className="text-sm font-bold">1. Choose one current card to replace</p>
          <div className="mt-2 flex gap-2">
            {liveCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setSelectedOldCardId(card.id);
                  setSelectedOfferedCardId(undefined);
                }}
                className={[
                  "rounded-lg p-1 transition",
                  selectedOldCardId === card.id ? "bg-brass" : "bg-white/10"
                ].join(" ")}
              >
                <Card card={card} />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-bold">2. Choose one offered card</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {exchange.offeredCards.map((card) => (
              <button
                key={card.id}
                type="button"
                disabled={!selectedOldCardId}
                onClick={() => setSelectedOfferedCardId(card.id)}
                className={[
                  "flex justify-center rounded-lg border p-2 transition",
                  selectedOfferedCardId === card.id ? "border-brass bg-brass/25" : "border-white/10 bg-white/10",
                  !selectedOldCardId ? "opacity-40" : ""
                ].join(" ")}
              >
                <Card card={card} compact />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedOldCardId || !selectedOfferedCardId}
          onClick={() =>
            selectedOldCardId &&
            selectedOfferedCardId &&
            onConfirm(exchange.playerId, selectedOldCardId, selectedOfferedCardId)
          }
          className="mt-4 w-full rounded-lg bg-brass px-4 py-3 text-sm font-black text-ink disabled:opacity-40"
        >
          Confirm exchange
        </button>
      </div>
    </div>
  );
}
