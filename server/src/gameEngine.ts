import { Category, SessionStatus } from "@prisma/client";
import { prisma } from "./db.js";
import type { PublicState, SessionConfigInput } from "./types.js";

const ALL_CATEGORIES: Category[] = [
  Category.SPORT,
  Category.ZWIERZETA,
  Category.JEDZENIE,
  Category.MIEJSCE,
  Category.ZAWOD,
  Category.WYDARZENIE
];

const DEFAULT_STATE = {
  votesOpen: false,
  gameEnded: false,
  winner: null as PublicState["winner"],
  eliminatedPlayerId: null as string | null,
  eliminatedWasImpostor: null as boolean | null,
  revealImpostors: null as PublicState["revealImpostors"]
};

function randomCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeCategories(selected: Category[]) {
  const unique = Array.from(new Set(selected));
  return unique.length ? unique : ALL_CATEGORIES;
}

function toAsciiLower(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function createGuestName() {
  return `Gosc${Math.floor(1000 + Math.random() * 9000)}`;
}

async function ensureUniqueUsernameInSession(sessionId: string, requested: string) {
  const normalized = requested.trim() || createGuestName();
  const existing = await prisma.sessionPlayer.findFirst({
    where: {
      sessionId,
      user: {
        username: {
          equals: normalized,
          mode: "insensitive"
        }
      }
    }
  });
  if (existing) {
    throw new Error("Uzytkownik o tej nazwie juz jest w grze.");
  }
  return normalized;
}

function sanitizeLobbySettings(input: {
  impostorCount: number;
  selectedCategories: Category[];
  hintEnabled: boolean;
  impostorsKnowEachOther: boolean;
}) {
  return {
    impostorCount: Math.max(1, Math.min(3, input.impostorCount)),
    selectedCategories: normalizeCategories(input.selectedCategories),
    hintEnabled: input.hintEnabled,
    impostorsKnowEachOther: input.impostorsKnowEachOther
  };
}

export async function createSession(config: SessionConfigInput) {
  const code = randomCode();
  const categories = normalizeCategories(config.selectedCategories);
  const hostName = config.hostUsername.trim() || createGuestName();
  const hostUser = await prisma.user.create({ data: { username: hostName } });
  const session = await prisma.session.create({
    data: {
      code,
      impostorCount: config.impostorCount,
      selectedCategories: categories,
      hintEnabled: config.hintEnabled,
      impostorsKnowEachOther: config.impostorsKnowEachOther
    }
  });
  const hostSessionPlayer = await prisma.sessionPlayer.create({
    data: {
      sessionId: session.id,
      userId: hostUser.id,
      isHost: true
    }
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { hostSessionPlayerId: hostSessionPlayer.id }
  });
  return { sessionId: session.id, sessionPlayerId: hostSessionPlayer.id, code };
}

export async function joinSession(code: string, username: string) {
  const session = await prisma.session.findUnique({ where: { code } });
  if (!session) throw new Error("Session not found.");
  if (session.status !== SessionStatus.LOBBY) throw new Error("Game already started.");
  const finalUsername = await ensureUniqueUsernameInSession(session.id, username);
  const user = await prisma.user.create({ data: { username: finalUsername } });
  const sessionPlayer = await prisma.sessionPlayer.create({
    data: { sessionId: session.id, userId: user.id }
  });
  return { sessionId: session.id, sessionPlayerId: sessionPlayer.id };
}

export async function removePlayer(hostSessionPlayerId: string, targetSessionPlayerId: string) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host can kick players.");
  if (host.id === targetSessionPlayerId) throw new Error("Host cannot kick self.");
  await prisma.sessionPlayer.delete({ where: { id: targetSessionPlayerId } });
}

export async function updateLobbySettings(hostSessionPlayerId: string, input: {
  impostorCount: number;
  selectedCategories: Category[];
  hintEnabled: boolean;
  impostorsKnowEachOther: boolean;
}) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host can update settings.");
  if (host.session.status !== SessionStatus.LOBBY) throw new Error("Settings can be updated only in lobby.");
  const settings = sanitizeLobbySettings(input);
  await prisma.session.update({
    where: { id: host.sessionId },
    data: settings
  });
}

