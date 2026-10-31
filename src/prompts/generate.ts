import { TubeGraph } from "../graph.ts";
import type { Network } from "../network.ts";
import { FAMILIES } from "./families.ts";
import type { Candidate, Context, Difficulty, InterchangePrompt, Prompt } from "./types.ts";

export const LIMITS = {
  /** With fewer answers, a prompt is closer to trivia than to a rarity game. */
  minAnswers: 5,
  /** With more, a prompt barely narrows anything down. */
  maxAnswers: 100,
  /** Prompts sharing this much of their answers (shared ÷ combined) count as the same prompt. */
  maxOverlap: 0.8,
  /** How many of the busiest stations can anchor "near X" prompts. */
  landmarks: 40,
  interchange: {
    minAnswers: 3,
    maxAnswers: 12,
    /** Each half must cut the other's answers to at most this share, so both halves matter. */
    maxShareOfEither: 0.8,
  },
};

export type FamilyStats = {
  id: string;
  label: string;
  candidates: number;
  tooFew: number;
  tooMany: number;
  repeats: number;
  kept: number;
};

export type PromptBank = {
  prompts: Prompt[];
  interchange: InterchangePrompt[];
  families: FamilyStats[];
};

/** Shared answers ÷ combined answers: 1 means the same set, 0 means nothing in common. */
export function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const id of a) if (b.has(id)) shared++;
  return shared / (a.size + b.size - shared);
}

function isRepeat(earlier: Candidate, candidate: Candidate, familyMaxOverlap = LIMITS.maxOverlap): boolean {
  const limit = earlier.family === candidate.family ? familyMaxOverlap : LIMITS.maxOverlap;
  return overlap(earlier.answers, candidate.answers) >= limit;
}

function difficulty(answerCount: number): Difficulty {
  if (answerCount >= 30) return "easy";
  if (answerCount >= 12) return "medium";
  return "hard";
}

export function buildContext(network: Network): Context {
  return {
    graph: new TubeGraph(network),
    stations: network.stations,
    landmarks: [...network.stations].sort((a, b) => b.usage - a.usage).slice(0, LIMITS.landmarks),
    usageYear: network.usageYear,
  };
}

export function generatePromptBank(network: Network): PromptBank {
  const ctx = buildContext(network);

  // Usage rank stands in for "how likely players are to think of it" until real answers come in.
  // Stations with no figure for the year (0) sit in the middle: neither obvious nor quiet.
  const known = network.stations.filter((s) => s.usage > 0).sort((a, b) => b.usage - a.usage);
  const rank = new Map(known.map((station, i) => [station.id, i / known.length]));
  for (const station of network.stations) if (!rank.has(station.id)) rank.set(station.id, 0.4);
  const isObvious = (id: string) => rank.get(id)! < 0.25;
  const isQuiet = (id: string) => rank.get(id)! >= 0.5;
  const busiestFirst = (ids: Iterable<string>) => [...ids].sort((a, b) => rank.get(a)! - rank.get(b)!);

  const kept: Candidate[] = [];
  const families: FamilyStats[] = [];
  for (const family of FAMILIES) {
    const min = family.limits?.min ?? LIMITS.minAnswers;
    const max = family.limits?.max ?? LIMITS.maxAnswers;
    const stats: FamilyStats = { id: family.id, label: family.label, candidates: 0, tooFew: 0, tooMany: 0, repeats: 0, kept: 0 };
    for (const candidate of family.generate(ctx)) {
      stats.candidates++;
      if (candidate.answers.size < min) stats.tooFew++;
      else if (candidate.answers.size > max) stats.tooMany++;
      else if (kept.some((other) => isRepeat(other, candidate, family.maxOverlap))) stats.repeats++;
      else {
        kept.push(candidate);
        stats.kept++;
      }
    }
    families.push(stats);
  }

  const prompts: Prompt[] = kept.map((candidate) => {
    const answers = busiestFirst(candidate.answers);
    return {
      id: candidate.id,
      family: candidate.family,
      text: `Name a station ${candidate.fragment}`,
      answers,
      difficulty: difficulty(answers.length),
      spread: answers.some(isObvious) && answers.filter(isQuiet).length >= 2,
    };
  });

  return { prompts, interchange: interchangePrompts(kept, busiestFirst), families };
}

/**
 * Families that read badly together. "On the Northern line, at the very end of a line" sounds
 * like the Northern line's own ends, but would also accept Waterloo (the end of the Waterloo & City).
 */
const CLASHING_FAMILIES = [["line", "line-end"]];

const clash = (a: Candidate, b: Candidate) =>
  CLASHING_FAMILIES.some(([x, y]) => (a.family === x && b.family === y) || (a.family === y && b.family === x));

/** Pairs of simple prompts from different families whose shared answers make a good final round. */
function interchangePrompts(kept: Candidate[], busiestFirst: (ids: Iterable<string>) => string[]): InterchangePrompt[] {
  const { minAnswers, maxAnswers, maxShareOfEither } = LIMITS.interchange;
  const halves = kept.filter((candidate) => candidate.combinable);
  // Skip pairs that just repeat a regular prompt, like "on the Bakerloo line, in Zone 1".
  const seen = new Set(kept.map((candidate) => [...candidate.answers].sort().join()));
  const result: InterchangePrompt[] = [];

  halves.forEach((a, i) => {
    for (const b of halves.slice(i + 1)) {
      if (a.family === b.family || clash(a, b)) continue;
      const shared = [...a.answers].filter((id) => b.answers.has(id));
      if (shared.length < minAnswers || shared.length > maxAnswers) continue;
      if (shared.length > maxShareOfEither * Math.min(a.answers.size, b.answers.size)) continue;

      const key = [...shared].sort().join();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: `${a.id}&${b.id}`,
        parts: [a.id, b.id],
        text: `Name a station ${a.fragment}, ${b.fragment}`,
        answers: busiestFirst(shared),
      });
    }
  });
  return result;
}
