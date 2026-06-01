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

  return (
    <div
      className={[
        "flex shrink-0 flex-col items-center justify-center rounded-md border text-center font-black shadow-sm transition",
        sizeClass,
        hidden
          ? "border-emerald-200/30 bg-emerald-950 text-emerald-100"
          : "border-brass/60 bg-mist text-ink",
        isLost ? "opacity-35 grayscale" : ""
      ].join(" ")}
      title={card && !hidden ? card.type : "Hidden card"}
    >
      {hidden ? (
        <span className="text-lg">?</span>
      ) : card ? (
        <>
          <span>{card.type}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wide">{card.revealed ? "OUT" : ""}</span>
        </>
      ) : (
        <span>-</span>
      )}
    </div>
  );
}
