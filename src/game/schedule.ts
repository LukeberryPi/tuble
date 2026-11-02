import { LANDMARKS } from "../landmarks.ts";
import { LINES } from "../lines.ts";
import type { InterchangePrompt, Prompt } from "../prompts/types.ts";
import { addDays, daysBetween } from "./day.ts";

/**
 * One of a day's prompts, with its answers. Days carry their own copy, so regenerating the
 * prompt bank never changes a puzzle people have already played.
 */
export type DayPrompt = {
  id: string;
  text: string;
  /** What follows "Name a station". Interchange prompts have two. */
  conditions: string[];
  answers: string[];
};

export type ScheduleDay = {
  date: string;
  /** Regular prompts, most answers first. */
  prompts: DayPrompt[];
  interchange: DayPrompt;
};

export const REGULAR_PROMPTS_PER_DAY = 6;

/** Kinds of prompt. A day has at most two of each kind. */
const KINDS: Record<string, string> = {
  line: "lines",
  zone: "lines",
  "line-end": "lines",
  hub: "lines",
  "line-only": "lines",
  "line-pair": "lines",
  "line-zone": "lines",
  lexicon: "names",
  initial: "names",
  letter: "names",
  spelling: "names",
  word: "names",
  suffix: "names",
  river: "places",
  "outside-london": "places",
  borough: "places",
  compass: "places",
  "line-compass": "places",
  walk: "places",
  spacing: "places",
  stops: "journeys",
  between: "journeys",
  opened: "history",
  usage: "history",
};

const MAX_PER_KIND = 2;
/** A prompt isn't used again for this many days. */
const MIN_DAYS_BETWEEN_REPEATS = 28;
/** Each day has at least one prompt this big, so there's room to hunt for a rare answer. */
const BIG_PROMPT_ANSWERS = 12;
/** Interchange halves that are too obscure to combine against the clock. */
const OBSCURE_FAMILIES = new Set(["opened", "usage", "spelling", "spacing"]);
/** Interchange prompts with this many answers or more leave room for a rare one. */
const ROOMY_INTERCHANGE_ANSWERS = 4;

const LINE_IDS = new Set<string>(LINES.map((line) => line.id));
const LANDMARK_IDS = new Set(LANDMARKS.map((landmark) => landmark.id));

/**
 * What a prompt is about, from its id: lines, stations, landmarks and zones.
 * "between:central:bond-street:liverpool-street" -> line:central, station:bond-street, station:liverpool-street.
 */
export function subjects(promptId: string, stationIds: Set<string>): string[] {
  const [family, ...rest] = promptId.split(":");
  const tokens = rest.flatMap((token) => token.split("+"));
  const result: string[] = [];
  for (const token of tokens) {
    if (LINE_IDS.has(token)) result.push(`line:${token}`);
    else if (stationIds.has(token)) result.push(`station:${token}`);
    else if (LANDMARK_IDS.has(token)) result.push(`landmark:${token}`);
  }
  if (family === "zone") result.push(`zone:${rest[0]}`);
  if (family === "line-zone") result.push(`zone:${rest[1]}`);
  return result;
}

