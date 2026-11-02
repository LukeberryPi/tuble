import { kmBetween } from "../geo.ts";
import { LANDMARKS } from "../landmarks.ts";
import { LINES, TUBE_LINES, isOvergroundLine, isTubeLine } from "../lines.ts";
import { nameWords, slugify } from "../names.ts";
import type { Station } from "../network.ts";
import { boroughPhrase, isInLondon, isSouthOfTheRiver } from "../places.ts";
import { LEXICONS, NAME_WORDS, SUFFIXES } from "./lexicons.ts";
import type { Candidate, Context, Family } from "./types.ts";

const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/**
 * Stations outside the M25, checked against the motorway's route on OpenStreetMap. Theobalds
 * Grove is just north of the Holmesdale Tunnel at Waltham Cross; Theydon Bois is just inside.
 */
const OUTSIDE_THE_M25 = ["amersham", "chalfont-and-latimer", "chesham", "chorleywood", "epping", "cheshunt", "theobalds-grove"];

/** Words for "shares no letters with the word…". */
const NO_LETTERS_FROM = ["tube", "london", "zone", "river", "queen", "king"];

/**
 * Landmarks are buildings, not points: a station this close to level with one counts as
 * further north (or south, east, west) either way.
 */
const LEVEL_KM = 0.2;
const KM_PER_DEGREE_LAT = 111.2;
const KM_PER_DEGREE_LON = KM_PER_DEGREE_LAT * Math.cos((51.5 * Math.PI) / 180);

type Point = { lat: number; lon: number };
const kmNorth = (s: Point, of: Point) => (s.lat - of.lat) * KM_PER_DEGREE_LAT;
const kmEast = (s: Point, of: Point) => (s.lon - of.lon) * KM_PER_DEGREE_LON;
const COMPASS: { direction: string; beyond: (s: Point, of: Point) => boolean }[] = [
  { direction: "north", beyond: (s, of) => kmNorth(s, of) > -LEVEL_KM },
  { direction: "south", beyond: (s, of) => kmNorth(s, of) < LEVEL_KM },
  { direction: "east", beyond: (s, of) => kmEast(s, of) > -LEVEL_KM },
  { direction: "west", beyond: (s, of) => kmEast(s, of) < LEVEL_KM },
];

function candidate(family: string, key: string, fragment: string, answers: Iterable<string>, combinable = true): Candidate {
  return { id: `${family}:${key}`, family, fragment, answers: new Set(answers), combinable };
}

function matching(ctx: Context, test: (station: Station) => boolean): string[] {
  return ctx.stations.filter(test).map((station) => station.id);
}

function capitalise(word: string): string {
  return word[0]!.toUpperCase() + word.slice(1);
}

const tubeLinesAt = (station: Station) => station.lines.filter(isTubeLine);
const overgroundLinesAt = (station: Station) => station.lines.filter(isOvergroundLine);
const letters = (station: Station) => station.name.toLowerCase().replace(/[^a-z]/g, "");

/** The longest run of consonants inside one word. Y counts as a vowel: "Kingsbury" has "ngsb". */
function consonantRun(station: Station): number {
  return Math.max(...nameWords(station.name).map((word) => Math.max(0, ...(word.match(/[b-df-hj-np-tv-xz]+/g) ?? []).map((run) => run.length))));
}

/**
 * Every kind of prompt, in priority order: when two prompts have nearly the same answers,
 * the one from the earlier family is kept. Simple, memorable prompts come first.
 */
