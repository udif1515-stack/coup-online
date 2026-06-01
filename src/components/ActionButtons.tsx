import type { LegalActions, TurnAction } from "@/game/types";

const PRIMARY_ACTIONS: TurnAction[] = ["A", "K", "J", "3", "3?", "Drop", "Check"];

type ActionButtonsProps = {
  legalActions: LegalActions;
  onAction: (action: TurnAction) => void;
  disabled?: boolean;
};

export function ActionButtons({ legalActions, onAction, disabled = false }: ActionButtonsProps) {
  const actions = PRIMARY_ACTIONS;

  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action) => {
        const state = legalActions[action];

        return (
          <button
            key={action}
            type="button"
            disabled={disabled || !state.enabled}
            onClick={() => onAction(action)}
            className={[
              action === "Check"
                ? "col-span-2 min-h-14 rounded-md border-2 px-2 py-2 text-center font-black shadow-sm transition"
                : action === "Drop"
                  ? "min-h-14 rounded-md border-2 px-2 py-2 text-center text-sm font-black shadow-sm transition"
                  : "min-h-14 rounded-md border-2 px-2 py-2 text-center font-black shadow-sm transition",
              state.enabled && !disabled
                ? "border-brass bg-brass text-ink active:scale-95"
                : "border-slate-200 bg-slate-100 text-slate-400"
            ].join(" ")}
          >
            <span className="block text-lg leading-none">{action === "Drop" ? "DROP" : action === "Check" ? "CHECK" : action}</span>
            <span className="mt-1 block text-[10px] font-bold uppercase leading-tight">
              {disabled ? "Paused" : state.enabled ? "" : state.reason}
            </span>
          </button>
        );
      })}
    </div>
  );
}
