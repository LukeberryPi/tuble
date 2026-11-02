import { describe, expect, test } from "bun:test";
import { LINE_FACTS, STATION_FACTS, pickFacts } from "../app/facts.ts";
import networkJson from "../data/network.json";
import promptsJson from "../data/prompts.json";
import scheduleJson from "../data/schedule.json";
import { LAUNCH_DATE, addDays, londonDate, msUntilNextPuzzle, puzzleNumber } from "../src/game/day.ts";
import { createMatcher } from "../src/game/match.ts";
import { resultFor } from "../src/game/result.ts";
import { REGULAR_PROMPTS_PER_DAY, buildSchedule, scheduleFor, type ScheduleDay } from "../src/game/schedule.ts";
import { likelihoodFor } from "../src/game/score.ts";
import type { Network } from "../src/network.ts";
import type { InterchangePrompt, Prompt } from "../src/prompts/types.ts";

const network = networkJson as Network;
const bank = promptsJson as unknown as { prompts: Prompt[]; interchange: InterchangePrompt[] };
const schedule = scheduleJson as ScheduleDay[];
const usage = new Map(network.stations.map((station) => [station.id, station.usage]));
const match = createMatcher(network.stations, network.otherStations);

function id(name: string): string {
  const station = network.stations.find((s) => s.name === name);
  if (!station) throw new Error(`No station called ${name}`);
  return station.id;
}

describe("matching what players type", () => {
  test.each([
    ["Oxford Circus", "Oxford Circus"],
    ["oxford circus", "Oxford Circus"],
    ["Kings Cross", "King's Cross St. Pancras"],
    ["St Pancras", "King's Cross St. Pancras"],
    ["Elephant and Castle", "Elephant & Castle"],
    ["Saint John's Wood", "St. John's Wood"],
    ["Baker St", "Baker Street"],
    ["Edgware Rd", "Edgware Road"],
    ["Edgware", "Edgware"],
    ["Shepherds Bush", "Shepherd's Bush"],
    ["Clapham Junction", "Clapham Junction"],
    ["Shoreditch", "Shoreditch High Street"],
    ["Walthamstow Queens Road", "Walthamstow Queen's Road"],
    ["St Pancras International", "King's Cross St. Pancras"],
    ["Heathrow Terminal 2", "Heathrow Terminals 2 & 3"],
    ["Heathrow Terminal 3", "Heathrow Terminals 2 & 3"],
    ["Heathrow 5", "Heathrow Terminal 5"],
    ["Olympia", "Kensington (Olympia)"],
    ["Kensington", "Kensington (Olympia)"],
    ["Kennington", "Kennington"],
    ["Picadilly Circus", "Piccadilly Circus"],
    ["Marlybone", "Marylebone"],
    ["Stratfrod", "Stratford"],
    ["Harrow on the Hill", "Harrow-on-the-Hill"],
  ])("%p is %p", (typed, name) => {
    expect(match(typed)).toEqual({ kind: "station", id: id(name) });
  });

  test("asks which one when a few stations fit", () => {
    expect(match("Heathrow")).toEqual({
      kind: "choose",
      ids: [id("Heathrow Terminal 4"), id("Heathrow Terminal 5"), id("Heathrow Terminals 2 & 3")].sort(),
    });
    expect(match("Wembley")).toEqual({ kind: "choose", ids: [id("Wembley Central"), id("Wembley Park")] });
    expect(match("Walthamstow")).toEqual({ kind: "choose", ids: [id("Walthamstow Central"), id("Walthamstow Queen's Road")] });
    expect(match("Tooting")).toEqual({ kind: "choose", ids: [id("Tooting Bec"), id("Tooting Broadway")] });
  });

  test("says 'keep typing' rather than listing lots of stations", () => {
    expect(match("Ea")).toEqual({ kind: "vague" });
    expect(match("Queen")).toEqual({ kind: "vague" });
    expect(match("Q")).toEqual({ kind: "vague" });
  });

  test("knows stations on other railways, rather than taking them for a slip", () => {
    expect(match("East Croydon")).toEqual({ kind: "elsewhere", name: "East Croydon" });
    expect(match("Battersea Park")).toEqual({ kind: "elsewhere", name: "Battersea Park" });
    expect(match("Catfrod")).toEqual({ kind: "elsewhere", name: "Catford" });
    expect(match("Stratford International")).toEqual({ kind: "elsewhere", name: "Stratford International" });
    expect(match("Waterloo East")).toEqual({ kind: "elsewhere", name: "Waterloo East" });
    expect(match("xyz")).toEqual({ kind: "none" });
  });

  test("short names must be spelt exactly", () => {
    expect(match("Bnak")).toEqual({ kind: "none" });
    expect(match("Bank")).toEqual({ kind: "station", id: id("Bank") });
  });
});

