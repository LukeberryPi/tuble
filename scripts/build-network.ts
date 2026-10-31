/**
 * Builds data/network.json: every Underground station with its lines, zones, position,
 * borough, opening year and usage, plus the track between neighbouring stations.
 *
 * Sources:
 * - TfL Unified API route sequences: stations, zones, coordinates, the order of stops and the
 *   end-to-end routes trains run.
 * - Wikipedia's "List of London Underground stations": borough, opening year and annual usage.
 *
 * Run with `bun run data:network`. Set TFL_APP_KEY to avoid TfL's anonymous rate limit.
 */
import { parse, type HTMLElement } from "node-html-parser";
import { LINES, type LineId } from "../src/lines.ts";
import { nameKey, slugify } from "../src/names.ts";
import type { Edge, Network, Route, Station } from "../src/network.ts";

const OUTPUT = new URL("../data/network.json", import.meta.url);
const USER_AGENT = "tuble-data/0.1 (https://github.com/LukeberryPi/tuble)";
const WIKIPEDIA_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_London_Underground_stations&prop=text&format=json&formatversion=2";

type TflStop = { id: string; name: string; zone: string; lat: number; lon: number };
type TflRouteSequence = {
  stopPointSequences: { stopPoint: TflStop[] }[];
  orderedLineRoutes: { naptanIds: string[] }[];
};
type WikipediaRow = { name: string; boroughs: string[]; opened: number; usage: number };

/** Wikipedia links some boroughs by a short name. */
const BOROUGH_NAMES: Record<string, string> = { Richmond: "Richmond upon Thames" };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return (await response.json()) as T;
}

/** "Edgware Road (Circle Line) Underground Station" -> "Edgware Road". Keeps "Kensington (Olympia)". */
function cleanTflName(raw: string): string {
  return raw
    .replace(/\s*Underground Station$/, "")
    .replace(/-Underground$/, "")
    .replace(/\s*\((?:Bakerloo|Central|Circle Line|H&C Line|Dist&Picc Line)\)/, "")
    .trim();
}