export async function leaveSession(sessionPlayerId: string) {
  const player = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: { session: true }
  });
  if (!player) return null;

  const sessionId = player.sessionId;
  const code = player.session.code;
  const wasHost = player.isHost;

  await prisma.sessionPlayer.delete({ where: { id: sessionPlayerId } });

  const remainingPlayers = await prisma.sessionPlayer.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" }
  });

  if (remainingPlayers.length === 0) {
    await prisma.session.delete({ where: { id: sessionId } });
    return { code, deleted: true };
  }

  if (wasHost) {
    const nextHost = remainingPlayers[0];
    await prisma.sessionPlayer.update({
      where: { id: nextHost.id },
      data: { isHost: true }
    });
    await prisma.session.update({
      where: { id: sessionId },
      data: { hostSessionPlayerId: nextHost.id }
    });
  }

  return { code, deleted: false };
}

export async function startGame(hostSessionPlayerId: string) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host can start game.");
  const players = await prisma.sessionPlayer.findMany({ where: { sessionId: host.sessionId }, include: { user: true } });
  if (players.length < 3) throw new Error("At least 3 players required.");
  const category = pickRandom(host.session.selectedCategories.length ? host.session.selectedCategories : ALL_CATEGORIES);
  const words = await prisma.wordBank.findMany({ where: { category } });
  if (!words.length) throw new Error("No words in selected category.");
  const selected = pickRandom(words);
  const round = await prisma.round.create({
    data: {
      sessionId: host.sessionId,
      roundNumber: 1,
      phase: SessionStatus.CARD_REVEAL
    }
  });
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const impostorIds = new Set(shuffled.slice(0, host.session.impostorCount).map((p) => p.id));
  for (const p of players) {
    await prisma.playerRole.create({
      data: {
        roundId: round.id,
        sessionPlayerId: p.id,
        isImpostor: impostorIds.has(p.id)
      }
    });
    await prisma.sessionPlayer.update({
      where: { id: p.id },
      data: { isEliminated: false, guessedThisGame: false }
    });
  }
  await prisma.session.update({
    where: { id: host.sessionId },
    data: {
      status: SessionStatus.CARD_REVEAL,
      currentCategory: category,
      currentWord: selected.phrase,
      currentHint: selected.hint
    }
  });
}

export async function acknowledgeCard(sessionPlayerId: string) {
  const player = await prisma.sessionPlayer.findUnique({ where: { id: sessionPlayerId }, include: { session: true } });
  if (!player) throw new Error("Player not found.");
  const round = await prisma.round.findFirst({
    where: { sessionId: player.sessionId },
    orderBy: { roundNumber: "desc" }
  });
  if (!round) throw new Error("Round missing.");
  await prisma.playerRole.update({
    where: { roundId_sessionPlayerId: { roundId: round.id, sessionPlayerId } },
    data: { acknowledged: true }
  });
  const pending = await prisma.playerRole.count({ where: { roundId: round.id, acknowledged: false } });
  if (pending === 0) {
    await prisma.round.update({ where: { id: round.id }, data: { phase: SessionStatus.DISCUSSION } });
    await prisma.session.update({ where: { id: player.sessionId }, data: { status: SessionStatus.DISCUSSION } });
  }
}

export async function openVoting(hostSessionPlayerId: string) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host can open voting.");
  await prisma.session.update({ where: { id: host.sessionId }, data: { status: SessionStatus.VOTING } });
  const round = await prisma.round.findFirst({ where: { sessionId: host.sessionId }, orderBy: { roundNumber: "desc" } });
  if (round) await prisma.round.update({ where: { id: round.id }, data: { phase: SessionStatus.VOTING } });
}

export async function submitVote(voterId: string, targetId: string) {
  const voter = await prisma.sessionPlayer.findUnique({ where: { id: voterId } });
  if (!voter || voter.isEliminated) throw new Error("Voter not allowed.");
  const round = await prisma.round.findFirst({ where: { sessionId: voter.sessionId }, orderBy: { roundNumber: "desc" } });
  if (!round) throw new Error("Round missing.");
  if (voterId === targetId) throw new Error("Nie mozesz zaglosowac na siebie.");
  const target = await prisma.sessionPlayer.findUnique({ where: { id: targetId } });
  if (!target || target.sessionId !== voter.sessionId || target.isEliminated) throw new Error("Nieprawidlowy cel glosowania.");
  await prisma.vote.upsert({
    where: { roundId_voterId: { roundId: round.id, voterId } },
    update: { targetId },
    create: { roundId: round.id, voterId, targetId }
  });
}

