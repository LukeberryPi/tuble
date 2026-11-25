import { addDays, londonDateTime } from "./day.ts";

/** TfL's page listing planned strikes. It has no API, so the worker reads the page itself. */
export const STRIKES_URL = "https://tfl.gov.uk/status-updates/strikes";

/** A planned strike, in London time as YYYY-MM-DDTHH:MM. */
export type Strike = {
  start: string;
  end: string;
  /** As TfL wrote it: "12:00 Thursday 26 to 11:59 Friday 27 November 2026" */
  label: string;
};

/** GET /api/strikes: strikes running now or starting within a week. */
export type StrikesResponse = { strikes: Strike[] };

export const STRIKE_WINDOW_DAYS = 7;

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAY = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
const MONTH = `(${MONTHS.join("|")})`;
const TIME = "(\\d{1,2}[:.]\\d{2})";

// "12:00 Thursday 26 to 11:59 Friday 27 November 2026", or with the month and year on both ends.
const RANGE = new RegExp(
  `(?:${TIME}\\s+)?${WEEKDAY}\\s+(\\d{1,2})(?:\\s+${MONTH})?(?:\\s+(\\d{4}))?\\s+(?:to|until|-|–)\\s+(?:${TIME}\\s+)?${WEEKDAY}\\s+(\\d{1,2})\\s+${MONTH}\\s+(\\d{4})`,
  "gi",
);
// A one-day strike: "Tuesday 3 March 2027".
const SINGLE = new RegExp(`(?:${TIME}\\s+)?${WEEKDAY}\\s+(\\d{1,2})\\s+${MONTH}\\s+(\\d{4})`, "gi");

const pad = (n: number) => String(n).padStart(2, "0");
const time = (text: string | undefined, fallback: string) => (text ? `${pad(Number(text.split(/[:.]/)[0]))}:${text.slice(-2)}` : fallback);
const date = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** The page's text, without its markup. The content arrives both as HTML and escaped inside a script. */
export function pageText(html: string): string {
  return html
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
}

/** Every strike date on TfL's strikes page. */
export function parseStrikes(html: string): Strike[] {
  const text = pageText(html);
  const strikes = new Map<string, Strike>();
  const add = (strike: Strike) => {
    const key = strike.start + strike.end;
    if (!strikes.has(key)) strikes.set(key, strike);
  };

  for (const m of text.matchAll(RANGE)) {
    const [label, startTime, startDay, startMonth, startYear, endTime, endDay, endMonthName, endYear] = m;
    const endMonth = MONTHS.indexOf(endMonthName!.toLowerCase());
    const month = startMonth ? MONTHS.indexOf(startMonth.toLowerCase()) : endMonth;
    // "Thursday 31 December to Friday 1 January 2027" started the year before.
    const year = startYear ? Number(startYear) : month > endMonth ? Number(endYear) - 1 : Number(endYear);
    add({
      start: `${date(year, month, Number(startDay))}T${time(startTime, "00:00")}`,
      end: `${date(Number(endYear), endMonth, Number(endDay))}T${time(endTime, "23:59")}`,
      label: label.trim(),
    });
  }
  for (const m of text.replace(RANGE, " ").matchAll(SINGLE)) {
    const [label, startTime, day, month, year] = m;
    const on = date(Number(year), MONTHS.indexOf(month!.toLowerCase()), Number(day));
    add({ start: `${on}T${time(startTime, "00:00")}`, end: `${on}T23:59`, label: label.trim() });
  }
  return [...strikes.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** Strikes running now or starting in the next week, soonest first. */
export function upcomingStrikes(strikes: Strike[], now: Date): Strike[] {
  const from = londonDateTime(now);
  const to = `${addDays(from.slice(0, 10), STRIKE_WINDOW_DAYS)}${from.slice(10)}`;
  return strikes.filter((strike) => strike.end >= from && strike.start <= to);
}
