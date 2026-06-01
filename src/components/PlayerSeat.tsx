import { Card } from "./Card";
import type { Player, PlayerId } from "@/game/types";

type PlayerSeatProps = {
  player: Player;
  isViewer: boolean;
  isActive: boolean;
  selectable?: boolean;
  onSelect?: (playerId: PlayerId) => void;
};

export function PlayerSeat({ player, isViewer, isActive, selectable = false, onSelect }: PlayerSeatProps) {
  const hidden = !isViewer;

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => onSelect?.(player.id)}
      className={[
        "relative w-full rounded-lg border p-2 text-left transition",
        isViewer ? "bg-white text-ink" : "bg-white/80 text-slate-950 backdrop-blur",
        isActive ? "border-brass shadow-[0_0_0_2px_rgba(214,169,74,0.35)]" : "border-slate-300",
        selectable ? "scale-[1.02] cursor-pointer ring-2 ring-brass" : "cursor-default",
        player.eliminated ? "opacity-45" : ""
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="max-w-[9rem] truncate text-sm font-bold">{player.name}</p>
          <p className="text-xs text-slate-600">{player.coins} coins</p>
        </div>
        {player.eliminated ? (
          <span className="rounded-full bg-ember px-2 py-1 text-[10px] font-bold uppercase text-white">Out</span>
        ) : null}
      </div>

      <div className="mt-2 flex gap-1.5">
        {player.cards.map((card) => (
          <Card key={card.id} card={card} hidden={hidden && !card.revealed} compact />
        ))}
      </div>
    </button>
  );
}
