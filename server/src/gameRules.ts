export function resolveWinner(aliveImpostors: number, aliveCivilians: number) {
  if (aliveImpostors <= 0) return "CIVILIANS";
  if (aliveImpostors >= aliveCivilians) return "IMPOSTORS";
  return null;
}

export function canStart(playersCount: number) {
  return playersCount >= 3;
}