/** "2+3" or "2/3" -> [2, 3]. */
function parseZones(zone: string): number[] {
  const zones = [...zone.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (zones.length === 0) throw new Error(`No zone in "${zone}"`);
  return zones;
}

async function fetchTfl() {
  const key = process.env.TFL_APP_KEY ? `?app_key=${process.env.TFL_APP_KEY}` : "";
  const stops = new Map<string, TflStop & { lines: Set<LineId> }>();
  const edges: { a: string; b: string; line: LineId }[] = [];
  const routes: { line: LineId; naptanIds: string[] }[] = [];

  for (const line of LINES) {
    const data = await getJson<TflRouteSequence>(`https://api.tfl.gov.uk/Line/${line.id}/Route/Sequence/all${key}`);
    for (const { stopPoint } of data.stopPointSequences) {
      stopPoint.forEach((stop, i) => {
        if (!stops.has(stop.id)) stops.set(stop.id, { ...stop, lines: new Set() });
        stops.get(stop.id)!.lines.add(line.id);
        if (i > 0) edges.push({ a: stopPoint[i - 1]!.id, b: stop.id, line: line.id });
      });
    }
    for (const { naptanIds } of data.orderedLineRoutes) routes.push({ line: line.id, naptanIds });
  }
  return { stops: [...stops.values()], edges, routes };
}

function clean(text: string): string {
  return text.replace(/\xAD/g, "").replace(/\s+/g, " ").trim();
}

function cellText(cell: HTMLElement): string {
  for (const footnote of cell.querySelectorAll("sup, style")) footnote.remove();
  return clean(cell.text);
}

/** Stations on a boundary list two boroughs, each as its own link. */
function boroughsIn(cell: HTMLElement): string[] {
  for (const footnote of cell.querySelectorAll("sup, style")) footnote.remove();
  const links = cell.querySelectorAll("a").map((link) => clean(link.text));
  return (links.length > 0 ? links : [clean(cell.text)]).map((name) => BOROUGH_NAMES[name] ?? name);
}

async function fetchWikipedia(): Promise<{ rows: WikipediaRow[]; usageYear: number }> {
  const data = await getJson<{ parse: { text: string } }>(WIKIPEDIA_URL);
  const table = parse(data.parse.text).querySelector("table.wikitable");
  if (!table) throw new Error("Station table not found on Wikipedia");

  const [header, ...rows] = table.querySelectorAll("tr");
  const headings = header!.querySelectorAll("th").map(cellText);
  const column = (prefix: string) => {
    const index = headings.findIndex((heading) => heading.startsWith(prefix));
    if (index === -1) throw new Error(`No "${prefix}" column in ${JSON.stringify(headings)}`);
    return index;
  };
  const columns = {
    name: column("Station"),
    borough: column("Local authority"),
    opened: column("Opened"),
    usage: column("Annual usage"),
  };
  const usageYear = Number(headings[columns.usage]!.match(/\b(20\d\d)\b/)?.[1]);

  return {
    usageYear,
    rows: rows.map((row) => {
      const elements = row.querySelectorAll("th, td");
      const boroughs = boroughsIn(elements[columns.borough]!);
      const cells = elements.map(cellText);
      const name = cells[columns.name]!;
      const opened = Number(cells[columns.opened]!.match(/\b(18\d\d|19\d\d|20\d\d)\b/)?.[1]);
      const usage = Number.parseFloat(cells[columns.usage]!);
      if (!name || !opened || Number.isNaN(usage)) throw new Error(`Bad Wikipedia row: ${JSON.stringify(cells)}`);
      return { name, boroughs, opened, usage };
    }),
  };
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

async function main() {
  const [tfl, wikipedia] = await Promise.all([fetchTfl(), fetchWikipedia()]);

  // Wikipedia lists Paddington, Edgware Road and Hammersmith twice. Merge them, keeping the
  // earliest opening year. Their usage is summed, unless both rows repeat one combined figure.
  const wikipediaByKey = new Map<string, WikipediaRow>();
  for (const row of wikipedia.rows) {
    const key = nameKey(row.name);
    const seen = wikipediaByKey.get(key);
    if (!seen) {
      wikipediaByKey.set(key, row);
      continue;
    }
    if (seen.boroughs.join() !== row.boroughs.join()) throw new Error(`The two ${row.name} rows disagree on borough`);
    seen.opened = Math.min(seen.opened, row.opened);
    if (seen.usage !== row.usage) seen.usage = round(seen.usage + row.usage, 2);
  }

  // Group TfL stops by their cleaned name, so each name players might type is one station.
  const stopsByName = new Map<string, typeof tfl.stops>();
  for (const stop of tfl.stops) {
    const name = cleanTflName(stop.name);
    stopsByName.set(name, [...(stopsByName.get(name) ?? []), stop]);
  }

  const idByNaptan = new Map<string, string>();
  const unmatched: string[] = [];
  const stations: Station[] = [];
  for (const [name, stops] of stopsByName) {
    const id = slugify(name);
    const info = wikipediaByKey.get(nameKey(name));
    if (!info) {
      unmatched.push(name);
      continue;
    }
    wikipediaByKey.delete(nameKey(name));
    for (const stop of stops) idByNaptan.set(stop.id, id);
    stations.push({
      id,
      name,
      lines: LINES.map((line) => line.id).filter((line) => stops.some((stop) => stop.lines.has(line))),
      zones: [...new Set(stops.flatMap((stop) => parseZones(stop.zone)))].sort((a, b) => a - b),
      lat: round(stops.reduce((sum, stop) => sum + stop.lat, 0) / stops.length, 6),
      lon: round(stops.reduce((sum, stop) => sum + stop.lon, 0) / stops.length, 6),
      boroughs: info.boroughs,
      opened: info.opened,
      usage: info.usage,
      naptanIds: stops.map((stop) => stop.id).sort(),
    });
  }
  if (unmatched.length > 0 || wikipediaByKey.size > 0) {
    throw new Error(
      `Could not match TfL stations ${JSON.stringify(unmatched)} with Wikipedia rows ${JSON.stringify([...wikipediaByKey.keys()])}`,
    );
  }

  const edges = new Map<string, Edge>();
  for (const edge of tfl.edges) {
    const [a, b] = [idByNaptan.get(edge.a)!, idByNaptan.get(edge.b)!].sort();
    if (a === b) continue;
    edges.set(`${edge.line}:${a}:${b}`, { a: a!, b: b!, line: edge.line });
  }

  // Each route appears once per direction; keep one of each pair.
  const routes = new Map<string, Route>();
  for (const route of tfl.routes) {
    const ids = route.naptanIds.map((naptanId) => idByNaptan.get(naptanId)!);
    const forward = `${route.line}:${ids.join()}`;
    const backward = `${route.line}:${[...ids].reverse().join()}`;
    if (!routes.has(forward) && !routes.has(backward)) routes.set(forward, { line: route.line, stations: ids });
  }

  const network: Network = {
    builtAt: new Date().toISOString().slice(0, 10),
    usageYear: wikipedia.usageYear,
    stations: stations.sort((a, b) => a.name.localeCompare(b.name)),
    edges: [...edges.values()].sort((x, y) => `${x.line}${x.a}${x.b}`.localeCompare(`${y.line}${y.a}${y.b}`)),
    routes: [...routes.values()],
  };
  await Bun.write(OUTPUT, `${JSON.stringify(network, null, 1)}\n`);
  console.log(
    `Wrote ${network.stations.length} stations, ${network.edges.length} edges and ${network.routes.length} routes to data/network.json`,
  );
}

await main();
