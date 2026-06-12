"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createLobby, joinLobby } from "@/services/onlineGameService";

type LobbyMode = "create" | "join";
const HOME_NOTICE_KEY = "coup_home_notice";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<LobbyMode>();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const nextNotice = window.sessionStorage.getItem(HOME_NOTICE_KEY);
    if (!nextNotice) return;

    window.sessionStorage.removeItem(HOME_NOTICE_KEY);
    setNotice(nextNotice);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode) return;

    setError(undefined);
    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Enter your name");

      if (mode === "create") {
        await createLobby(trimmedName);
      } else {
        await joinLobby(trimmedName, roomCode);
      }

      router.push("/lobby");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enter lobby");
    } finally {
      setIsSubmitting(false);
    }
  };

  const chooseMode = (nextMode: LobbyMode) => {
    setMode(nextMode);
    setError(undefined);
    setNotice(undefined);
    setName("");
    setRoomCode("");
  };

  const handleCreateLobbyClick = () => {
    console.log("Create Lobby button clicked");
    chooseMode("create");
  };

  const handleJoinLobbyClick = () => {
    console.log("Join Lobby button clicked");
    chooseMode("join");
  };

  if (showInstructions) {
    return (
      <main className="min-h-dvh bg-[#f4efe5] px-5 py-6 text-slate-950">
        <div className="mx-auto flex max-h-[calc(100dvh-3rem)] max-w-md flex-col">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-4xl font-black">INSTRUCTIONS</h1>
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white active:scale-95"
            >
              BACK
            </button>
          </div>

          <div className="mt-5 grid gap-4 overflow-y-auto pb-3 pr-1">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase text-red-700">VIDEO EXPLANATION</h2>
              <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-slate-950">
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube.com/embed/IBIzEOW49JQ"
                  title="COUP rules explanation video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </section>

            <section className="rounded-xl border-2 border-slate-950 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase text-red-700">Goal</h2>
              <p className="mt-2 text-sm font-bold">Be the last player with cards remaining.</p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase text-red-700">Setup</h2>
              <p className="mt-2 text-sm font-bold">Each player starts with 2 hidden cards and 2 coins.</p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase text-red-700">Actions</h2>
              <div className="mt-3 grid gap-2 text-sm">
                {[
                  ["CHECK", "Take 1 coin. Cannot be COUPed."],
                  ["3", "Claim 3 and take 3 coins."],
                  ["3?", "Ask for 2 coins. Other players may block by claiming 3."],
                  ["K", "Steal up to 2 coins from another player. Can be blocked with K or A."],
                  ["J", "Pay 3 coins to attack another player. Can be blocked with Q."],
                  ["A", "Exchange one of your cards with one of two cards from the deck."],
                  ["DROP", "Pay 7 coins to force another player to reveal one card. Cannot be blocked or COUPed."]
                ].map(([action, description]) => (
                  <div key={action} className="grid grid-cols-[4.25rem_1fr] gap-3 rounded-lg bg-slate-50 p-3">
                    <span className="font-black">{action}</span>
                    <span className="font-bold text-slate-700">{description}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase text-red-700">COUP</h2>
              <p className="mt-2 text-sm font-bold text-slate-700">
                When a player claims a card, other players may COUP them. If the claim was false, the claiming player
                loses a card. If the claim was true, the player who COUPed loses a card.
              </p>
            </section>

            <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
              <h2 className="text-sm font-black uppercase text-amber-800">Important</h2>
              <p className="mt-2 text-sm font-black text-amber-900">
                If you have 10 or more coins, you must use DROP.
              </p>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f4efe5] px-5 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col justify-center">
        <h1 className="text-center text-6xl font-black leading-none">COUP</h1>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={handleCreateLobbyClick}
            className="rounded-lg bg-slate-950 px-4 py-4 text-lg font-black text-white"
          >
            Create Lobby
          </button>
          <button
            type="button"
            onClick={handleJoinLobbyClick}
            className="rounded-lg border-2 border-slate-950 bg-white px-4 py-4 text-lg font-black text-slate-950"
          >
            Join Lobby
          </button>
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="rounded-lg border-2 border-slate-950 bg-white px-4 py-4 text-lg font-black text-slate-950"
          >
            INSTRUCTIONS
          </button>
        </div>

        {notice ? <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-800">{notice}</p> : null}

        {mode ? (
          <form onSubmit={handleSubmit} className="mt-5 rounded-xl border-2 border-slate-950 bg-white p-4 shadow-sm">
            <label className="grid gap-2 text-sm font-black uppercase text-slate-600">
              Player name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-lg font-bold normal-case text-slate-950"
                placeholder="Player name"
                autoFocus
              />
            </label>

            {mode === "join" ? (
              <label className="mt-4 grid gap-2 text-sm font-black uppercase text-slate-600">
                Room code
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-lg font-bold tracking-[0.25em] text-slate-950"
                  placeholder="482913"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
            ) : null}

            {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-4 text-lg font-black text-white disabled:opacity-50"
            >
              {isSubmitting ? "Working..." : mode === "create" ? "Create Lobby" : "Join Lobby"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
