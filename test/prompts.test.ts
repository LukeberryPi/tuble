import { describe, expect, test } from "bun:test";
import networkJson from "../data/network.json";
import type { Network } from "../src/network.ts";
import { FAMILIES } from "../src/prompts/families.ts";
import { LIMITS, generatePromptBank, overlap } from "../src/prompts/generate.ts";

const network = networkJson as Network;
const bank = generatePromptBank(network);
const stationName = new Map(network.stations.map((s) => [s.id, s.name]));

function answers(promptId: string): string[] {
  const prompt = bank.prompts.find((p) => p.id === promptId);
  if (!prompt) throw new Error(`No prompt ${promptId}`);
  return prompt.answers.map((stationId) => stationName.get(stationId)!).sort();
}

describe("the prompt bank", () => {
  test("matches data/prompts.json, so the committed file is up to date", async () => {
    const file = await Bun.file(new URL("../data/prompts.json", import.meta.url)).json();
    expect(file.prompts).toEqual(bank.prompts);
    expect(file.interchange).toEqual(bank.interchange);
  });

  test("has unique ids", () => {
    const ids = [...bank.prompts, ...bank.interchange].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("reads as 'Name a station' and its conditions", () => {
    for (const prompt of [...bank.prompts, ...bank.interchange]) {
      expect(prompt.text).toBe(`Name a station ${prompt.conditions.join(", ")}`);
    }
  });

  test("keeps every prompt within its family's answer limits", () => {
    for (const prompt of bank.prompts) {
      const family = FAMILIES.find((f) => f.id === prompt.family)!;
      expect(prompt.answers.length).toBeGreaterThanOrEqual(family.limits?.min ?? LIMITS.minAnswers);
      expect(prompt.answers.length).toBeLessThanOrEqual(family.limits?.max ?? LIMITS.maxAnswers);
    }
  });

  test("has no near copies", () => {
    const sets = bank.prompts.map((p) => new Set(p.answers));
    sets.forEach((a, i) => {
      for (const b of sets.slice(i + 1)) expect(overlap(a, b)).toBeLessThan(LIMITS.maxOverlap);
    });
  });

  test("Interchange prompts have a small set of answers", () => {
    for (const prompt of bank.interchange) {
      expect(prompt.answers.length).toBeGreaterThanOrEqual(LIMITS.interchange.minAnswers);
      expect(prompt.answers.length).toBeLessThanOrEqual(LIMITS.interchange.maxAnswers);
    }
  });
});

describe("prompt answers", () => {
  test("south of the river follows the Thames, not the latitude", () => {
    expect(answers("river:south")).toContain("North Greenwich");
    expect(answers("river:south")).not.toContain("Pimlico");
    expect(answers("river:south")).not.toContain("Putney Bridge");
  });

  test("finds every animal hiding in a station name, and nothing else", () => {
    expect(answers("lexicon:animal")).toEqual([
      "Battersea Power Station", // bat
      "Blackhorse Road", // horse
      "Buckhurst Hill", // buck
      "Canary Wharf", // canary
      "Carpenders Park", // carp
      "Cockfosters", // cock
      "Croxley", // ox
      "East Finchley", // finch
      "Elephant & Castle", // elephant
      "Finchley Central", // finch
      "Finchley Road", // finch
      "Finchley Road & Frognal", // finch, frog
      "Gants Hill", // ant
      "Goldhawk Road", // hawk
      "Hendon Central", // hen
      "Hoxton", // ox
      "Lambeth North", // lamb
      "Oxford Circus", // ox
      "Ravenscourt Park", // raven
      "Snaresbrook", // rook
      "Stamford Brook", // rook
      "Stratford", // rat
      "Turkey Street", // turkey
      "Turnpike Lane", // pike
      "West Finchley", // finch
      "White Hart Lane", // hart
      "Whitechapel", // ape
    ]);
  });

  test("counts Tube lines for hubs and 'no other Tube line', ignoring the Overground", () => {
    expect(answers("hub:3")).not.toContain("Highbury & Islington");
    expect(answers("line-only:victoria")).toEqual(expect.arrayContaining(["Blackhorse Road", "Pimlico"]));
    expect(answers("hub:tube-overground")).toEqual(expect.arrayContaining(["Highbury & Islington", "Shepherd's Bush", "Euston"]));
  });

  test("measures 'further south' from the landmark", () => {
    // Forest Hill is the Horniman Museum's own station, a little to the south; Balham is 300 m north.
    expect(answers("compass:south:horniman-museum")).toEqual(expect.arrayContaining(["Forest Hill", "Morden"]));
    expect(answers("compass:south:horniman-museum")).not.toContain("Balham");
  });

  test("knows which stations are outside the M25", () => {
    expect(answers("outside-london:m25")).toEqual([
      "Amersham",
      "Chalfont & Latimer",
      "Chesham",
      "Cheshunt",
      "Chorleywood",
      "Epping",
      "Theobalds Grove",
    ]);
  });

  test("solves the letter puzzles", () => {
    expect(answers("spelling:consonants-4")).toContain("Knightsbridge");
    expect(answers("spelling:no-letters:tube")).toContain("Pimlico");
    expect(answers("spelling:no-letters:tube")).not.toContain("Bank");
  });

  test("finds the stations far from any other", () => {
    expect(answers("spacing:lonely")).toEqual(expect.arrayContaining(["Chesham", "Amersham", "Epping"]));
    expect(answers("spacing:close")).toEqual(expect.arrayContaining(["Leicester Square", "Covent Garden"]));
  });

  test("finds colours at the start of words, including Golders Green's two", () => {
    expect(answers("lexicon:colour")).toEqual(expect.arrayContaining(["Golders Green", "Redbridge", "Blackhorse Road", "White City"]));
  });

  test("counts 'Broadway' as containing 'Road', so nobody is marked wrong on a technicality", () => {
    expect(answers("word:road")).toContain("Fulham Broadway");
  });

  test("leaves stations with no usage figure out of the quietest list", () => {
    const zero = network.stations.filter((s) => s.usage === 0).map((s) => s.name);
    expect(zero.length).toBeGreaterThan(0);
    for (const name of zero) expect(answers("usage:quietest-20")).not.toContain(name);
  });
});
