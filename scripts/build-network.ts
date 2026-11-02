/**
 * Builds data/network.json: every Underground and Overground station with its lines, zones,
 * position, borough, opening year and usage, plus the track between neighbouring stations.
 *
 * Sources:
 * - TfL Unified API route sequences: stations, zones, coordinates, the order of stops and the
 *   end-to-end routes trains run, for every Tube and Overground line.
 * - Wikipedia's "List of London Underground stations": borough, opening year and annual usage
 *   of Tube stations.
 * - TfL's annual station counts: usage of stations only on the Overground.
 * - postcodes.io: the borough of stations only on the Overground, from their coordinates.
 *
 * Run with `bun run data:network`. Set TFL_APP_KEY to avoid TfL's anonymous rate limit.
 * Reading TfL's counts spreadsheet needs the `unzip` command.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, type HTMLElement } from "node-html-parser";
import { ALIASES, looseKey } from "../src/game/match.ts";
import { kmBetween } from "../src/geo.ts";
import { LINES, isTubeLine, type LineId } from "../src/lines.ts";
import { nameKey, slugify } from "../src/names.ts";
import type { Edge, Network, Route, Station } from "../src/network.ts";

const OUTPUT = new URL("../data/network.json", import.meta.url);
const USER_AGENT = "tuble-data/0.1 (https://github.com/LukeberryPi/tuble)";
const WIKIPEDIA_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_London_Underground_stations&prop=text&format=json&formatversion=2";
/** TfL's annualised entries and exits for the year Wikipedia's Tube figures are from. */
const COUNTS_YEAR = 2024;
const COUNTS_URL =
  "https://s3-eu-west-1.amazonaws.com/crowding.data.tfl.gov.uk/Annual%20Station%20Counts/2024/AC2024_AnnualisedEntryExit_Public.xlsx";

type TflStop = { id: string; name: string; zone?: string; lat: number; lon: number };
type TflRouteSequence = {
  stopPointSequences: { stopPoint: TflStop[] }[];
  orderedLineRoutes: { naptanIds: string[] }[];
};
type WikipediaRow = { name: string; boroughs: string[]; opened: number; usage: number };

/** Wikipedia links some boroughs by a short name. */
const BOROUGH_NAMES: Record<string, string> = { Richmond: "Richmond upon Thames" };
/** postcodes.io names a few districts differently from Wikipedia. */
const DISTRICT_NAMES: Record<string, string> = { Westminster: "City of Westminster" };

/** Overground names that TfL writes differently from the signs on the platform. */
const OVERGROUND_NAMES: Record<string, string> = {
  "London Euston": "Euston",
  "London Liverpool Street": "Liverpool Street",
  "New Cross ELL": "New Cross",
  "Walthamstow Queens Road": "Walthamstow Queen's Road",
};

/** TfL's route data has no zone for these. Watford Junction is outside the zones altogether. */
const ZONES: Record<string, number[]> = { "Clapham Junction": [2], "Watford Junction": [] };

/**
 * Other railways in London. Their stations aren't in the game, but players will type them, and
 * "East Croydon" shouldn't be mistaken for West Croydon.
 */
const OTHER_LINES = [
  "dlr", "elizabeth", "tram", "avanti-west-coast", "c2c", "chiltern-railways", "gatwick-express", "greater-anglia",
  "great-northern", "great-western-railway", "heathrow-express", "southeastern", "southern", "south-western-railway",
  "thameslink", "west-midlands-trains",
];
/** Other stations further than this from Charing Cross are too far out to be typed by mistake. */
const OTHER_STATIONS_KM = 35;
const CHARING_CROSS = { lat: 51.508, lon: -0.1247 };

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init?.headers } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return (await response.json()) as T;
}

/**
 * "Edgware Road (Circle Line) Underground Station" -> "Edgware Road". Keeps "Kensington (Olympia)".
 * "Richmond (London) Rail Station" -> "Richmond".
 */
function cleanTflName(raw: string): string {
  const name = raw
    .replace(/\s*Underground Station$/, "")
    .replace(/-Underground$/, "")
    .replace(/\s*Rail Station$/, "")
    .replace(/\s*\((?:Bakerloo|Central|Circle Line|H&C Line|Dist&Picc Line|London)\)/, "")
    .trim();
  return OVERGROUND_NAMES[name] ?? name;
}

