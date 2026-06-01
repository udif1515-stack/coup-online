import type { GameState, PlayerId } from "@/game/types";

type CheckModalProps = {
  gameState: GameState;
  onCoup: (checkerId?: PlayerId) => void;
  onContinue: (playerId: PlayerId) => void;
  currentPlayerId?: PlayerId;
  onlineMode?: boolean;
};

export function CheckModal({ gameState, onCoup, onContinue, currentPlayerId, onlineMode = false }: CheckModalProps) {
  const pending = gameState.pendingCheck;
  if (!pending) return null;

  const passedPlayerIds = pending.passedPlayerIds ?? [];
  const checkers = gameState.players.filter(
    (player) =>
      pending.eligibleCheckerIds.includes(player.id) &&
      !player.eliminated &&
      player.id !== pending.claimantId
  );
  const currentPlayerCanRespond = Boolean(currentPlayerId && checkers.some((player) => player.id === currentPlayerId));
  const currentPlayerPassed = Boolean(currentPlayerId && passedPlayerIds.includes(currentPlayerId));
  const claimant = gameState.players.find((player) => player.id === pending.claimantId);
  const claimText = `${claimant?.name ?? "Player"} claims ${pending.claimedCard}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3">
      <div className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-red-700">COUP</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">{claimText}</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">Time: {pending.timeRemaining}</div>
        </div>

        {onlineMode ? (
          <div className="mt-4 grid gap-2">
            {currentPlayerCanRespond ? (
              <>
                <button
                  type="button"
                  onClick={() => currentPlayerId && onCoup(currentPlayerId)}
                  className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95"
                >
                  COUP
                </button>
                <button
                  type="button"
                  disabled={currentPlayerPassed}
                  onClick={() => currentPlayerId && onContinue(currentPlayerId)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 active:scale-95 disabled:opacity-55"
                >
                  {currentPlayerPassed ? "Continued" : "Continue"}
                </button>
              </>
            ) : (
              <p className="rounded-lg bg-slate-100 p-3 text-sm font-bold text-slate-600">Waiting for COUP window...</p>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            <p className="text-xs font-bold uppercase text-slate-500">Choose COUP responder</p>
            {checkers.map((player) => (
              <div key={player.id} className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onCoup(player.id)}
                  className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95"
                >
                  {player.name}: COUP
                </button>
                <button
                  type="button"
                  disabled={passedPlayerIds.includes(player.id)}
                  onClick={() => onContinue(player.id)}
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
