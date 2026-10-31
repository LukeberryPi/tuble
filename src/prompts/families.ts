import { kmBetween } from "../geo.ts";
import { LINES } from "../lines.ts";
import { nameWords, slugify } from "../names.ts";
import type { Station } from "../network.ts";
import { boroughPhrase, isInLondon, isSouthOfTheRiver } from "../places.ts";
import { LEXICONS, NAME_WORDS, SUFFIXES } from "./lexicons.ts";
import type { Candidate, Context, Family } from "./types.ts";

const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

function candidate(family: string, key: string, fragment: string, answers: Iterable<string>, combinable = true): Candidate {
  return { id: `${family}:${key}`, family, fragment, answers: new Set(answers), combinable };
}

function matching(ctx: Context, test: (station: Station) => boolean): string[] {
  return ctx.stations.filter(test).map((station) => station.id);
}

function capitalise(word: string): string {
  return word[0]!.toUpperCase() + word.slice(1);
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
    ],
  },
  {
    id: "line-end",
    label: "End of the line",
    generate: (ctx) => {
      const ends = LINES.map((line) => ({ line, ends: ctx.graph.lineEnds(line.id) }));
      return [
        candidate("line-end", "any", "at the very end of a line", ends.flatMap(({ ends }) => ends)),
        ...ends.map(({ line, ends }) =>
          candidate("line-end", line.id, `at the very end of the ${line.name} line`, ends, false),
        ),
      ];
    },
  },
  {
    id: "hub",
    label: "Where lines meet",
    generate: (ctx) =>
      [3, 4].map((count) =>
        candidate("hub", String(count), `where ${count} or more tube lines meet`, matching(ctx, (s) => s.lines.length >= count)),
      ),
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
      LINES.map((line) =>
        candidate(
          "line-only",
          line.id,
          `on the ${line.name} line and no other tube line`,
          matching(ctx, (s) => s.lines.length === 1 && s.lines[0] === line.id),
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
      const decades = [...new Set(ctx.stations.map((s) => Math.floor(s.opened / 10) * 10))].sort();
      return [
        ...decades.map((decade) =>
          candidate(
            "opened",
            `${decade}s`,
            `that first opened on the Underground in the ${decade}s`,
            matching(ctx, (s) => s.opened >= decade && s.opened < decade + 10),
          ),
        ),
        candidate("opened", "before-1900", "that first opened on the Underground before 1900", matching(ctx, (s) => s.opened < 1900)),
        candidate("opened", "after-1950", "that first opened on the Underground after 1950", matching(ctx, (s) => s.opened > 1950)),
      ];
    },
  },
  {
    id: "usage",
    label: "Busiest and quietest",
    generate: (ctx) => {
      // Stations with no figure for the year (shown as 0) are left out rather than called quiet.
      const byUsage = ctx.stations
        .filter((s) => s.usage > 0)
        .sort((a, b) => b.usage - a.usage)
        .map((s) => s.id);
      return [10, 20].flatMap((count) => [
        candidate("usage", `busiest-${count}`, `among the ${count} busiest in ${ctx.usageYear}`, byUsage.slice(0, count)),
        candidate("usage", `quietest-${count}`, `among the ${count} quietest in ${ctx.usageYear}`, byUsage.slice(-count)),
      ]);
    },
  },
  {
    id: "compass",
    label: "Further than a landmark",
    limits: { max: 40 },
    maxOverlap: 0.5,
    generate: (ctx) =>
      ctx.landmarks.slice(0, 30).flatMap((anchor) => [
        candidate("compass", `north:${anchor.id}`, `further north than ${anchor.name}`, matching(ctx, (s) => s.lat > anchor.lat), false),
        candidate("compass", `south:${anchor.id}`, `further south than ${anchor.name}`, matching(ctx, (s) => s.lat < anchor.lat), false),
        candidate("compass", `east:${anchor.id}`, `further east than ${anchor.name}`, matching(ctx, (s) => s.lon > anchor.lon), false),
        candidate("compass", `west:${anchor.id}`, `further west than ${anchor.name}`, matching(ctx, (s) => s.lon < anchor.lon), false),
      ]),
  },
  {
    id: "walk",
    label: "Walking distance",
    limits: { max: 20 },
    maxOverlap: 0.5,
    generate: (ctx) =>
      ctx.stations
        .filter((anchor) => anchor.zones.includes(1))
        .sort((a, b) => b.usage - a.usage)
        .map((anchor) =>
          candidate(
            "walk",
            anchor.id,
            `within 1 km of ${anchor.name} as the crow flies`,
            matching(ctx, (s) => s.id !== anchor.id && kmBetween(s, anchor) <= 1),
            false,
          ),
        ),
  },
  {
    id: "stops",
    label: "Stops away",
    limits: { max: 25 },
    maxOverlap: 0.5,
    generate: (ctx) =>
      ctx.landmarks.flatMap((anchor) => {
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
      const landmarks = new Set(ctx.landmarks.map((s) => s.id));
      return LINES.flatMap((line) => {
        // Recognisable endpoints only: line ends, big interchanges and busy stations.
        const ends = new Set(ctx.graph.lineEnds(line.id));
        const anchors = ctx.stations
          .filter((s) => s.lines.includes(line.id) && (ends.has(s.id) || s.lines.length >= 3 || landmarks.has(s.id)))
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
