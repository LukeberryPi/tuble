import type { TierId } from "./score.ts";

/** GET /api/today */
export type TodayResponse = {
  date: string;
  number: number;
  prompts: TodayPrompt[];
  /** Whether Overground stations count. When they don't, they're among `otherStations`. */
  overground: boolean;
  stations: { id: string; name: string; lines: string[] }[];
  /** Stations on other railways, so the game can tell players East Croydon isn't one of ours. */
  otherStations: string[];
};

export type TodayPrompt = {
  id: string;
  /** "Name a station on the Central line, in Zone 1" */
  text: string;
  /** What follows "Name a station": ["on the Central line", "in Zone 1"]. Interchange prompts have two. */
  conditions: string[];
  interchange: boolean;
  answerCount: number;
};

/**
 * POST /api/answer. A station that doesn't fit gets a 422 and isn't recorded, so the player can
 * guess again, unless the time is up: then it counts as a miss, like a null station.
 */
export type AnswerRequest = {
  date: string;
  promptId: string;
  stationId: string | null;
  player: string;
  timeUp: boolean;
  /** Playing the day again: scored like any answer, but not recorded. */
  replay?: boolean;
};

export type AnswerShare = { id: string; share: number };

export type AnswerResult = {
  promptId: string;
  stationId: string | null;
  correct: boolean;
  tier: TierId;
  points: number;
  /** The share of other players who gave the same answer, if it was correct. */
  share: number | null;
  /** The answers most players gave. */
  top: AnswerShare[];
  /** Rare answers that would have been a Ghost Station or close to it. */
  deepCuts: AnswerShare[];
  answerCount: number;
  /** Players who have answered this prompt today, not counting this player. */
  players: number;
};