describe("days", () => {
  test("change at midnight in London, in summer and winter", () => {
    expect(londonDate(new Date("2026-10-31T23:30:00Z"))).toBe("2026-10-31"); // GMT
    expect(londonDate(new Date("2026-10-31T00:30:00Z"))).toBe("2026-10-31");
    expect(londonDate(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02"); // BST
  });

  test("count from the launch", () => {
    expect(puzzleNumber(LAUNCH_DATE)).toBe(1);
    expect(puzzleNumber("2026-11-30")).toBe(31);
  });

  test("know how long until the next puzzle", () => {
    expect(msUntilNextPuzzle(new Date("2026-11-01T23:00:00Z"))).toBe(3_600_000);
  });
});

describe("scoring", () => {
  const central = bank.prompts.find((prompt) => prompt.id === "line:central")!;
  const score = (stationId: string | null, counts: Record<string, number> = {}, interchange = false) =>
    resultFor({
      promptId: central.id,
      answers: central.answers,
      interchange,
      stationId,
      counts,
      likelihood: likelihoodFor(central.id, usage),
    });

  test("before anyone plays, busy stations are Rush Hour and quiet ones are Ghost Stations", () => {
    expect(score(id("Oxford Circus")).tier).toBe("rush-hour");
    expect(score(id("Roding Valley")).tier).toBe("ghost-station");
    expect(score(id("Roding Valley")).points).toBe(100);
  });

  test("real answers take over from the estimate", () => {
    const result = score(id("Roding Valley"), { [id("Roding Valley")]: 200, [id("Oxford Circus")]: 20 });
    expect(result.tier).toBe("rush-hour");
  });

  test("leaves the player's own answer out", () => {
    const result = score(id("Roding Valley"), { [id("Roding Valley")]: 1 });
    expect(result.tier).toBe("ghost-station");
    expect(result.players).toBe(0);
  });

  test("running out of time misses the train", () => {
    expect(score(null)).toMatchObject({ correct: false, tier: "lost-train", points: 0, share: null });
    expect(score(id("Brixton"))).toMatchObject({ correct: false, tier: "lost-train", points: 0, share: null });
  });

  test("the Interchange scores double", () => {
    expect(score(id("Roding Valley"), {}, true).points).toBe(200);
  });

  test("lists the most common answers and some deep cuts", () => {
    const result = score(id("Oxford Circus"));
    expect(result.top).toHaveLength(3);
    expect(result.deepCuts).toHaveLength(3);
    expect(result.deepCuts.map((answer) => answer.id)).toContain(id("Roding Valley"));
  });
});

describe("did you know?", () => {
  const linesOf = (stationId: string) => network.stations.find((station) => station.id === stationId)?.lines ?? [];

  test("every fact is about a station or line on the network", () => {
    const stationIds = new Set(network.stations.map((station) => station.id));
    const lines = new Set<string>(network.stations.flatMap((station) => station.lines));
    expect(Object.keys(STATION_FACTS).filter((stationId) => !stationIds.has(stationId))).toEqual([]);
    expect(Object.keys(LINE_FACTS).filter((line) => !lines.has(line))).toEqual([]);
  });

  test("starts with the player's station and never repeats itself", () => {
    const central = bank.prompts.find((prompt) => prompt.id === "line:central")!;
    const epping = resultFor({
      promptId: central.id,
      answers: central.answers,
      interchange: false,
      stationId: id("Epping"),
      counts: {},
      likelihood: likelihoodFor(central.id, usage),
    });
    const facts = pickFacts(Array(7).fill(epping), linesOf, 3);
    expect(facts[0]).toBe(STATION_FACTS.epping!);
    expect(new Set(facts).size).toBe(7);
  });
});

describe("the schedule", () => {
  const stationIds = new Set(network.stations.map((station) => station.id));
  const family = (promptId: string) => promptId.split(":")[0];

  test("starts on launch day, with a day for every date", () => {
    expect(schedule[0]!.date).toBe(LAUNCH_DATE);
    expect(schedule.length).toBeGreaterThanOrEqual(365);
    schedule.forEach((day, i) => expect(puzzleNumber(day.date)).toBe(i + 1));
  });

  test("keeps launch day's Halloween puzzle", () => {
    expect(schedule[0]!.prompts.map((prompt) => prompt.id)).toEqual([
      "line:central",
      "river:south",
      "line-end:any",
      "usage:quietest-20",
      "lexicon:colour",
      "stops:1:waterloo",
    ]);
    expect(schedule[0]!.interchange.id).toBe("zone:1&lexicon:animal");
  });

  test("gives every day six prompts from different families, plus a two-part Interchange", () => {
    for (const day of schedule) {
      expect(day.prompts).toHaveLength(REGULAR_PROMPTS_PER_DAY);
      expect(new Set(day.prompts.map((prompt) => family(prompt.id))).size).toBe(REGULAR_PROMPTS_PER_DAY);
      expect(day.interchange.conditions).toHaveLength(2);
    }
  });

  test("only accepts real stations", () => {
    for (const day of schedule) {
      for (const prompt of [...day.prompts, day.interchange]) {
        expect(prompt.answers.length).toBeGreaterThan(0);
        for (const answer of prompt.answers) expect(stationIds.has(answer)).toBe(true);
      }
    }
  });

  test("doesn't repeat a prompt within four weeks", () => {
    const lastSeen = new Map<string, number>();
    schedule.forEach((day, i) => {
      for (const { id: promptId } of day.prompts) {
        if (lastSeen.has(promptId)) expect(i - lastSeen.get(promptId)!).toBeGreaterThanOrEqual(28);
        lastSeen.set(promptId, i);
      }
    });
  });

  test("leaves played days alone when it adds new ones", () => {
    const played = schedule.slice(0, 3);
    const rebuilt = buildSchedule(bank, { history: played, start: LAUNCH_DATE, days: 30, seed: 1, stationIds });
    expect(rebuilt.slice(0, 3)).toEqual(played);
    expect(rebuilt).toHaveLength(33);
    expect(rebuilt[3]!.date).toBe(addDays(played[2]!.date, 1));
    // The played days count towards the four weeks between repeats.
    const recent = new Set(played.flatMap((day) => day.prompts.map((prompt) => prompt.id)));
    for (const day of rebuilt.slice(3, 3 + 25)) for (const prompt of day.prompts) expect(recent.has(prompt.id)).toBe(false);
  });

  test("starts again from the top after the last day", () => {
    const last = schedule.at(-1)!;
    expect(scheduleFor(schedule, last.date)).toBe(last);
    expect(scheduleFor(schedule, addDays(last.date, 1))).toBe(schedule[0]!);
  });
});
