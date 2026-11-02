export type TierId = "rush-hour" | "off-peak" | "night-tube" | "ghost-station" | "lost-train";

export type Tier = {
  id: TierId;
  emoji: string;
  name: string;
  points: number;
  /** Explains the tier in the rules. */
  meaning: string;
};

export const TIERS: Record<TierId, Tier> = {
  "rush-hour": { id: "rush-hour", emoji: "🥵", name: "Rush Hour", points: 10, meaning: "One of the answers most people gave" },
  "off-peak": { id: "off-peak", emoji: "💺", name: "Off-Peak", points: 40, meaning: "Half of players said something more common" },
  "night-tube": { id: "night-tube", emoji: "🌙", name: "Night Tube", points: 70, meaning: "80% said something more common" },
  "ghost-station": { id: "ghost-station", emoji: "👻", name: "Ghost Station", points: 100, meaning: "95% said something more common" },
  // The id predates the name, and lives on in saved games and in pages that are already open.
  "lost-train": { id: "lost-train", emoji: "🏃", name: "Missed the Train", points: 0, meaning: "Out of time" },
};

/** Correct answers, by the share of players who gave a more common answer. Checked in order. */
const THRESHOLDS: [number, TierId][] = [
  [0.95, "ghost-station"],
  [0.8, "night-tube"],
  [0.5, "off-peak"],
  [0, "rush-hour"],
];

/** The Interchange round scores double. */
export function pointsFor(tier: TierId, interchange: boolean): number {
  return TIERS[tier].points * (interchange ? 2 : 1);
}

/**
 * How many players the passenger-number estimate counts as. The first players of the day get
 * a fair score from the estimate alone, and real answers take over once a few dozen people play.
 */
export const ESTIMATE_PLAYERS = 20;

/** How many players gave each answer. */
export type Counts = Record<string, number>;

/**
 * The share of players expected to give each correct answer: real answers so far,
 * topped up with an estimate of how likely people are to think of each station.
 */
export function answerShares(answers: string[], counts: Counts, likelihood: (stationId: string) => number): Map<string, number> {
  const players = answers.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
  const weights = answers.map((id) => likelihood(id));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return new Map(
    answers.map((id, i) => {
      const estimated = totalWeight > 0 ? (ESTIMATE_PLAYERS * weights[i]!) / totalWeight : ESTIMATE_PLAYERS / answers.length;
      return [id, ((counts[id] ?? 0) + estimated) / (players + ESTIMATE_PLAYERS)];
    }),
  );
}

/** The share of players who gave a more common answer than this station. */
export function shareMoreCommon(shares: Map<string, number>, stationId: string): number {
  const own = shares.get(stationId) ?? 0;
  let sum = 0;
  for (const share of shares.values()) if (share > own + 1e-9) sum += share;
  return sum;
}

/** Running out of time misses the train; correct answers score by how rare they are. */
export function tierFor(shares: Map<string, number>, stationId: string | null): TierId {
  if (stationId === null || !shares.has(stationId)) return "lost-train";
  const moreCommon = shareMoreCommon(shares, stationId);
  return THRESHOLDS.find(([min]) => moreCommon >= min)![1];
}

/**
 * How likely players are to think of each station, before anyone has played: busier stations
 * are better known. For "quietest stations" prompts it's the other way round, since the
 * quietest stations are the famous ones.
 */
export function likelihoodFor(promptId: string, usage: Map<string, number>): (stationId: string) => number {
  const known = [...usage.values()].filter((value) => value > 0).sort((a, b) => a - b);
  const median = known[Math.floor(known.length / 2)] ?? 1;
  const usageOf = (id: string) => usage.get(id) || median;
  if (promptId.includes("usage:quietest")) return (id) => 1 / usageOf(id);
  return usageOf;
}
