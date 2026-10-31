import type { TubeGraph } from "../graph.ts";
import type { Station } from "../network.ts";

/** A possible prompt, before checking it has a good number of answers and isn't a repeat. */
export type Candidate = {
  /** Stable id, e.g. "line:central" or "stops:2:oxford-circus". */
  id: string;
  family: string;
  /** Completes "Name a station …", e.g. "on the Central line". */
  fragment: string;
  answers: Set<string>;
  /** Simple enough to be one half of an Interchange prompt. */
  combinable: boolean;
};

export type Context = {
  graph: TubeGraph;
  stations: Station[];
  /** The busiest stations, busiest first. Used as anchors for "near X" prompts. */
  landmarks: Station[];
  /** The year the usage figures are for. */
  usageYear: number;
};

export type Family = {
  id: string;
  /** Heading in the prompt bank report. */
  label: string;
  /** Overrides the general answer-count limits, e.g. "contains the letter Q" only works for rare letters. */
  limits?: { min?: number; max?: number };
  /**
   * How much two prompts from this family may share. Lower for families whose prompts are
   * near copies of each other, like "within 1 km of X" across central London.
   */
  maxOverlap?: number;
  generate: (ctx: Context) => Candidate[];
};

export type Difficulty = "easy" | "medium" | "hard";

export type Prompt = {
  id: string;
  family: string;
  text: string;
  /** Station ids, busiest first: roughly the order players will think of them. */
  answers: string[];
  difficulty: Difficulty;
  /**
   * Has at least one obvious answer and at least two quiet stations, so rarity scoring
   * has room to work: anyone can score, and experts can hunt for a Ghost Station.
   */
  spread: boolean;
};

/** Two prompts at once, for the double-points final round. */
export type InterchangePrompt = {
  id: string;
  parts: [string, string];
  text: string;
  answers: string[];
};