/** A small seeded random number generator (mulberry32), so the schedule is the same every build. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffles so that items with a higher weight tend to come first. */
function weightedShuffle<T>(items: T[], weight: (item: T) => number, random: () => number): T[] {
  return items
    .map((item) => ({ item, key: random() ** (1 / weight(item)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

export type ScheduleOptions = {
  /** Days that have been played. They're kept as they are, and new days follow on from the last. */
  history: ScheduleDay[];
  /** The first day, if there's no history. */
  start: string;
  /** How many new days to add. */
  days: number;
  seed: number;
  stationIds: Set<string>;
};

const dayPrompt = ({ id, text, conditions, answers }: Prompt | InterchangePrompt): DayPrompt => ({ id, text, conditions, answers });

export function buildSchedule(bank: { prompts: Prompt[]; interchange: InterchangePrompt[] }, options: ScheduleOptions): ScheduleDay[] {
  const { history, days, stationIds } = options;
  const start = history.length > 0 ? addDays(history.at(-1)!.date, 1) : options.start;
  const random = seededRandom(options.seed);
  const promptsById = new Map(bank.prompts.map((prompt) => [prompt.id, prompt]));
  const subjectsOf = new Map(bank.prompts.map((prompt) => [prompt.id, subjects(prompt.id, stationIds)]));
  const lastUsed = new Map<string, number>();
  const usedInterchange = new Set<string>();
  for (const past of history) {
    for (const prompt of past.prompts) lastUsed.set(prompt.id, daysBetween(start, past.date));
    usedInterchange.add(past.interchange.id);
  }
  const queue: Prompt[] = [];
  const schedule: ScheduleDay[] = [...history];

  const refill = () => {
    const queued = new Set(queue);
    // Prompts with a good spread of obvious and obscure answers are the most fun, so they tend to come first.
    queue.push(...weightedShuffle(bank.prompts.filter((prompt) => !queued.has(prompt)), (prompt) => (prompt.spread ? 2 : 1), random));
  };

  const interchangeOrder = weightedShuffle(
    bank.interchange,
    (prompt) => (prompt.answers.length >= ROOMY_INTERCHANGE_ANSWERS ? 2 : 1),
    random,
  );

  for (let day = 0; day < days; day++) {
    const date = addDays(start, day);
    if (queue.length < 150) refill();
    const chosen = pickDay(queue, { lastUsed, day, subjectsOf });
    const interchange = pickInterchange(interchangeOrder, chosen, { usedInterchange, subjectsOf, promptsById });

    if (chosen.length !== REGULAR_PROMPTS_PER_DAY) throw new Error(`Couldn't fill ${date}`);
    if (!interchange) throw new Error(`No Interchange prompt for ${date}`);

    for (const prompt of chosen) {
      lastUsed.set(prompt.id, day);
      const index = queue.indexOf(prompt);
      if (index >= 0) queue.splice(index, 1);
    }
    usedInterchange.add(interchange.id);
    schedule.push({
      date,
      prompts: [...chosen].sort((a, b) => b.answers.length - a.answers.length).map(dayPrompt),
      interchange: dayPrompt(interchange),
    });
  }
  return schedule;
}

type DayState = { lastUsed: Map<string, number>; day: number; subjectsOf: Map<string, string[]> };

/** Takes prompts from the front of the queue that make a varied day, relaxing the rules if it has to. */
function pickDay(queue: Prompt[], { lastUsed, day, subjectsOf }: DayState): Prompt[] {
  const isRecent = (prompt: Prompt) => day - (lastUsed.get(prompt.id) ?? -Infinity) < MIN_DAYS_BETWEEN_REPEATS;
  const isBig = (prompt: Prompt) => prompt.answers.length >= BIG_PROMPT_ANSWERS;

  for (const strict of [true, false]) {
    const chosen: Prompt[] = [];
    for (const prompt of queue) {
      if (chosen.length === REGULAR_PROMPTS_PER_DAY) break;
      if (isRecent(prompt)) continue;
      if (chosen.some((other) => other.family === prompt.family)) continue;
      if (strict) {
        const kind = KINDS[prompt.family] ?? prompt.family;
        if (chosen.filter((other) => (KINDS[other.family] ?? other.family) === kind).length >= MAX_PER_KIND) continue;
        const mine = subjectsOf.get(prompt.id)!;
        if (chosen.some((other) => subjectsOf.get(other.id)!.some((subject) => mine.includes(subject)))) continue;
        if (chosen.length === REGULAR_PROMPTS_PER_DAY - 1 && !chosen.some(isBig) && !isBig(prompt)) continue;
      }
      chosen.push(prompt);
    }
    if (chosen.length === REGULAR_PROMPTS_PER_DAY) return chosen;
  }
  return [];
}

type InterchangeState = {
  usedInterchange: Set<string>;
  subjectsOf: Map<string, string[]>;
  promptsById: Map<string, Prompt>;
};

/** The first unused Interchange prompt that doesn't repeat anything from the day's regular prompts. */
function pickInterchange(order: InterchangePrompt[], chosen: Prompt[], state: InterchangeState): InterchangePrompt | undefined {
  const { usedInterchange, subjectsOf, promptsById } = state;
  const todaysIds = new Set(chosen.map((prompt) => prompt.id));
  const todaysSubjects = new Set(chosen.flatMap((prompt) => subjectsOf.get(prompt.id)!));
  const fits = (prompt: InterchangePrompt, allowRepeats: boolean) =>
    (allowRepeats || !usedInterchange.has(prompt.id)) &&
    prompt.parts.every((part) => !todaysIds.has(part) && !OBSCURE_FAMILIES.has(promptsById.get(part)!.family)) &&
    !prompt.parts.some((part) => subjectsOf.get(part)!.some((subject) => todaysSubjects.has(subject)));
  return order.find((prompt) => fits(prompt, false)) ?? order.find((prompt) => fits(prompt, true));
}

/** The day's entry. After the end of the schedule, it starts again from the top. */
export function scheduleFor(schedule: ScheduleDay[], date: string): ScheduleDay {
  const index = daysBetween(schedule[0]!.date, date);
  const wrapped = ((index % schedule.length) + schedule.length) % schedule.length;
  return schedule[wrapped]!;
}
