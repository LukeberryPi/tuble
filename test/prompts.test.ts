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
      "Cockfosters", // cock
      "Croxley", // ox
      "East Finchley", // finch
      "Elephant & Castle", // elephant
      "Finchley Central", // finch
      "Finchley Road", // finch
      "Gants Hill", // ant
      "Goldhawk Road", // hawk
      "Hendon Central", // hen
      "Lambeth North", // lamb
      "Oxford Circus", // ox
      "Ravenscourt Park", // raven
      "Snaresbrook", // rook
      "Stamford Brook", // rook
      "Stratford", // rat
      "Turnpike Lane", // pike
      "West Finchley", // finch
      "Whitechapel", // ape
    ]);
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