/** "2+3" or "2/3" -> [2, 3]. */
function parseZones(name: string, zone: string | undefined): number[] {
  if (name in ZONES) return ZONES[name]!;
  const zones = [...(zone ?? "").matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (zones.length === 0) throw new Error(`No zone for ${name}: "${zone}"`);
  return zones;
}

type Stop = TflStop & { lines: Set<LineId> };

async function fetchTfl() {
  const key = process.env.TFL_APP_KEY ? `?app_key=${process.env.TFL_APP_KEY}` : "";
  const stops = new Map<string, Stop>();
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

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Reads the first sheet of an .xlsx file: one record per row, keyed by column letter. */
async function readSpreadsheet(url: string): Promise<Record<string, string>[]> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const path = join(tmpdir(), `tuble-counts-${Date.now()}.xlsx`);
  await Bun.write(path, await response.arrayBuffer());
  const unzip = (entry: string) => {
    const result = Bun.spawnSync(["unzip", "-p", path, entry]);
    if (result.exitCode !== 0) throw new Error(`Couldn't read ${entry} from ${url}`);
    return result.stdout.toString();
  };

  const strings = [...unzip("xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs)].map(([, item]) =>
    [...item!.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(([, text]) => decodeXml(text!)).join(""),
  );
  return [...unzip("xl/worksheets/sheet1.xml").matchAll(/<row[^>]*>(.*?)<\/row>/gs)].map(([, row]) => {
    const cells: Record<string, string> = {};
    for (const [, column, attributes, body] of row!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const value = body?.match(/<v>(.*?)<\/v>/s)?.[1] ?? "";
      cells[column!] = /\bt="s"/.test(attributes!) ? strings[Number(value)]! : decodeXml(value);
    }
    return cells;
  });
}

/**
 * Overground usage in millions, by name key. TfL counts a station shared with another mode once,
 * under that mode: most interchanges with the Tube are in the Tube's figure, and Romford is in
 * the Elizabeth line's. A few interchanges have their Overground station counted separately,
 * like Bethnal Green's, which is a different building from the Tube station.
 */
async function fetchOvergroundUsage(): Promise<Map<string, number>> {
  const rows = await readSpreadsheet(COUNTS_URL);
  // Columns: A mode, D station, S annualised entries and exits.
  const usage = new Map<string, number>();
  for (const row of rows.filter((row) => row.A === "LO")) {
    const station = row.D!;
    let count = Number(row.S);
    if (!Number.isFinite(count)) {
      if (rows.some((other) => other.A === "LU" && other.D === station)) continue;
      count = Number(rows.find((other) => other.D === station && Number.isFinite(Number(other.S)))?.S);
    }
    if (!(count > 0)) throw new Error(`No Overground count for ${station}: "${row.S}"`);
    const name = station.replace(/ (LO|NR)$/, "").replace(/ Jn$/, " Junction");
    usage.set(nameKey(name), round(count / 1e6, 2));
  }
  return usage;
}

/**
 * Names of stations on other railways near London, as players would type them. Names the game
 * already understands are left out: "Richmond (London)" is our Richmond, "London King's Cross"
 * our King's Cross St. Pancras, and "Tooting" should still offer Tooting Bec or Tooting Broadway.
 */
async function fetchOtherStations(ours: { name: string; id: string }[]): Promise<string[]> {
  const ourKeys = ours.flatMap((station) => [looseKey(station.name), ...(ALIASES[station.id] ?? []).map(looseKey)]);
  const understood = (name: string) => ourKeys.some((key) => key.startsWith(looseKey(name)));
  const key = process.env.TFL_APP_KEY ? `?app_key=${process.env.TFL_APP_KEY}` : "";
  const names = new Set<string>();
  for (const line of OTHER_LINES) {
    const stops = await getJson<{ commonName: string; lat: number; lon: number }[]>(`https://api.tfl.gov.uk/Line/${line}/StopPoints${key}`);
    for (const stop of stops) {
      if (kmBetween(stop, CHARING_CROSS) > OTHER_STATIONS_KM) continue;
      const full = stop.commonName.replace(/\s*(Rail Station|DLR Station|Tram Stop|Station)$/, "").replace(/ LL$/, "").trim();
      const plain = full.replace(/\s*\([^)]*\)/g, "").trim();
      const forms = [...new Set([plain, plain.replace(/^London /, "")])];
      if ([full, cleanTflName(full), ...forms].some(understood)) continue;
      for (const form of forms) names.add(form);
    }
  }
  return [...names].sort();
}

/** The borough at each point, from the nearest postcode. */
async function fetchBoroughs(points: { lat: number; lon: number }[]): Promise<string[]> {
  type Lookup = { result: { result: { admin_district: string }[] | null }[] };
  const boroughs: string[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const geolocations = points.slice(i, i + 100).map(({ lat, lon }) => ({ latitude: lat, longitude: lon, radius: 2000, limit: 1 }));
    const data = await getJson<Lookup>("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ geolocations }),
    });
    for (const { result } of data.result) {
      const district = result?.[0]?.admin_district;
      if (!district) throw new Error("No postcode near an Overground station");
      boroughs.push(DISTRICT_NAMES[district] ?? district);
    }
  }
  return boroughs;
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/** Where the station is: the middle of its platforms. */
function centre(stops: Stop[]) {
  return {
    lat: round(stops.reduce((sum, stop) => sum + stop.lat, 0) / stops.length, 6),
    lon: round(stops.reduce((sum, stop) => sum + stop.lon, 0) / stops.length, 6),
  };
}

async function main() {
  const [tfl, wikipedia, overgroundUsage] = await Promise.all([fetchTfl(), fetchWikipedia(), fetchOvergroundUsage()]);
  if (wikipedia.usageYear !== COUNTS_YEAR) {
    throw new Error(`Wikipedia's Tube usage is for ${wikipedia.usageYear}; point COUNTS_URL at TfL's counts for that year`);
  }

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

  // Group TfL stops by name, so each name players might type is one station. That merges the
  // Tube and Overground halves of interchanges like Highbury & Islington.
  const stopsByKey = new Map<string, { name: string; stops: Stop[] }>();
  for (const stop of tfl.stops) {
    const name = cleanTflName(stop.name);
    const key = nameKey(name);
    const group = stopsByKey.get(key) ?? { name, stops: [] };
    // The Tube's spelling wins: "Shepherd's Bush" over the Overground's "Shepherds Bush".
    if ([...stop.lines].some(isTubeLine)) group.name = name;
    group.stops.push(stop);
    stopsByKey.set(key, group);
  }

  const groups = [...stopsByKey.entries()].map(([key, { name, stops }]) => {
    const tubeStops = stops.filter((stop) => [...stop.lines].some(isTubeLine));
    return { key, name, stops, tube: tubeStops.length > 0, position: centre(tubeStops.length > 0 ? tubeStops : stops) };
  });
  const overgroundOnly = groups.filter((group) => !group.tube);
  const overgroundBoroughs = await fetchBoroughs(overgroundOnly.map((group) => group.position));

  const idByNaptan = new Map<string, string>();
  const unmatched: string[] = [];
  const stations: Station[] = [];
  for (const { key, name, stops, tube, position } of groups) {
    const id = slugify(name);
    let info: Pick<Station, "boroughs" | "opened" | "usage">;
    if (tube) {
      const row = wikipediaByKey.get(key);
      if (!row) {
        unmatched.push(name);
        continue;
      }
      wikipediaByKey.delete(key);
      // A few interchanges have their Overground station counted separately.
      const extra = overgroundUsage.get(key) ?? 0;
      info = { boroughs: row.boroughs, opened: row.opened, usage: round(row.usage + extra, 2) };
    } else {
      const usage = overgroundUsage.get(key);
      if (usage === undefined) throw new Error(`No usage figure for ${name}`);
      info = { boroughs: [overgroundBoroughs[overgroundOnly.findIndex((group) => group.key === key)]!], opened: null, usage };
    }
    for (const stop of stops) idByNaptan.set(stop.id, id);
    stations.push({
      id,
      name,
      lines: LINES.map((line) => line.id).filter((line) => stops.some((stop) => stop.lines.has(line))),
      zones: [...new Set(stops.flatMap((stop) => parseZones(name, stop.zone)))].sort((a, b) => a - b),
      ...position,
      ...info,
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
    otherStations: await fetchOtherStations(stations),
  };
  await Bun.write(OUTPUT, `${JSON.stringify(network, null, 1)}\n`);
  const overground = network.stations.filter((station) => !station.lines.some(isTubeLine)).length;
  console.log(
    `Wrote ${network.stations.length} stations (${overground} only on the Overground), ${network.edges.length} edges and ${network.routes.length} routes to data/network.json`,
  );
}

await main();
