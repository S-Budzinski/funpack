import { useEffect, useMemo, useState } from "react";
import { createSession, getPlayerCard, getSessionState, joinSession } from "./api";
import { socket } from "./socket";
import type { Category, PlayerCard, PublicState } from "./types";

const categories: Category[] = ["SPORT", "ZWIERZETA", "JEDZENIE", "MIEJSCE", "ZAWOD", "WYDARZENIE"];

type LocalPlayer = { sessionPlayerId: string; code: string };
const SESSION_STORAGE_KEY = "impostor-local-player";

export default function App() {
  const [mode, setMode] = useState<"menu" | "gameMenu" | "create" | "join" | "game">("menu");
  const [state, setState] = useState<PublicState | null>(null);
  const [localPlayer, setLocalPlayer] = useState<LocalPlayer | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [error, setError] = useState("");
  const [guess, setGuess] = useState("");
  const [voteTarget, setVoteTarget] = useState("");
  const [flash, setFlash] = useState<null | "green" | "red">(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [votedForName, setVotedForName] = useState("");
  const [roundResult, setRoundResult] = useState<{
    eliminatedPlayerId: string;
    eliminatedWasImpostor: boolean;
  } | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [impostorDiscovered, setImpostorDiscovered] = useState(false);
  const [guessUsed, setGuessUsed] = useState(false);
  const [gameResultView, setGameResultView] = useState<"WIN" | "LOSE" | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [lobbySettingsDraft, setLobbySettingsDraft] = useState<{
    impostorCount: number;
    selectedCategories: Category[];
    hintEnabled: boolean;
    impostorsKnowEachOther: boolean;
  } | null>(null);

  useEffect(() => {
    socket.connect();
    socket.on("session:state", (nextState: PublicState) => setState(nextState));
    socket.on("session:closed", () => {
      setLocalPlayer(null);
      setState(null);
      setCard(null);
      setMode("menu");
      setError("Lobby zostalo zamkniete.");
    });
    socket.on("round:result", (result: { eliminatedPlayerId: string; eliminatedWasImpostor: boolean }) => {
      setRoundResult(result);
      setFlash(result.eliminatedWasImpostor ? "red" : "green");
      setTimeout(() => setFlash(null), 2200);
    });
    socket.on("session:error", (payload: { message: string }) => {
      if (payload.message.toLowerCase().includes("guess already used")) {
        setGuessUsed(true);
        return;
      }
      setError(payload.message);
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as LocalPlayer;
      if (saved?.sessionPlayerId && saved?.code) {
        setLocalPlayer(saved);
        setMode("game");
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!localPlayer) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(localPlayer));
  }, [localPlayer]);

  useEffect(() => {
    const handler = (payload: { sessionPlayerId: string; isCorrect: boolean; alreadyUsed?: boolean }) => {
      if (!localPlayer) return;
      if (payload.sessionPlayerId !== localPlayer.sessionPlayerId) return;
      if (payload.alreadyUsed || !payload.isCorrect) setGuessUsed(true);
    };
    socket.on("impostor:guess:result", handler);
    return () => {
      socket.off("impostor:guess:result", handler);
    };
  }, [localPlayer]);

  useEffect(() => {
    const gameResultHandler = (payload: { winner: "CIVILIANS" | "IMPOSTORS" }) => {
      const amImpostor = Boolean(card?.isImpostor);
      const won = (payload.winner === "IMPOSTORS" && amImpostor) || (payload.winner === "CIVILIANS" && !amImpostor);
      setGameResultView(won ? "WIN" : "LOSE");
      setShowResultOverlay(true);
      setTimeout(() => setShowResultOverlay(false), 10000);
    };
    socket.on("game:result", gameResultHandler);
    return () => {
      socket.off("game:result", gameResultHandler);
    };
  }, [card?.isImpostor]);

  useEffect(() => {
    if (!error.toLowerCase().includes("guess already used")) return;
    setGuessUsed(true);
  }, [error]);

  useEffect(() => {
    if (!localPlayer) return;
    socket.emit("session:watch", { code: localPlayer.code });
    getSessionState(localPlayer.code)
      .then(setState)
      .catch(() => {
        setLocalPlayer(null);
        setMode("menu");
      });
    getPlayerCard(localPlayer.sessionPlayerId).then(setCard).catch(() => setCard(null));
  }, [localPlayer]);

  useEffect(() => {
    if (!localPlayer || !state) return;
    getPlayerCard(localPlayer.sessionPlayerId).then(setCard).catch(() => null);
  }, [localPlayer, state?.roundNumber, state?.status]);

  useEffect(() => {
    if (card?.isImpostor && cardFlipped) {
      setImpostorDiscovered(true);
    }
  }, [card?.isImpostor, cardFlipped]);

  useEffect(() => {
    if (!state) return;
    setLobbySettingsDraft({
      impostorCount: state.impostorCount,
      selectedCategories: state.selectedCategories,
      hintEnabled: state.hintEnabled,
      impostorsKnowEachOther: state.impostorsKnowEachOther
    });
  }, [state?.code, state?.status, state?.impostorCount, state?.selectedCategories, state?.hintEnabled, state?.impostorsKnowEachOther]);

  useEffect(() => {
    setCardFlipped(false);
    setImpostorDiscovered(false);
    setVoteSubmitted(false);
    setVotedForName("");
    setVoteTarget("");
    setRoundResult(null);
    setGuessUsed(false);
    setGuess("");
    setGameResultView(null);
    setShowResultOverlay(false);
  }, [state?.roundNumber]);

  useEffect(() => {
    if (state?.status === "VOTING") {
      setVoteSubmitted(false);
      setVotedForName("");
      setVoteTarget("");
    }
  }, [state?.status]);

  const me = useMemo(
    () => state?.players.find((p) => p.id === localPlayer?.sessionPlayerId) ?? null,
    [state, localPlayer]
  );
  const isHost = Boolean(me?.isHost);
  const leaveLobby = () => {
    if (localPlayer) {
      socket.emit("session:leave", {
        sessionPlayerId: localPlayer.sessionPlayerId,
        code: localPlayer.code
      });
    }
    setLocalPlayer(null);
    setState(null);
    setCard(null);
    setGuess("");
    setVoteTarget("");
    setError("");
    setMode("menu");
  };

  const commonBtn = "rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500";
  const disabledBtn = "rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-400 cursor-not-allowed";
  const isCardReveal = state?.status === "CARD_REVEAL";
  const canShowCardFront = isCardReveal && cardFlipped && Boolean(card) && !card?.acknowledged;
  const isEliminated = Boolean(me?.isEliminated);
  const isWaitingForNextRound = Boolean(state && state.status !== "LOBBY" && !card && isEliminated);
  const eliminatedName = roundResult ? state?.players.find((p) => p.id === roundResult.eliminatedPlayerId)?.username ?? "Gracz" : "";
  const eliminatedRoleLabel = roundResult?.eliminatedWasImpostor ? "IMPOSTOR" : "UCZESTNIK";
  const gameLocked = state?.status === "GAME_END";
  const canStartVoting = Boolean(state && !gameLocked && state.status !== "VOTING" && state.status !== "LOBBY" && state.status !== "CARD_REVEAL");
  const canFinalizeVoting = Boolean(state && !gameLocked && state.status === "VOTING" && state.votesRequired > 0 && state.votesSubmitted >= state.votesRequired);

  if (mode === "menu") {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setMode("gameMenu")} className="rounded-xl border border-violet-400 p-6 text-left">
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
      </main>
    );
  }

  if (mode === "gameMenu") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
        <button onClick={() => setMode("menu")} className="text-left text-zinc-400">← Wroc</button>
        <h2 className="text-2xl font-bold">Impostor</h2>
        <p className="text-zinc-300">Wybierz jak chcesz wejsc do gry.</p>
        <button onClick={() => setMode("create")} className={commonBtn}>
          Stworz lobby
        </button>
        <button onClick={() => setMode("join")} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600">
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
      {showResultOverlay && gameResultView && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md bg-black/45">
          {gameResultView === "WIN" && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="win-flare flare-1" />
              <div className="win-flare flare-2" />
              <div className="win-flare flare-3" />
            </div>
          )}
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/90 px-10 py-8 text-center shadow-2xl">
            <p className={`text-5xl font-extrabold ${gameResultView === "WIN" ? "text-emerald-400" : "text-red-400"}`}>
              {gameResultView === "WIN" ? "Wygrana" : "Przegrana"}
            </p>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <div>
          <p className="font-semibold">Kod lobby: {state?.code}</p>
          <p className="text-sm text-zinc-400">Runda: {state?.roundNumber ?? 0}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-300">{me?.username}</p>
          <button className="rounded-lg bg-zinc-700 px-3 py-1 text-xs font-semibold hover:bg-zinc-600" onClick={leaveLobby}>
            Wyjdz z lobby
          </button>
        </div>
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
            {!isHost && (
              <>
                <p className="text-sm">Impostorzy: {state.impostorCount}</p>
                <p className="text-sm">Kategorie: {state.selectedCategories.join(", ")}</p>
                <p className="text-sm">Podpowiedzi: {state.hintEnabled ? "on" : "off"}</p>
                <p className="text-sm">Impostorzy sie znaja: {state.impostorsKnowEachOther ? "on" : "off"}</p>
              </>
            )}
            {isHost && lobbySettingsDraft && (
              <div className="mt-2 space-y-3">
                <div>
                  <label className="text-sm">Impostorzy: {lobbySettingsDraft.impostorCount}</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={lobbySettingsDraft.impostorCount}
                    onChange={(e) => setLobbySettingsDraft((prev) => prev ? ({ ...prev, impostorCount: Number(e.target.value) }) : prev)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <label key={c} className="rounded-md border border-zinc-700 p-2 text-xs">
                      <input
                        type="checkbox"
                        checked={lobbySettingsDraft.selectedCategories.includes(c)}
                        onChange={(e) =>
                          setLobbySettingsDraft((prev) => {
                            if (!prev) return prev;
                            const next = e.target.checked
                              ? [...prev.selectedCategories, c]
                              : prev.selectedCategories.filter((x) => x !== c);
                            return { ...prev, selectedCategories: next };
                          })
                        }
                      />{" "}
                      {c}
                    </label>
                  ))}
                </div>
                <label className="block text-sm">
                  <input
                    type="checkbox"
                    checked={lobbySettingsDraft.hintEnabled}
                    onChange={(e) => setLobbySettingsDraft((prev) => prev ? ({ ...prev, hintEnabled: e.target.checked }) : prev)}
                  />{" "}
                  Podpowiedz dla impostora
                </label>
                <label className="block text-sm">
                  <input
                    type="checkbox"
                    checked={lobbySettingsDraft.impostorsKnowEachOther}
                    onChange={(e) => setLobbySettingsDraft((prev) => prev ? ({ ...prev, impostorsKnowEachOther: e.target.checked }) : prev)}
                  />{" "}
                  Impostorzy wiedza o sobie
                </label>
                <button
                  className="w-full rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600"
                  onClick={() =>
                    socket.emit("session:update-settings", {
                      hostSessionPlayerId: localPlayer?.sessionPlayerId,
                      code: state.code,
                      settings: lobbySettingsDraft
                    })
                  }
                >
                  Zapisz ustawienia lobby
                </button>
              </div>
            )}
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
            <p className="mb-4 text-2xl font-bold">{card?.category ?? state?.currentCategory ?? "-"}</p>
            {isCardReveal && card && !card.acknowledged && (
              <div className="rounded-xl bg-zinc-800 p-4">
                {!cardFlipped && (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-300">Najpierw odwroc fiszke, by zobaczyc role i haslo.</p>
                    <button className={commonBtn} onClick={() => setCardFlipped(true)}>
                      Odwroc fiszke
                    </button>
                  </div>
                )}
                {canShowCardFront && (
                  <div>
                    <p className="text-xl font-semibold">{card.isImpostor ? "Jestes IMPOSTOREM" : "Jestes UCZESTNIKIEM"}</p>
                    <p className="mt-2 text-lg">{card.isImpostor ? "Nie znasz hasla." : `Haslo: ${card.word}`}</p>
                    <div className="mt-4 border-t border-zinc-700 pt-3">
                      {card.isImpostor && card.hint && <p className="text-zinc-300">Podpowiedz: {card.hint}</p>}
                      {card.isImpostor && card.otherImpostors.length > 0 && (
                        <p className="mt-1 text-zinc-300">Inny impostor: {card.otherImpostors.map((o) => o.username).join(", ")}</p>
                      )}
                    </div>
                    <button
                      className={`${commonBtn} mt-3`}
                      onClick={() => {
                        setCard((prev) => (prev ? { ...prev, acknowledged: true } : prev));
                        socket.emit("card:acknowledge", { sessionPlayerId: localPlayer?.sessionPlayerId, code: state.code });
                      }}
                    >
                      Dalej
                    </button>
                  </div>
                )}
              </div>
            )}
            {(state.status !== "CARD_REVEAL" || card?.acknowledged) && (
              <div className="rounded-xl bg-zinc-800 p-4">
                {isWaitingForNextRound && (
                  <p className="text-sm text-zinc-300">Dolaczyles w trakcie rozgrywki. Oczekiwanie na kolejna runde.</p>
                )}
                {state.status === "CARD_REVEAL" && (
                  <p className="text-sm text-zinc-300">Oczekiwanie na wszystkich graczy...</p>
                )}
                {state.status === "DISCUSSION" && (
                  <p className="text-sm text-zinc-300">Gra w toku. Trwa rozmowa uczestnikow.</p>
                )}
                {state.status === "ROUND_RESULT" && roundResult && (
                  <div>
                    <p className="text-base font-semibold">{eliminatedName} wypada z gry.</p>
                    <p className="text-sm text-zinc-300">Rola: {eliminatedRoleLabel}</p>
                  </div>
                )}
                {state.status === "GAME_END" && gameResultView && (
                  <div>
                    <p className={`text-base font-semibold ${gameResultView === "WIN" ? "text-emerald-400" : "text-red-400"}`}>
                      {gameResultView === "WIN" ? "Rozgrywka wygrana." : "Rozgrywka przegrana."}
                    </p>
                    <p className="text-sm text-zinc-300">Oczekiwanie na mistrza gry.</p>
                  </div>
                )}
                {state.status !== "CARD_REVEAL" && state.status !== "DISCUSSION" && state.status !== "ROUND_RESULT" && state.status !== "GAME_END" && (
                  <p className="text-sm text-zinc-300">Czekaj na kolejny etap rundy.</p>
                )}
              </div>
            )}
            <div className="mt-4 rounded-lg border border-zinc-700 p-3">
              <p className="font-semibold">Glosowanie: {state.status === "VOTING" ? "Aktywne" : "Nieaktywne"}</p>
              {isEliminated ? (
                <p className="mt-2 text-sm text-red-300">Zostales wyrzucony w trakcie gry. Nie mozesz juz oddawac glosow.</p>
              ) : state.status === "VOTING" && (
                <div className="mt-2 flex gap-2">
                  {voteSubmitted ? (
                    <p className="text-sm text-zinc-300">Zaglosowano na: <span className="font-semibold text-zinc-100">{votedForName}</span></p>
                  ) : (
                    <>
                      <select className="flex-1 rounded-md bg-zinc-800 p-2" value={voteTarget} onChange={(e) => setVoteTarget(e.target.value)}>
                        <option value="">Wybierz gracza</option>
                        {state.players.filter((p) => !p.isEliminated && p.id !== localPlayer?.sessionPlayerId).map((p) => (
                          <option key={p.id} value={p.id}>{p.username}</option>
                        ))}
                      </select>
                      <button
                        className={commonBtn}
                        disabled={!voteTarget}
                        onClick={() => {
                          if (!voteTarget) return;
                          const targetName = state.players.find((p) => p.id === voteTarget)?.username ?? "Gracz";
                          socket.emit("vote:submit", { voterId: localPlayer?.sessionPlayerId, targetId: voteTarget, code: state.code });
                          setVoteSubmitted(true);
                          setVotedForName(targetName);
                        }}
                      >
                        Glosuj
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <aside className="rounded-xl border border-zinc-800 p-4">
            {isHost && (
              <div className="space-y-2">
                <button
                  className={`${canStartVoting ? commonBtn : disabledBtn} w-full`}
                  disabled={!canStartVoting}
                  onClick={() => socket.emit("vote:start", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}
                >
                  Uruchom glosowanie
                </button>
                <button
                  className={`${canFinalizeVoting ? commonBtn : disabledBtn} w-full`}
                  disabled={!canFinalizeVoting}
                  onClick={() => socket.emit("vote:finalize", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}
                >
                  Zakoncz glosowanie
                </button>
                {state?.status === "VOTING" && (
                  <p className="text-xs text-zinc-400">Oddane glosy: {state.votesSubmitted}/{state.votesRequired}</p>
                )}
                <button className={`${commonBtn} w-full`} onClick={() => socket.emit("round:next", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>Nastepna runda</button>
                <button className="w-full rounded-lg bg-zinc-700 px-4 py-2" onClick={() => socket.emit("game:reset", { hostSessionPlayerId: localPlayer?.sessionPlayerId, code: state.code })}>Powrot do lobby</button>
              </div>
            )}
            {card?.isImpostor && !isEliminated && (
              <>
                {impostorDiscovered || card.acknowledged ? (
                  <div className="mt-4 rounded-lg border border-red-700 p-3">
                    <p className="font-semibold text-red-300">Strzal impostora (raz na gre)</p>
                    <input
                      value={guess}
                      disabled={guessUsed}
                      onChange={(e) => setGuess(e.target.value)}
                      className="mt-2 w-full rounded-md bg-zinc-800 p-2 disabled:cursor-not-allowed disabled:bg-zinc-700"
                      placeholder="Wpisz haslo"
                    />
                    <button
                      disabled={guessUsed || !guess.trim()}
                      className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2 disabled:cursor-not-allowed disabled:bg-zinc-600"
                      onClick={() => socket.emit("impostor:guess", { sessionPlayerId: localPlayer?.sessionPlayerId, guessedWord: guess, code: state.code })}
                    >
                      Zgadnij
                    </button>
                    {guessUsed && <p className="mt-2 text-sm text-zinc-300">Wykorzystano juz strzal.</p>}
                  </div>
                ) : (
                  <></>
                )}
              </>
            )}
            {isEliminated && (
              <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3">
                <p className="font-semibold text-red-300">Zostales wyglosowany.</p>
                <p className="text-sm text-red-200">Nie mozesz juz glosowac ani wykonywac akcji w tej rundzie.</p>
              </div>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}

function CreateLobby(props: { onBack: () => void; onCreated: (v: LocalPlayer) => void }) {
  const [hostUsername, setHostUsername] = useState("");
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
            const fallbackName = hostUsername.trim() || `Gosc${Math.floor(1000 + Math.random() * 9000)}`;
            const out = await createSession({
              hostUsername: fallbackName,
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
            const fallbackName = username.trim() || `Gosc${Math.floor(1000 + Math.random() * 9000)}`;
            const out = await joinSession({ code, username: fallbackName });
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
