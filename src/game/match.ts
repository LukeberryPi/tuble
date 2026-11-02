import { nameKey } from "../names.ts";

export type NamedStation = { id: string; name: string };

export type MatchResult =
  /** One station. */
  | { kind: "station"; id: string }
  /** A few stations fit what was typed, like "Heathrow". The player picks one. */
  | { kind: "choose"; ids: string[] }
  /** Too many stations fit what was typed, like "Ea". */
  | { kind: "vague" }
  /** A real station, but not on the Tube or Overground, like East Croydon. */
  | { kind: "elsewhere"; name: string }
  /** Not a station. */
  | { kind: "none" };

/** Other names people use, by station id. Spelling slips are handled separately. */
export const ALIASES: Record<string, string[]> = {
  "kings-cross-st-pancras": ["kings x", "st pancras", "st pancras international", "kx"],
  "heathrow-terminals-2-and-3": ["heathrow 2", "heathrow 3", "heathrow terminal 3", "heathrow 2 3", "heathrow 1 2 3", "heathrow 123"],
  "heathrow-terminal-4": ["heathrow 4", "heathrow t4"],
  "heathrow-terminal-5": ["heathrow 5", "heathrow t5"],
  "elephant-and-castle": ["e and c"],
  "kensington-olympia": ["olympia"],
  "highbury-and-islington": ["islington"],
  "tottenham-court-road": ["tcr"],
  "totteridge-and-whetstone": ["whetstone"],
  "shepherds-bush-market": ["shepherds bush hammersmith and city"],
};

/** Words people shorten, so "Baker St" and "Saint John's Wood" match. "and" is dropped, so "&" can be skipped. */
const WORD_FORMS: Record<string, string> = {
  street: "st",
  saint: "st",
  road: "rd",
  avenue: "ave",
  square: "sq",
  terminal: "t",
  terminals: "t",
  and: "",
};

/** "Saint John's Wood" -> "stjohnswood". */
export function looseKey(text: string): string {
  return nameKey(text)
    .split(" ")
    .map((word) => WORD_FORMS[word] ?? word)
    .join("");
}

/** Edits (insert, delete, change or swap two letters) to turn one string into the other. */
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}

/** How many slips to forgive in a name of this length. Short names must be exact. */
function slipsAllowed(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  if (length <= 12) return 2;
  return 3;
}

/** Never offer more than this many choices, so the choices can't be used to fish for answers. */
const MAX_CHOICES = 3;
/** And only once this much has been typed. */
const MIN_CHARS_FOR_CHOICES = 4;
/** Accept the start of a name ("Walthamstow") once this much has been typed. */
const MIN_CHARS_FOR_PREFIX = 3;

/**
 * Builds a function that turns what a player typed into a station. `otherStations` are names
 * from other railways: typing one is recognised as a real station, not taken as a slip for one
 * of ours, so "East Croydon" never becomes West Croydon.
 */
export function createMatcher(stations: NamedStation[], otherStations: string[] = []): (input: string) => MatchResult {
  const keys: { key: string; id: string }[] = [];
  for (const station of stations) {
    keys.push({ key: looseKey(station.name), id: station.id });
    for (const alias of ALIASES[station.id] ?? []) keys.push({ key: looseKey(alias), id: station.id });
  }
  const otherKeys = otherStations.map((name) => ({ key: looseKey(name), name }));

  const pick = (ids: Iterable<string>, typed: string): MatchResult => {
    const unique = [...new Set(ids)];
    if (unique.length === 1) return { kind: "station", id: unique[0]! };
    if (unique.length <= MAX_CHOICES && typed.length >= MIN_CHARS_FOR_CHOICES) return { kind: "choose", ids: unique };
    return { kind: "vague" };
  };

  return (input) => {
    const typed = looseKey(input);
    if (!typed) return { kind: "none" };

    const exact = keys.filter((k) => k.key === typed);
    if (exact.length > 0) return pick(exact.map((k) => k.id), typed);
    const other = otherKeys.find((k) => k.key === typed);
    if (other) return { kind: "elsewhere", name: other.name };

    const starts = keys.filter((k) => k.key.startsWith(typed));
    if (starts.length > 0) return typed.length >= MIN_CHARS_FOR_PREFIX ? pick(starts.map((k) => k.id), typed) : { kind: "vague" };

    // Spelling slips: compare with whole names, then with the start of each name. A closer
    // slip for another railway's station wins, so "Catfrod" is Catford, not Watford.
    const targets = [(key: string) => key];
    if (typed.length > MIN_CHARS_FOR_CHOICES) targets.push((key: string) => key.slice(0, typed.length));
    const slip = (key: string, target: (key: string) => string) => {
      const candidate = target(key);
      const distance = editDistance(typed, candidate);
      return distance <= slipsAllowed(Math.min(typed.length, candidate.length)) ? distance : Infinity;
    };
    for (const target of targets) {
      let best = Infinity;
      let ids: string[] = [];
      for (const { key, id } of keys) {
        const distance = slip(key, target);
        if (distance < best) [best, ids] = [distance, [id]];
        else if (distance === best && distance < Infinity) ids.push(id);
      }
      let closer: { name: string; distance: number } | null = null;
      for (const { key, name } of otherKeys) {
        const distance = slip(key, target);
        if (distance < best && distance < (closer?.distance ?? Infinity)) closer = { name, distance };
      }
      if (closer) return { kind: "elsewhere", name: closer.name };
      if (ids.length > 0) return pick(ids, typed);
    }
    return { kind: "none" };
  };
}
