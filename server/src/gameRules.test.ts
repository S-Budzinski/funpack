import { describe, expect, it } from "vitest";
import { canStart, resolveWinner } from "./gameRules.js";

describe("game rules", () => {
  it("returns civilians when no impostors alive", () => {
    expect(resolveWinner(0, 3)).toBe("CIVILIANS");
  });

  it("returns impostors when they have parity", () => {
    expect(resolveWinner(2, 2)).toBe("IMPOSTORS");
  });

  it("returns null when game continues", () => {
    expect(resolveWinner(1, 3)).toBeNull();
  });

  it("requires at least 3 players", () => {
    expect(canStart(2)).toBe(false);
    expect(canStart(3)).toBe(true);
  });
});
