import { RESPONSE_LABELS } from "@/game/rules";
import type { GameState, PlayerId, ResponseType } from "@/game/types";
import { Card } from "./Card";

type ResponseModalProps = {
  gameState: GameState;
  onRespond: (playerId: PlayerId, response: ResponseType) => void;
  currentPlayerId?: PlayerId;
  onlineMode?: boolean;
};

export function ResponseModal({ gameState, onRespond, currentPlayerId, onlineMode = false }: ResponseModalProps) {
  const pending = gameState.pendingResponse;
  if (!pending) return null;

  const renderYourCards = (playerId?: PlayerId) => {
    if (!playerId || playerId !== currentPlayerId) return null;

    const player = gameState.players.find((item) => item.id === playerId);
    if (!player) return null;

    return (
      <div className="mt-4 rounded-lg bg-slate-100 p-3">
        <p className="text-xs font-black uppercase text-slate-500">Your cards</p>
        <div className="mt-2 flex gap-1.5">
          {player.cards.map((card) => (
            <Card key={card.id} card={card} compact />
          ))}
        </div>
      </div>
    );
  };

  if (pending.action === "3?") {
    const blockers = gameState.players.filter((player) => player.id !== pending.actorId && !player.eliminated);
    const currentBlocker = blockers.find((player) => player.id === currentPlayerId);
    const passedPlayerIds = pending.passedPlayerIds ?? [];
    const currentBlockerPassed = Boolean(currentBlocker && passedPlayerIds.includes(currentBlocker.id));

    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3">
        <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-amber-700">3?</p>
              <h2 className="mt-1 text-lg font-black">{pending.prompt}</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">Time: {pending.timeRemaining}</div>
          </div>

          {renderYourCards(currentBlocker?.id)}

          {onlineMode ? (
            <div className="mt-4 grid gap-2">
              {currentBlocker ? (
                <>
                  <button
                    type="button"
                    onClick={() => onRespond(currentBlocker.id, "claim-duke")}
                    className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95"
                  >
                    3
                  </button>
                  <button
                    type="button"
                    disabled={currentBlockerPassed}
                    onClick={() => onRespond(currentBlocker.id, "do-not-block")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 active:scale-95 disabled:opacity-55"
                  >
                    {currentBlockerPassed ? "Continued" : "Continue"}
                  </button>
                </>
              ) : (
                <p className="rounded-lg bg-slate-100 p-3 text-sm font-bold text-slate-600">Waiting for blockers...</p>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {blockers.map((player) => (
                <div key={player.id} className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onRespond(player.id, "claim-duke")}
                    className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95"
                  >
                    {player.name}: 3
                  </button>
                  <button
                    type="button"
                    disabled={passedPlayerIds.includes(player.id)}
                    onClick={() => onRespond(player.id, "do-not-block")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 active:scale-95 disabled:opacity-55"
                  >
                    {passedPlayerIds.includes(player.id) ? "Continued" : "Continue"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const responder = pending.responderId
    ? gameState.players.find((player) => player.id === pending.responderId)
    : gameState.players.find((player) => player.id !== pending.actorId && !player.eliminated);

  if (!responder) return null;
  if (onlineMode && currentPlayerId !== responder.id) {
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3">
        <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-amber-700">Waiting</p>
              <h2 className="mt-1 text-lg font-black">Waiting for {responder.name}...</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">Time: {pending.timeRemaining}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3">
      <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-amber-700">Waiting for {responder.name}</p>
            <h2 className="mt-1 text-lg font-black">{pending.prompt}</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">Time: {pending.timeRemaining}</div>
        </div>

        {renderYourCards(responder.id)}

        <div className="mt-4 grid gap-2">
          {pending.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRespond(responder.id, option)}
              className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95"
            >
              {RESPONSE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