export async function finalizeVoting(hostSessionPlayerId: string) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host can finalize voting.");
  const round = await prisma.round.findFirst({ where: { sessionId: host.sessionId }, orderBy: { roundNumber: "desc" } });
  if (!round) throw new Error("Round missing.");
  const eligibleRoles = await prisma.playerRole.findMany({
    where: { roundId: round.id },
    include: { sessionPlayer: true }
  });
  const alive = eligibleRoles.map((r) => r.sessionPlayer).filter((p) => !p.isEliminated);
  const votes = await prisma.vote.findMany({ where: { roundId: round.id } });
  const votedIds = new Set(votes.map((v) => v.voterId));
  const missingVoters = alive.filter((p) => !votedIds.has(p.id)).map((p) => p.id);
  if (missingVoters.length > 0) {
    const missingUsers = await prisma.sessionPlayer.findMany({
      where: { id: { in: missingVoters } },
      include: { user: true }
    });
    const names = missingUsers.map((p) => p.user.username).join(", ");
    throw new Error(`Nie wszystkie glosy zostaly oddane. Brakuje: ${names}`);
  }

  const countMap = new Map<string, number>();
  for (const vote of votes) countMap.set(vote.targetId, (countMap.get(vote.targetId) ?? 0) + 1);
  const [eliminatedPlayerId] = [...countMap.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!eliminatedPlayerId) throw new Error("No vote result.");

  await prisma.sessionPlayer.update({ where: { id: eliminatedPlayerId }, data: { isEliminated: true } });
  const role = await prisma.playerRole.findUnique({
    where: { roundId_sessionPlayerId: { roundId: round.id, sessionPlayerId: eliminatedPlayerId } }
  });

  const winner = await evaluateWinner(host.sessionId, round.id);
  await prisma.session.update({
    where: { id: host.sessionId },
    data: { status: winner ? SessionStatus.GAME_END : SessionStatus.ROUND_RESULT }
  });
  await prisma.round.update({
    where: { id: round.id },
    data: { phase: winner ? SessionStatus.GAME_END : SessionStatus.ROUND_RESULT, endedAt: winner ? new Date() : null }
  });

  return { eliminatedPlayerId, eliminatedWasImpostor: Boolean(role?.isImpostor), winner };
}

async function evaluateWinner(sessionId: string, roundId: string): Promise<PublicState["winner"]> {
  const alive = await prisma.sessionPlayer.findMany({ where: { sessionId, isEliminated: false } });
  const roles = await prisma.playerRole.findMany({ where: { roundId, sessionPlayerId: { in: alive.map((p) => p.id) } } });
  const aliveImpostors = roles.filter((r) => r.isImpostor).length;
  const aliveCivilians = roles.length - aliveImpostors;
  if (aliveImpostors === 0) return "CIVILIANS";
  if (aliveImpostors >= aliveCivilians) return "IMPOSTORS";
  return null;
}

export async function impostorGuess(sessionPlayerId: string, guessedWord: string) {
  const player = await prisma.sessionPlayer.findUnique({ where: { id: sessionPlayerId }, include: { session: true } });
  if (!player) throw new Error("Player not found.");
  if (player.guessedThisGame) return { isCorrect: false, alreadyUsed: true };
  const round = await prisma.round.findFirst({ where: { sessionId: player.sessionId }, orderBy: { roundNumber: "desc" } });
  if (!round) throw new Error("Round missing.");
  const role = await prisma.playerRole.findUnique({
    where: { roundId_sessionPlayerId: { roundId: round.id, sessionPlayerId } }
  });
  if (!role?.isImpostor) throw new Error("Only impostor can guess.");
  const isCorrect = toAsciiLower(player.session.currentWord ?? "") === toAsciiLower(guessedWord);
  await prisma.guess.create({
    data: { roundId: round.id, sessionPlayerId, guessedWord, isCorrect }
  });
  await prisma.sessionPlayer.update({ where: { id: sessionPlayerId }, data: { guessedThisGame: true } });
  if (isCorrect) {
    await prisma.session.update({ where: { id: player.sessionId }, data: { status: SessionStatus.GAME_END } });
    await prisma.round.update({ where: { id: round.id }, data: { phase: SessionStatus.GAME_END, endedAt: new Date() } });
  }
  return { isCorrect, alreadyUsed: false };
}

