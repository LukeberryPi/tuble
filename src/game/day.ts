import { modeOf, type Mode } from "../lines.ts";

/** The date of tuble #1. */
export const LAUNCH_DATE = "2026-10-31";

/**
 * When each kind of railway joined the game. Earlier puzzles are frozen without it: the first
 * three days were Tube only, and the Elizabeth line, DLR and trams came three days after the Overground.
 */
export const MODES_FROM: Record<Mode, string> = {
  tube: LAUNCH_DATE,
  overground: "2026-11-03",
  elizabeth: "2026-11-06",
  dlr: "2026-11-06",
  tram: "2026-11-06",
};

/** The kinds of railway whose stations count on this day. */
export function modesOn(date: string): Mode[] {
  return (Object.keys(MODES_FROM) as Mode[]).filter((mode) => date >= MODES_FROM[mode]);
}

type DayStation = { id: string; name: string; lines: string[] };

/**
 * Splits stations into those that count on this day, with only that day's lines, and the names
 * of the rest: "Manor Park isn't on the Tube or the Overground" before the Elizabeth line joined.
 */
export function stationsOn(date: string, all: DayStation[]): { stations: DayStation[]; elsewhere: string[] } {
  const modes = modesOn(date);
  const stations: DayStation[] = [];
  const elsewhere: string[] = [];
  for (const { id, name, lines } of all) {
    const todays = lines.filter((line) => modes.includes(modeOf(line)!));
    if (todays.length > 0) stations.push({ id, name, lines: todays });
    else elsewhere.push(name);
  }
  return { stations, elsewhere };
}

/**
 * Passenger counts from before the Elizabeth line, DLR and trams joined, for stations whose new
 * platforms TfL counts separately. Puzzles already played keep scoring with these.
 */
const USAGE_BEFORE: Record<string, number> = {
  "canary-wharf": 33.18,
  "heathrow-terminal-4": 1.72,
  "heathrow-terminal-5": 4.1,
  "heathrow-terminals-2-and-3": 6.04,
  "liverpool-street": 77.58,
  shadwell: 3.68,
};

/** Each counting station's passenger count, as that day's puzzle was scored. */
export function usageOn(date: string, all: (DayStation & { usage: number })[]): Map<string, number> {
  const counting = new Set(stationsOn(date, all).stations.map((station) => station.id));
  const before = date < MODES_FROM.elizabeth;
  return new Map(
    all.filter((station) => counting.has(station.id)).map(({ id, usage }) => [id, before ? (USAGE_BEFORE[id] ?? usage) : usage]),
  );
}

/** A new puzzle starts at midnight in London. */
const TIME_ZONE = "Europe/London";

const DAY_MS = 86_400_000;

function londonParts(now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Today's date in London, as YYYY-MM-DD. */
export function londonDate(now = new Date()): string {
  const { year, month, day } = londonParts(now);
  return `${year}-${month}-${day}`;
}

/** Milliseconds until the next puzzle, at London midnight. */
export function msUntilNextPuzzle(now = new Date()): number {
  const { hour, minute, second } = londonParts(now);
  const elapsed = (Number(hour) * 3600 + Number(minute) * 60 + Number(second)) * 1000 + now.getMilliseconds();
  return DAY_MS - elapsed;
}

/** Whole days from one YYYY-MM-DD date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** tuble #1 was on the launch date. */
export function puzzleNumber(date: string): number {
  return daysBetween(LAUNCH_DATE, date) + 1;
}
