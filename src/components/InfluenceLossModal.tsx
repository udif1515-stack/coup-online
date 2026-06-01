import type { GameState, PlayerId } from "@/game/types";
import { Card } from "./Card";

type InfluenceLossModalProps = {
  gameState: GameState;
  onReveal: (playerId: PlayerId, cardId: string) => void;
  currentPlayerId?: PlayerId;
  onlineMode?: boolean;
};

export function InfluenceLossModal({ gameState, onReveal, currentPlayerId, onlineMode = false }: InfluenceLossModalProps) {
  const pending = gameState.pendingInfluenceLoss;
  if (!pending) return null;

  const player = gameState.players.find((item) => item.id === pending.playerId);
  if (!player) return null;

  const liveCards = player.cards.filter((card) => !card.revealed);
  const canChoose = !onlineMode || currentPlayerId === player.id;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3">
      <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
        <p className="text-xs font-black uppercase text-red-700">Influence loss</p>
        <h2 className="mt-1 text-lg font-black">{player.name}, you must reveal one card.</h2>
        <p className="mt-1 text-sm text-slate-600">
          {canChoose ? "Choose which card to reveal." : `Waiting for ${player.name} to reveal a card.`}
        </p>

        {canChoose ? (
          <div className="mt-4 flex justify-center gap-3">
            {liveCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => onReveal(player.id, card.id)}
                className="rounded-lg border-2 border-slate-950 bg-white p-2 active:scale-95"
              >
                <Card card={card} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
