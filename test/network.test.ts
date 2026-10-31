import { describe, expect, test } from "bun:test";
import networkJson from "../data/network.json";
import { TubeGraph } from "../src/graph.ts";
import type { Network } from "../src/network.ts";

const network = networkJson as Network;
const graph = new TubeGraph(network);

function id(name: string): string {
  const station = network.stations.find((s) => s.name === name);
  if (!station) throw new Error(`No station called ${name}`);
  return station.id;
}

const names = (ids: string[]) => ids.map((stationId) => graph.station(stationId).name).sort();

test("merges the stations TfL splits in two", () => {
  expect(network.stations).toHaveLength(269);
  const merged = network.stations.filter((s) => s.naptanIds.length > 1).map((s) => s.name);
  expect(merged.sort()).toEqual(["Edgware Road", "Hammersmith", "Paddington"]);
});

test("every station can be reached from Bank", () => {
  expect(graph.stopsFrom(id("Bank")).size).toBe(network.stations.length);
});

test("knows the lines at each station", () => {
  expect(graph.station(id("Roding Valley")).lines).toEqual(["central"]);
  expect(graph.station(id("King's Cross St. Pancras")).lines).toHaveLength(6);
});

test("finds the stations one stop from Oxford Circus", () => {
  const oneStop = [...graph.stopsFrom(id("Oxford Circus"))].filter(([, stops]) => stops === 1).map(([s]) => s);
  expect(names(oneStop)).toEqual([
    "Bond Street",
    "Green Park",
    "Piccadilly Circus",
    "Regent's Park",
    "Tottenham Court Road",
    "Warren Street",
  ]);
});

test("line ends are the ends you see on the map", () => {
  expect(names(graph.lineEnds("northern"))).toEqual(["Battersea Power Station", "Edgware", "High Barnet", "Mill Hill East", "Morden"]);
  // Trains terminate at Hainault, but it sits on a loop, not at the end of a line.
  expect(graph.lineEnds("central")).not.toContain(id("Hainault"));
});

describe("between", () => {
  test("lists the stations a train passes, in order", () => {
    const between = graph.between("victoria", id("Brixton"), id("Walthamstow Central"))!;
    expect(between).toHaveLength(14);
    expect(graph.station(between[0]!).name).toBe("Stockwell");
    expect(graph.station(between.at(-1)!).name).toBe("Blackhorse Road");
  });

  test("gives up when trains go different ways", () => {
    // Via Bank or via Charing Cross.
    expect(graph.between("northern", id("Camden Town"), id("Kennington"))).toBeNull();
    // Either way round the Circle.
    expect(graph.between("circle", id("Paddington"), id("Victoria"))).toBeNull();
  });

  test("gives up when no train runs between them", () => {
    // District trains from Paddington go to Earl's Court, then away from Victoria.
    expect(graph.between("district", id("Paddington"), id("Victoria"))).toBeNull();
  });
});
