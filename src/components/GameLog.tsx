import type { GameLogEntry } from "@/game/types";

type GameLogProps = {
  entries: GameLogEntry[];
};

export function GameLog({ entries }: GameLogProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 text-slate-950 shadow-sm">
      <h2 className="text-sm font-black uppercase tracking-wide text-amber-700">Recent actions</h2>
      <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No actions yet.</p>
        ) : (
          entries.map((entry) => (
            <p key={entry.id} className="text-sm text-slate-700">
              {entry.message}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