export async function nextRound(hostSessionPlayerId: string) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host.");
  const lastRound = await prisma.round.findFirst({ where: { sessionId: host.sessionId }, orderBy: { roundNumber: "desc" } });
  if (!lastRound) throw new Error("Round missing.");
  const category = pickRandom(host.session.selectedCategories.length ? host.session.selectedCategories : ALL_CATEGORIES);
  const words = await prisma.wordBank.findMany({ where: { category } });
  const selected = pickRandom(words);
  const round = await prisma.round.create({
    data: { sessionId: host.sessionId, roundNumber: lastRound.roundNumber + 1, phase: SessionStatus.CARD_REVEAL }
  });
  await prisma.sessionPlayer.updateMany({
    where: { sessionId: host.sessionId },
    data: { isEliminated: false, guessedThisGame: false }
  });
  const allPlayers = await prisma.sessionPlayer.findMany({ where: { sessionId: host.sessionId } });
  const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
  const impostorIds = new Set(shuffled.slice(0, host.session.impostorCount).map((p) => p.id));
  for (const p of allPlayers) {
    await prisma.playerRole.create({
      data: { roundId: round.id, sessionPlayerId: p.id, isImpostor: impostorIds.has(p.id) }
    });
  }
  await prisma.session.update({
    where: { id: host.sessionId },
    data: {
      status: SessionStatus.CARD_REVEAL,
      currentCategory: category,
      currentWord: selected.phrase,
      currentHint: selected.hint
    }
  });
}

export async function resetGame(hostSessionPlayerId: string) {
  const host = await prisma.sessionPlayer.findUnique({ where: { id: hostSessionPlayerId }, include: { session: true } });
  if (!host || !host.isHost) throw new Error("Only host.");
  await prisma.session.update({
    where: { id: host.sessionId },
    data: { status: SessionStatus.LOBBY, currentWord: null, currentHint: null, currentCategory: null }
  });
  await prisma.sessionPlayer.updateMany({
    where: { sessionId: host.sessionId },
    data: { isEliminated: false, guessedThisGame: false }
  });
}

export async function getPrivateCard(sessionPlayerId: string) {
  const sessionPlayer = await prisma.sessionPlayer.findUnique({
    where: { id: sessionPlayerId },
    include: { session: true, user: true }
  });
  if (!sessionPlayer) throw new Error("Player missing.");
  const round = await prisma.round.findFirst({ where: { sessionId: sessionPlayer.sessionId }, orderBy: { roundNumber: "desc" } });
  if (!round) return null;
  const role = await prisma.playerRole.findUnique({
    where: { roundId_sessionPlayerId: { roundId: round.id, sessionPlayerId } }
  });
  if (!role) return null;
  const allRoles = await prisma.playerRole.findMany({ where: { roundId: round.id }, include: { sessionPlayer: { include: { user: true } } } });
  const otherImpostors = allRoles
    .filter((r) => r.isImpostor && r.sessionPlayerId !== sessionPlayerId)
    .map((r) => ({ id: r.sessionPlayerId, username: r.sessionPlayer.user.username }));
  return {
    username: sessionPlayer.user.username,
    isImpostor: role.isImpostor,
    category: sessionPlayer.session.currentCategory,
    word: role.isImpostor ? null : sessionPlayer.session.currentWord,
    hint: role.isImpostor && sessionPlayer.session.hintEnabled ? sessionPlayer.session.currentHint : null,
    otherImpostors: role.isImpostor && sessionPlayer.session.impostorsKnowEachOther ? otherImpostors : [],
    acknowledged: role.acknowledged
  };
}

export async function getPublicStateByCode(code: string): Promise<PublicState> {
  const session = await prisma.session.findUnique({
    where: { code },
    include: { sessionPlayers: { include: { user: true } }, rounds: { orderBy: { roundNumber: "desc" }, take: 1 } }
  });
  if (!session) throw new Error("Session not found.");
  return {
    sessionId: session.id,
    code: session.code,
    status: session.status,
    hostSessionPlayerId: session.hostSessionPlayerId,
    impostorCount: session.impostorCount,
    selectedCategories: session.selectedCategories,
    hintEnabled: session.hintEnabled,
    impostorsKnowEachOther: session.impostorsKnowEachOther,
    currentCategory: session.currentCategory,
    players: session.sessionPlayers.map((p) => ({
      id: p.id,
      username: p.user.username,
      isHost: p.isHost,
      isEliminated: p.isEliminated
    })),
    roundNumber: session.rounds[0]?.roundNumber ?? 0,
    ...DEFAULT_STATE
  };
}
