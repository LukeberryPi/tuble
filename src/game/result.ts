import type { AnswerResult } from "./api.ts";
import { answerShares, pointsFor, tierFor, type Counts } from "./score.ts";

export type ResultInput = {
  promptId: string;
  answers: string[];
  interchange: boolean;
  /** What this player answered. Null if they ran out of time. */
  stationId: string | null;
  /** How many players gave each answer today, including this player. Timeouts are counted under "". */
  counts: Counts;
  likelihood: (stationId: string) => number;
};

const LISTED = 3;

/** Scores an answer against everyone else's. */
export function resultFor(input: ResultInput): AnswerResult {
  const { promptId, answers, interchange, stationId, likelihood } = input;
  // Rarity is about other players, so leave this player's own answer out.
  const counts = { ...input.counts };
  const own = stationId ?? "";
  if ((counts[own] ?? 0) > 0) counts[own]! -= 1;

  const shares = answerShares(answers, counts, likelihood);
  const tier = tierFor(shares, stationId);
  const commonFirst = [...shares].map(([id, share]) => ({ id, share })).sort((a, b) => b.share - a.share);
  const top = commonFirst.slice(0, LISTED);
  const deepCuts = commonFirst
    .filter((answer) => answer.id !== stationId && !top.includes(answer))
    .slice(-LISTED)
    .reverse();

  return {
    promptId,
    stationId,
    correct: tier !== "lost-train",
    tier,
    points: pointsFor(tier, interchange),
    share: stationId !== null ? (shares.get(stationId) ?? null) : null,
    top,
    deepCuts,
    answerCount: answers.length,
    players: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}
