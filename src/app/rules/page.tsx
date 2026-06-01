import Link from "next/link";

const rows = [
  ["A", "Ambassador", "Exchange one of your cards with one of two offered deck cards."],
  ["K", "Captain", "Target a player. They may claim Captain, claim Ambassador, or give 2 coins."],
  ["Q", "Contessa", "Defensive card that blocks Assassin attacks."],
  ["J", "Assassin", "Costs 3 coins. Target a player; they may block with Contessa or lose influence."],
  ["3", "Duke", "Claim Duke and gain 3 coins."],
  ["3?", "Foreign Aid", "Ask for 2 coins unless another player blocks with Duke."]
];

export default function RulesPage() {
  return (
    <main className="min-h-dvh bg-[#081a17] px-5 py-6 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-bold text-brass">
          Back
        </Link>
        <h1 className="mt-5 text-4xl font-black">Rules</h1>
        <p className="mt-3 text-emerald-50/75">
          Each player starts with 2 hidden cards and coins. Players take turns claiming actions. Some claims can be
          blocked or checked. A player is eliminated after losing both cards; the last player standing wins.
        </p>

        <section className="mt-6 grid gap-3">
          {rows.map(([code, title, description]) => (
            <article key={code} className="rounded-lg border border-white/10 bg-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-10 items-center justify-center rounded-md bg-brass text-xl font-black text-ink">
                  {code}
                </div>
                <div>
                  <h2 className="font-black">{title}</h2>
                  <p className="text-sm text-white/70">{description}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/10 p-4 text-sm text-white/75">
          <h2 className="text-base font-black text-white">CHECK and blocking</h2>
          <p className="mt-2">
            CHECK means another player says the claimed card is not real. The local version lets you choose the checker
            from a modal so the flow is easy to test.
          </p>
          <p className="mt-2">
            DROP costs 7 coins and cannot be blocked or checked. J costs 3 coins and can be blocked by Q / Contessa.
          </p>
        </section>
      </div>
    </main>
  );
}
