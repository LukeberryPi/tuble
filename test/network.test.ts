import { describe, expect, test } from "bun:test";
import networkJson from "../data/network.json";
import { TubeGraph } from "../src/graph.ts";
import { isTubeLine } from "../src/lines.ts";
import type { Network } from "../src/network.ts";

const network = networkJson as Network;
const graph = new TubeGraph(network);

function id(name: string): string {
  const station = network.stations.find((s) => s.name === name);
  if (!station) throw new Error(`No station called ${name}`);
  return station.id;
}

const names = (ids: string[]) => ids.map((stationId) => graph.station(stationId).name).sort();

test("has every Tube and Overground station once", () => {
  expect(network.stations).toHaveLength(352);
  expect(network.stations.filter((s) => s.lines.every((line) => !isTubeLine(line)))).toHaveLength(83);
  expect(new Set(network.stations.map((s) => s.id)).size).toBe(network.stations.length);
});

test("merges the stations TfL splits in two", () => {
  const tubeOnly = network.stations.filter((s) => s.naptanIds.length > 1 && s.lines.every(isTubeLine)).map((s) => s.name);
  expect(tubeOnly.sort()).toEqual(["Edgware Road", "Hammersmith", "Paddington"]);
});

test("merges the Tube and Overground halves of an interchange", () => {
  expect(graph.station(id("Highbury & Islington")).lines).toEqual(["victoria", "mildmay", "windrush"]);
  expect(graph.station(id("Shepherd's Bush")).lines).toEqual(["central", "mildmay"]);
  expect(graph.station(id("Euston")).lines).toEqual(["northern", "victoria", "lioness"]);
});

test("has a borough, zone and usage figure for stations only on the Overground", () => {
  const station = graph.station(id("Hackney Wick"));
  expect(station).toMatchObject({ boroughs: ["Tower Hamlets"], zones: [2], opened: null });
  expect(station.usage).toBeGreaterThan(0);
  expect(graph.station(id("Watford Junction")).zones).toEqual([]);
});

test("knows the names of stations on other railways, but not ours", () => {
  expect(network.otherStations).toEqual(expect.arrayContaining(["East Croydon", "Cutty Sark", "Battersea Park"]));
  for (const name of ["Richmond", "Stratford", "Kensington", "King's Cross", "Tooting"]) expect(network.otherStations).not.toContain(name);
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
