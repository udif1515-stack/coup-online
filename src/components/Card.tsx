import type { Card as GameCard } from "@/game/types";

type CardProps = {
  card?: GameCard;
  hidden?: boolean;
  compact?: boolean;
  roomy?: boolean;
};

export function Card({ card, hidden = false, compact = false, roomy = false }: CardProps) {
  const isLost = card?.revealed;
  const sizeClass = roomy ? "h-16 w-12 text-base" : compact ? "h-14 w-10 text-sm" : "h-20 w-14 text-xl";
  const colorClass =
    card?.color === "red"
      ? "border-red-500/70 bg-red-50 text-red-950 shadow-red-950/10"
      : card?.color === "green"
        ? "border-emerald-500/70 bg-emerald-50 text-emerald-950 shadow-emerald-950/10"
        : card?.color === "blue"
          ? "border-sky-500/70 bg-sky-50 text-sky-950 shadow-sky-950/10"
          : "border-brass/60 bg-mist text-ink";
  const pipClass =
    card?.color === "red"
      ? "bg-red-600"
      : card?.color === "green"
        ? "bg-emerald-600"
        : card?.color === "blue"
          ? "bg-sky-600"
          : "bg-brass";

  return (
    <div
      className={[
        "relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border text-center font-black shadow-sm transition",
        sizeClass,
        hidden
          ? "border-emerald-200/30 bg-emerald-950 text-emerald-100"
          : colorClass,
        isLost ? "opacity-35 grayscale" : ""
      ].join(" ")}
      title={card && !hidden ? card.type : "Hidden card"}
    >
      {hidden ? (
        <span className="text-lg">?</span>
      ) : card ? (
        <>
          <span className={["absolute right-1 top-1 h-2 w-2 rounded-full", pipClass].join(" ")} />
          <span className="drop-shadow-sm">{card.type}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wide">{card.revealed ? "OUT" : ""}</span>
        </>
      ) : (
        <span>-</span>
      )}
    </div>
  );
}
