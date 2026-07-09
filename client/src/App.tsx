import { useEffect, useMemo, useState } from "react";
import { createSession, getPlayerCard, getSessionState, joinSession } from "./api";
import { socket } from "./socket";
import type { Category, PlayerCard, PublicState } from "./types";

const categories: Category[] = ["SPORT", "ZWIERZETA", "JEDZENIE", "MIEJSCE", "ZAWOD", "WYDARZENIE"];

type LocalPlayer = { sessionPlayerId: string; code: string };

export default function App() {
  const [mode, setMode] = useState<"menu" | "create" | "join" | "game">("menu");
  const [state, setState] = useState<PublicState | null>(null);
  const [localPlayer, setLocalPlayer] = useState<LocalPlayer | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [error, setError] = useState("");
  const [guess, setGuess] = useState("");
  const [voteTarget, setVoteTarget] = useState("");
  const [flash, setFlash] = useState<null | "green" | "red">(null);

  useEffect(() => {
    socket.connect();
    socket.on("session:state", (nextState: PublicState) => setState(nextState));
    socket.on("round:result", (result: { eliminatedWasImpostor: boolean }) => {
      setFlash(result.eliminatedWasImpostor ? "red" : "green");
      setTimeout(() => setFlash(null), 1300);
    });
    socket.on("session:error", (payload: { message: string }) => setError(payload.message));
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!localPlayer) return;
    socket.emit("session:watch", { code: localPlayer.code });
    getSessionState(localPlayer.code).then(setState).catch(() => null);
    getPlayerCard(localPlayer.sessionPlayerId).then(setCard).catch(() => null);
  }, [localPlayer]);

  const me = useMemo(
    () => state?.players.find((p) => p.id === localPlayer?.sessionPlayerId) ?? null,
    [state, localPlayer]
  );
  const isHost = Boolean(me?.isHost);

  const commonBtn = "rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500";

  if (mode === "menu") {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
        <h1 className="text-4xl font-bold">Party Games</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setMode("create")} className="rounded-xl border border-violet-400 p-6 text-left">
            <p className="text-2xl font-bold">Impostor</p>
            <p>Stworz lobby lub dolacz przez kod.</p>
          </button>
          {["Wavelength", "Mafia", "Trivia"].map((g) => (
            <button key={g} disabled className="rounded-xl border border-zinc-700 p-6 text-left opacity-50">
              <p className="text-xl font-semibold">{g}</p>
              <p>Wkrotce</p>
            </button>
          ))}
        </div>
        <button onClick={() => setMode("join")} className={commonBtn}>
          Dolacz do lobby
        </button>
      </main>
    );
  }

  if (mode === "create") return <CreateLobby onBack={() => setMode("menu")} onCreated={(v) => { setLocalPlayer(v); setMode("game"); }} />;
  if (mode === "join") return <JoinLobby onBack={() => setMode("menu")} onJoined={(v) => { setLocalPlayer(v); setMode("game"); }} />;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4">
      {flash && (
        <div
          className="round-flash pointer-events-none fixed inset-0 z-50"
          style={{ ["--flash-color" as string]: flash === "green" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)" }}
        />
      )}
      <header className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <div>
          <p className="font-semibold">Kod lobby: {state?.code}</p>
          <p className="text-sm text-zinc-400">Runda: {state?.roundNumber ?? 0}</p>
        </div>
        <p className="text-sm text-zinc-300">{me?.username}</p>
      </header>
      {error && <p className="rounded-md bg-red-900/60 p-2 text-sm">{error}</p>}
      {state?.status === "LOBBY" && (
        <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-zinc-800 p-4">
            <h2 className="mb-2 text-xl font-semibold">Lobby</h2>
            <ul className="space-y-2">
              {state.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md bg-zinc-900 p-2">
                  <span>{p.username} {p.isHost ? "(GM)" : ""}</span>
                  {isHost && !p.isHost && (
                    <button className="text-sm text-red-300" onClick={() => socket.emit("session:kick", { hostSessionPlayerId: localPlayer?.sessionPlayerId, targetSessionPlayerId: p.id, code: state.code })}>Wyrzuc</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <h3 className="font-semibold">Ustawienia gry</h3>
            <p className="text-sm">Impostorzy: {state.impostorCount}</p>
            <p className="text-sm">Kategorie: {state.selectedCategories.join(", ")}</p>
            <p className="text-sm">Podpowiedzi: {state.hintEnabled ? "on" : "off"}</p>
            <p className="text-sm">Impostorzy sie znaja: {state.impostorsKnowEachOther ? "on" : "off"}</p>
            {isHost && (
              <button className={`${commonBtn} mt-3 w-full`} onClick={() => socket.emit("game:start", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>
                Uruchom gre
              </button>
            )}
          </div>
        </section>
      )}

      {state && state.status !== "LOBBY" && (
        <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-400">Kategoria</p>
            <p className="mb-4 text-2xl font-bold">{card?.category ?? "-"}</p>
            {card && (
              <div className="rounded-xl bg-zinc-800 p-4">
                <p className="text-xl font-semibold">{card.isImpostor ? "Jestes IMPOSOTREM" : `Haslo: ${card.word}`}</p>
                {card.isImpostor && card.hint && <p className="mt-2 text-zinc-300">Podpowiedz: {card.hint}</p>}
                {card.isImpostor && card.otherImpostors.length > 0 && (
                  <p className="mt-1 text-zinc-300">Inny impostor: {card.otherImpostors.map((o) => o.username).join(", ")}</p>
                )}
                <button className={`${commonBtn} mt-3`} onClick={() => socket.emit("card:acknowledge", { sessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>
                  OK, zapamietalem
                </button>
              </div>
            )}
            <div className="mt-4 rounded-lg border border-zinc-700 p-3">
              <p className="font-semibold">Glosowanie: {state.status === "VOTING" ? "Aktywne" : "Nieaktywne"}</p>
              {state.status === "VOTING" && (
                <div className="mt-2 flex gap-2">
                  <select className="flex-1 rounded-md bg-zinc-800 p-2" value={voteTarget} onChange={(e) => setVoteTarget(e.target.value)}>
                    <option value="">Wybierz gracza</option>
                    {state.players.filter((p) => !p.isEliminated && p.id !== localPlayer?.sessionPlayerId).map((p) => (
                      <option key={p.id} value={p.id}>{p.username}</option>
                    ))}
                  </select>
                  <button className={commonBtn} onClick={() => socket.emit("vote:submit", { voterId: localPlayer?.sessionPlayerId, targetId: voteTarget, code: state.code })}>Glosuj</button>
                </div>
              )}
            </div>
          </div>
          <aside className="rounded-xl border border-zinc-800 p-4">
            {isHost && (
              <div className="space-y-2">
                <button className={`${commonBtn} w-full`} onClick={() => socket.emit("vote:start", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>Uruchom glosowanie</button>
                <button className={`${commonBtn} w-full`} onClick={() => socket.emit("vote:finalize", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>Zakoncz glosowanie</button>
                <button className={`${commonBtn} w-full`} onClick={() => socket.emit("round:next", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>Nastepna runda</button>
                <button className="w-full rounded-lg bg-zinc-700 px-4 py-2" onClick={() => socket.emit("game:reset", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>Powrot do lobby</button>
              </div>
            )}
            {card?.isImpostor && (
              <div className="mt-4 rounded-lg border border-red-700 p-3">
                <p className="font-semibold text-red-300">Strzal impostora (raz na gre)</p>
                <input value={guess} onChange={(e) => setGuess(e.target.value)} className="mt-2 w-full rounded-md bg-zinc-800 p-2" placeholder="Wpisz haslo" />
                <button className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2" onClick={() => socket.emit("impostor:guess", { sessionPlayerId: localPlayer?.sessionPlayerId, guessedWord: guess, code: state.code })}>Zgadnij</button>
              </div>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}

function CreateLobby(props: { onBack: () => void; onCreated: (v: LocalPlayer) => void }) {
  const [hostUsername, setHostUsername] = useState("Gamemaster");
  const [impostorCount, setImpostorCount] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(["SPORT", "ZWIERZETA"]);
  const [hintEnabled, setHintEnabled] = useState(true);
  const [impostorsKnowEachOther, setImpostorsKnowEachOther] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
      <button onClick={props.onBack} className="text-left text-zinc-400">← Wroc</button>
      <h2 className="text-2xl font-bold">Stworz lobby Impostor</h2>
      {error && <p className="rounded-md bg-red-900/50 p-2">{error}</p>}
      <input className="rounded-md bg-zinc-800 p-2" value={hostUsername} onChange={(e) => setHostUsername(e.target.value)} placeholder="Username GM" />
      <label>Impostorzy: {impostorCount}</label>
      <input type="range" min={1} max={3} value={impostorCount} onChange={(e) => setImpostorCount(Number(e.target.value))} />
      <div className="grid grid-cols-2 gap-2">
        {categories.map((c) => (
          <label key={c} className="rounded-md border border-zinc-700 p-2">
            <input
              type="checkbox"
              checked={selectedCategories.includes(c)}
              onChange={(e) =>
                setSelectedCategories((prev) =>
                  e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)
                )
              }
            />{" "}
            {c}
          </label>
        ))}
      </div>
      <label><input type="checkbox" checked={hintEnabled} onChange={(e) => setHintEnabled(e.target.checked)} /> Podpowiedz dla impostora</label>
      <label><input type="checkbox" checked={impostorsKnowEachOther} onChange={(e) => setImpostorsKnowEachOther(e.target.checked)} /> Impostorzy wiedza o sobie</label>
      <button
        className="rounded-lg bg-violet-600 px-4 py-2 font-semibold"
        onClick={async () => {
          try {
            const out = await createSession({
              hostUsername,
              impostorCount,
              selectedCategories,
              hintEnabled,
              impostorsKnowEachOther
            });
            props.onCreated({ sessionPlayerId: out.sessionPlayerId, code: out.code });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Stworz pokoj
      </button>
    </main>
  );
}

function JoinLobby(props: { onBack: () => void; onJoined: (v: LocalPlayer) => void }) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
      <button onClick={props.onBack} className="text-left text-zinc-400">← Wroc</button>
      <h2 className="text-2xl font-bold">Dolacz do lobby</h2>
      {error && <p className="rounded-md bg-red-900/50 p-2">{error}</p>}
      <input className="rounded-md bg-zinc-800 p-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input className="rounded-md bg-zinc-800 p-2" placeholder="Kod 6 cyfr" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      <button
        className="rounded-lg bg-violet-600 px-4 py-2 font-semibold"
        onClick={async () => {
          try {
            const out = await joinSession({ code, username });
            props.onJoined({ sessionPlayerId: out.sessionPlayerId, code });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Dolacz
      </button>
    </main>
  );
}
