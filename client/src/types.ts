export type Category = "SPORT" | "ZWIERZETA" | "JEDZENIE" | "MIEJSCE" | "ZAWOD" | "WYDARZENIE";
export type SessionStatus = "LOBBY" | "CARD_REVEAL" | "DISCUSSION" | "VOTING" | "ROUND_RESULT" | "GAME_END";

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
  players: { id: string; username: string; isHost: boolean; isEliminated: boolean }[];
  roundNumber: number;
  votesSubmitted: number;
  votesRequired: number;
};

export type PlayerCard = {
  username: string;
  isImpostor: boolean;
  category: Category | null;
  word: string | null;
  hint: string | null;
  otherImpostors: { id: string; username: string }[];
  acknowledged: boolean;
};
