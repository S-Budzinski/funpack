import type { PlayerCard, PublicState } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export async function createSession(input: {
  hostUsername: string;
  impostorCount: number;
  selectedCategories: string[];
  hintEnabled: boolean;
  impostorsKnowEachOther: boolean;
}) {
  const res = await fetch(`${API_URL}/api/session/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error((await res.json()).message ?? "Create session failed");
  return res.json() as Promise<{ sessionId: string; sessionPlayerId: string; code: string }>;
}

export async function joinSession(input: { code: string; username: string }) {
  const res = await fetch(`${API_URL}/api/session/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error((await res.json()).message ?? "Join failed");
  return res.json() as Promise<{ sessionId: string; sessionPlayerId: string }>;
}

export async function getSessionState(code: string) {
  const res = await fetch(`${API_URL}/api/session/${code}/state`);
  if (!res.ok) throw new Error("State fetch failed");
  return res.json() as Promise<PublicState>;
}

export async function getPlayerCard(sessionPlayerId: string) {
  const res = await fetch(`${API_URL}/api/player/${sessionPlayerId}/card`);
  if (!res.ok) throw new Error("Card fetch failed");
  return res.json() as Promise<PlayerCard | null>;
}

export function getApiUrl() {
  return API_URL;
}
