/** The date of tuble #1. */
export const LAUNCH_DATE = "2026-10-31";

/** Puzzles before this date were Tube only, and their answers are frozen that way. */
export const OVERGROUND_FROM = "2026-11-03";

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