export const FAMILIES: Family[] = [
  {
    id: "line",
    label: "On a line",
    generate: (ctx) =>
      LINES.map((line) =>
        candidate("line", line.id, `on the ${line.name} line`, matching(ctx, (s) => s.lines.includes(line.id))),
      ),
  },
  {
    id: "zone",
    label: "In a zone",
    generate: (ctx) => [
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((zone) =>
        candidate("zone", String(zone), `in Zone ${zone}`, matching(ctx, (s) => s.zones.includes(zone))),
      ),
      candidate("zone", "beyond-6", "beyond Zone 6", matching(ctx, (s) => s.zones.some((zone) => zone > 6))),
    ],
  },
  {
    id: "river",
    label: "South of the river",
    generate: (ctx) => [
      candidate("river", "south", "south of the river", matching(ctx, (s) => s.boroughs.every(isSouthOfTheRiver))),
    ],
  },
  {
    id: "outside-london",
    label: "Outside London",
    generate: (ctx) => [
      candidate("outside-london", "all", "outside Greater London", matching(ctx, (s) => !s.boroughs.some(isInLondon))),
      candidate("outside-london", "m25", "outside the M25", OUTSIDE_THE_M25),
    ],
  },
  {
    id: "line-end",
    label: "End of the line",
    generate: (ctx) => {
      const ends = LINES.map((line) => ({ line, ends: ctx.graph.lineEnds(line.id) }));
      const endsOf = (mode: "tube" | "overground") => ends.filter(({ line }) => line.mode === mode).flatMap(({ ends }) => ends);
      return [
        candidate("line-end", "any", "at the very end of a Tube line", endsOf("tube")),
        candidate("line-end", "overground", "at the very end of an Overground line", endsOf("overground")),
        ...ends.map(({ line, ends }) =>
          candidate("line-end", line.id, `at the very end of the ${line.name} line`, ends, false),
        ),
      ];
    },
  },
  {
    id: "hub",
    label: "Where lines meet",
    generate: (ctx) => [
      ...[3, 4].map((count) =>
        candidate("hub", String(count), `where ${count} or more Tube lines meet`, matching(ctx, (s) => tubeLinesAt(s).length >= count)),
      ),
      candidate(
        "hub",
        "tube-overground",
        "where you can change between the Tube and the Overground",
        matching(ctx, (s) => tubeLinesAt(s).length > 0 && overgroundLinesAt(s).length > 0),
      ),
      candidate("hub", "overground-2", "where two Overground lines meet", matching(ctx, (s) => overgroundLinesAt(s).length >= 2)),
    ],
  },
  {
    id: "lexicon",
    label: "Hidden in the name",
    generate: (ctx) =>
      LEXICONS.map((lexicon) => candidate("lexicon", lexicon.id, lexicon.fragment, matching(ctx, lexicon.test))),
  },
  {
    id: "initial",
    label: "First letter",
    generate: (ctx) =>
      ALPHABET.map((letter) =>
        candidate("initial", letter.toLowerCase(), `beginning with ${letter}`, matching(ctx, (s) => s.name.toUpperCase().startsWith(letter))),
      ),
  },
  {
    id: "letter",
    label: "A rare letter",
    limits: { max: 20 },
    generate: (ctx) =>
      ALPHABET.map((letter) =>
        candidate("letter", letter.toLowerCase(), `with the letter ${letter} in its name`, matching(ctx, (s) => s.name.toUpperCase().includes(letter))),
      ),
  },
  {
    id: "spelling",
    label: "Letter puzzles",
    generate: (ctx) => [
      candidate("spelling", "consonants-4", "with four consonants in a row in one word", matching(ctx, (s) => consonantRun(s) >= 4)),
      ...NO_LETTERS_FROM.map((word) =>
        candidate(
          "spelling",
          `no-letters:${word}`,
          `that shares no letters with the word “${word.toUpperCase()}”`,
          matching(ctx, (s) => ![...letters(s)].some((letter) => word.includes(letter))),
        ),
      ),
    ],
  },
  {
    id: "word",
    label: "A word in the name",
    // Any name containing the word counts, so "Broadway" is a valid answer for "Road":
    // nobody gets marked wrong on a technicality.
    generate: (ctx) =>
      NAME_WORDS.map((word) =>
        candidate("word", word, `with “${capitalise(word)}” in its name`, matching(ctx, (s) => s.name.toLowerCase().includes(word))),
      ),
  },
  {
    id: "suffix",
    label: "A word ending",
    generate: (ctx) =>
      SUFFIXES.map((suffix) =>
        candidate(
          "suffix",
          suffix,
          `with a word ending in “-${suffix}”`,
          matching(ctx, (s) => nameWords(s.name).some((word) => word.endsWith(suffix))),
        ),
      ),
  },
  {
    id: "line-only",
    label: "Only one line",
    generate: (ctx) =>
      TUBE_LINES.map((line) =>
        candidate(
          "line-only",
          line.id,
          `on the ${line.name} line and no other Tube line`,
          matching(ctx, (s) => tubeLinesAt(s).length === 1 && s.lines.includes(line.id)),
          false,
        ),
      ),
  },
  {
    id: "line-pair",
    label: "Change between two lines",
    generate: (ctx) =>
      LINES.flatMap((a, i) =>
        LINES.slice(i + 1).map((b) =>
          candidate(
            "line-pair",
            `${a.id}+${b.id}`,
            `where you can change between the ${a.name} and ${b.name} lines`,
            matching(ctx, (s) => s.lines.includes(a.id) && s.lines.includes(b.id)),
            false,
          ),
        ),
      ),
  },
  {
    id: "line-zone",
    label: "A line in a zone",
    generate: (ctx) =>
      LINES.flatMap((line) =>
        [1, 2, 3, 4, 5, 6].map((zone) =>
          candidate(
            "line-zone",
            `${line.id}:${zone}`,
            `on the ${line.name} line in Zone ${zone}`,
            matching(ctx, (s) => s.lines.includes(line.id) && s.zones.includes(zone)),
            false,
          ),
        ),
      ),
  },
  {
    id: "borough",
    label: "In a borough",
    generate: (ctx) =>
      [...new Set(ctx.stations.flatMap((s) => s.boroughs))]
        .filter(isInLondon)
        .sort()
        .map((borough) =>
          candidate("borough", slugify(borough), boroughPhrase(borough), matching(ctx, (s) => s.boroughs.includes(borough))),
        ),
  },
  {
    id: "opened",
    label: "When it opened",
    generate: (ctx) => {
      const opened = (test: (year: number) => boolean) => matching(ctx, (s) => s.opened !== null && test(s.opened));
      const years = ctx.stations.flatMap((s) => (s.opened === null ? [] : [s.opened]));
      const decades = [...new Set(years.map((year) => Math.floor(year / 10) * 10))].sort();
      return [
        ...decades.map((decade) =>
          candidate(
            "opened",
            `${decade}s`,
            `that first opened on the Underground in the ${decade}s`,
            opened((year) => year >= decade && year < decade + 10),
          ),
        ),
        candidate("opened", "before-1900", "that first opened on the Underground before 1900", opened((year) => year < 1900)),
        candidate("opened", "after-1950", "that first opened on the Underground after 1950", opened((year) => year > 1950)),
      ];
    },
  },
  {
    id: "usage",
    label: "Busiest and quietest",
    generate: (ctx) => {
      // Stations with no figure for the year (shown as 0) are left out rather than called quiet.
      const byUsage = ctx.stations
        .filter((s) => s.usage > 0 && tubeLinesAt(s).length > 0)
        .sort((a, b) => b.usage - a.usage)
        .map((s) => s.id);
      return [10, 20].flatMap((count) => [
        candidate("usage", `busiest-${count}`, `among the ${count} busiest Tube stations in ${ctx.usageYear}`, byUsage.slice(0, count)),
        candidate("usage", `quietest-${count}`, `among the ${count} quietest Tube stations in ${ctx.usageYear}`, byUsage.slice(-count)),
      ]);
    },
  },
  {
    id: "compass",
    label: "Further than a landmark",
    maxOverlap: 0.5,
    generate: (ctx) =>
      LANDMARKS.flatMap((place) =>
        COMPASS.map(({ direction, beyond }) =>
          candidate("compass", `${direction}:${place.id}`, `further ${direction} than ${place.name}`, matching(ctx, (s) => beyond(s, place))),
        ),
      ),
  },
  {
    id: "line-compass",
    label: "Along a line, past a landmark",
    limits: { max: 30 },
    maxOverlap: 0.5,
    // Only landmarks the line passes, so "on the Piccadilly line further west than Harrods" reads naturally.
    generate: (ctx) =>
      LINES.flatMap((line) => {
        const onLine = ctx.stations.filter((s) => s.lines.includes(line.id));
        return LANDMARKS.filter((place) => onLine.some((s) => kmBetween(s, place) <= 1)).flatMap((place) =>
          COMPASS.map(({ direction, beyond }) =>
            candidate(
              "line-compass",
              `${line.id}:${direction}:${place.id}`,
              `on the ${line.name} line further ${direction} than ${place.name}`,
              onLine.filter((s) => beyond(s, place)).map((s) => s.id),
              false,
            ),
          ),
        );
      }),
  },
  {
    id: "walk",
    label: "Walking distance",
    limits: { max: 20 },
    maxOverlap: 0.5,
    generate: (ctx) => {
      const within = (km: number, place: { id: string; lat: number; lon: number }) =>
        matching(ctx, (s) => s.id !== place.id && kmBetween(s, place) <= km);
      return [
        ...LANDMARKS.map((place) => candidate("walk", place.id, `within 1 km of ${place.name} as the crow flies`, within(1, place), false)),
        ...LANDMARKS.map((place) =>
          candidate("walk", `2:${place.id}`, `within 2 km of ${place.name} as the crow flies`, within(2, place), false),
        ),
        ...ctx.stations
          .filter((anchor) => anchor.zones.includes(1))
          .sort((a, b) => b.usage - a.usage)
          .map((anchor) =>
            candidate("walk", anchor.id, `within 1 km of ${anchor.name} as the crow flies`, within(1, anchor), false),
          ),
      ];
    },
  },
  {
    id: "spacing",
    label: "Close together and far apart",
    generate: (ctx) => {
      const nearest = new Map(
        ctx.stations.map((s) => [s.id, Math.min(...ctx.stations.filter((other) => other !== s).map((other) => kmBetween(s, other)))]),
      );
      return [
        candidate("spacing", "close", "less than 400 m from another station as the crow flies", matching(ctx, (s) => nearest.get(s.id)! < 0.4)),
        candidate("spacing", "lonely", "more than 2.5 km from any other station", matching(ctx, (s) => nearest.get(s.id)! > 2.5)),
      ];
    },
  },
  {
    id: "stops",
    label: "Stops away",
    limits: { max: 25 },
    maxOverlap: 0.5,
    generate: (ctx) =>
      ctx.busiest.flatMap((anchor) => {
        const stops = [...ctx.graph.stopsFrom(anchor.id)];
        const at = (count: number) => stops.filter(([, n]) => n === count).map(([id]) => id);
        return [
          candidate("stops", `1:${anchor.id}`, `one stop from ${anchor.name}`, at(1), false),
          candidate("stops", `2:${anchor.id}`, `exactly two stops from ${anchor.name}`, at(2), false),
        ];
      }),
  },
  {
    id: "between",
    label: "Between two stations",
    limits: { max: 15 },
    maxOverlap: 0.5,
    generate: (ctx) => {
      const busiest = new Set(ctx.busiest.map((s) => s.id));
      return LINES.flatMap((line) => {
        // Recognisable endpoints only: line ends, big interchanges and busy stations.
        const ends = new Set(ctx.graph.lineEnds(line.id));
        const anchors = ctx.stations
          .filter((s) => s.lines.includes(line.id) && (ends.has(s.id) || s.lines.length >= 3 || busiest.has(s.id)))
          .sort((a, b) => b.usage - a.usage);
        return anchors.flatMap((a, i) =>
          anchors.slice(i + 1).flatMap((b) => {
            const route = ctx.graph.between(line.id, a.id, b.id);
            if (!route) return [];
            const [first, second] = [a, b].sort((x, y) => x.name.localeCompare(y.name));
            return [
              candidate(
                "between",
                `${line.id}:${first!.id}:${second!.id}`,
                `between ${first!.name} and ${second!.name} on the ${line.name} line`,
                route,
                false,
              ),
            ];
          }),
        );
      });
    },
  },
];
