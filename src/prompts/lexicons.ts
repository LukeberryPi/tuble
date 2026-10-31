import { nameWords } from "../names.ts";
import type { Station } from "../network.ts";

type Lexicon = { id: string; fragment: string; test: (station: Station) => boolean };

/** A word in the name starts with one of `starts`: "Redbridge" starts with "red". */
function wordStartsWith(starts: string[]) {
  return (station: Station) => nameWords(station.name).some((word) => starts.some((start) => word.startsWith(start)));
}

/** A word in the name contains one of `parts`: "Lambeth" contains "lamb". Matches never span two words. */
function wordContains(parts: string[]) {
  return (station: Station) => nameWords(station.name).some((word) => parts.some((part) => word.includes(part)));
}

/** Animals to look for inside words. test/prompts.test.ts pins the exact matches, so an accidental one fails the tests. */
const ANIMALS = [
  "ant", "ape", "bat", "bear", "bee", "buck", "bull", "canary", "carp", "cat", "cock", "cod", "cow", "crow", "deer",
  "doe", "dog", "duck", "eel", "elephant", "emu", "ewe", "finch", "fox", "goat", "gnu", "hare", "hawk", "hen", "hog",
  "horse", "lamb", "lark", "lion", "mole", "moth", "mouse", "newt", "owl", "ox", "pig", "pike", "ram", "rat", "raven",
  "rook", "seal", "sheep", "slug", "snail", "stag", "swan", "toad", "wasp", "wolf", "wren", "yak",
];

const PLANTS = ["ash", "beech", "birch", "bush", "elm", "fir", "grove", "hazel", "holly", "oak", "pine", "willow", "wood", "yew"];

const FAITH = ["abbey", "bishop", "canon", "chapel", "church", "friar", "minster", "monk", "parson", "temple"];

export const LEXICONS: Lexicon[] = [
  {
    id: "colour",
    fragment: "with a colour in its name",
    test: wordStartsWith(["black", "blue", "brown", "gold", "green", "grey", "orange", "pink", "purple", "red", "silver", "white", "yellow"]),
  },
  {
    id: "compass",
    fragment: "with a compass direction in its name",
    test: wordStartsWith(["north", "south", "east", "west"]),
  },
  {
    id: "royalty",
    fragment: "with royalty or nobility in its name",
    test: wordStartsWith(["baron", "crown", "duke", "earl", "king", "knight", "lord", "prince", "queen", "regent", "royal"]),
  },
  {
    id: "faith",
    fragment: "with something religious in its name",
    test: (station) => wordContains(FAITH)(station) || nameWords(station.name).includes("st"),
  },
  { id: "animal", fragment: "with an animal hiding in its name", test: wordContains(ANIMALS) },
  { id: "plant", fragment: "with a tree, a bush or a wood in its name", test: wordContains(PLANTS) },
  {
    id: "water",
    fragment: "with water in its name",
    test: wordContains(["brook", "embankment", "lake", "pond", "pool", "river", "sea", "spring", "water", "well", "wharf"]),
  },
  { id: "crossing", fragment: "with a bridge or a ford in its name", test: wordContains(["bridge", "ford"]) },
  { id: "apostrophe", fragment: "with an apostrophe in its name", test: (station) => /['’]/.test(station.name) },
  { id: "ampersand", fragment: "with an “&” in its name", test: (station) => station.name.includes("&") },
  {
    id: "short",
    fragment: "with a one-word name of six letters or fewer",
    test: (station) => {
      const words = nameWords(station.name);
      return words.length === 1 && words[0]!.length <= 6;
    },
  },
  { id: "long", fragment: "with three or more words in its name", test: (station) => nameWords(station.name).length >= 3 },
  {
    id: "bookends",
    fragment: "that starts and ends with the same letter",
    test: (station) => {
      const letters = station.name.toLowerCase().replace(/[^a-z]/g, "");
      return letters[0] === letters.at(-1);
    },
  },
];

/** Place-name endings, as in "a station with a word ending in -ham". */
export const SUFFIXES = [
  "bury", "don", "field", "fields", "ford", "gate", "ham", "hurst", "ing", "ley", "low", "stead", "ton", "well", "wick",
  "wood", "worth",
];

/**
 * Everyday words that turn up in station names. Place names like "Harrow" or "Ruislip" are left
 * out: their answers are just "X, North X, South X".
 */
export const NAME_WORDS = [
  "bridge", "broadway", "central", "circus", "common", "court", "cross", "east", "end", "gardens", "gate", "green", "hill",
  "lane", "manor", "market", "north", "park", "road", "south", "square", "street", "town", "valley", "west", "wood",
];
