import type { GameState } from "@/game/types";

type TargetSelectionProps = {
  gameState: GameState;
  onCancel: () => void;
};

export function TargetSelection({ gameState, onCancel }: TargetSelectionProps) {
  const selection = gameState.targetSelection;
  if (!selection) return null;

  const actor = gameState.players.find((player) => player.id === selection.actorId);

  return (
    <div className="rounded-lg border border-amber-400 bg-amber-100 p-3 text-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-amber-700">Select target</p>
          <p className="text-sm">
            {actor?.name} is choosing a target for {selection.action === "Drop" ? "DROP" : selection.action}.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold uppercase"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
