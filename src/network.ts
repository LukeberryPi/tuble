import type { LineId } from "./lines.ts";

export type Station = {
  /** URL-safe id from the name, e.g. "kings-cross-st-pancras". */
  id: string;
  /** Name as TfL writes it, e.g. "King's Cross St. Pancras". */
  name: string;
  /** Tube lines first, then Overground lines. */
  lines: LineId[];
  /** Fare zones. Stations on a zone boundary have two, e.g. [2, 3]. Watford Junction is outside the zones and has none. */
  zones: number[];
  lat: number;
  lon: number;
  /** Local authorities, e.g. ["Camden"] or ["Epping Forest"]. Stations on a boundary have two. */
  boroughs: string[];
  /** Year the station first opened on the Underground. Null for stations only on the Overground. */
  opened: number | null;
  /** Entries plus exits per year, in millions. A few stations show 0 for the year; prompts treat that as unknown. */
  usage: number;
  /** TfL stop ids merged into this station: an interchange like Highbury & Islington has a Tube and an Overground one. */
  naptanIds: string[];
};

/** Track between two neighbouring stations on one line. */
export type Edge = { a: string; b: string; line: LineId };

/** A journey trains run from end to end, e.g. Edgware to Morden via Bank. Stations are in order. */
export type Route = { line: LineId; stations: string[] };

export type Network = {
  builtAt: string;
  /** The year the usage figures are for. */
  usageYear: number;
  stations: Station[];
  edges: Edge[];
  routes: Route[];
  /** Names of stations near London on other railways (National Rail, DLR, trams), which aren't in the game. */
  otherStations: string[];
};
