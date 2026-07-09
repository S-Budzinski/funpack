import type { Category, SessionStatus } from "@prisma/client";

export type PublicPlayer = {
  id: string;
  username: string;
  isHost: boolean;
  isEliminated: boolean;
};

export type PublicState = {
  sessionId: string;
  code: string;
  status: SessionStatus;
  hostSessionPlayerId: string | null;
  impostorCount: number;
  selectedCategories: Category[];
  hintEnabled: boolean;
  impostorsKnowEachOther: boolean;
  currentCategory: Category | null;
  players: PublicPlayer[];
  roundNumber: number;
  votesOpen: boolean;
  gameEnded: boolean;
  winner: "CIVILIANS" | "IMPOSTORS" | null;
  eliminatedPlayerId: string | null;
  eliminatedWasImpostor: boolean | null;
  revealImpostors: Array<{ id: string; username: string }> | null;
  votesSubmitted: number;
  votesRequired: number;
};

export type SessionConfigInput = {
  hostUsername: string;
  impostorCount: number;
  selectedCategories: Category[];
  hintEnabled: boolean;
  impostorsKnowEachOther: boolean;
};
