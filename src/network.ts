import type { LineId } from "./lines.ts";

export type Station = {
  /** URL-safe id from the name, e.g. "kings-cross-st-pancras". */
  id: string;
  /** Name as TfL writes it, e.g. "King's Cross St. Pancras". */
  name: string;
  /** In the order of LINES: Tube lines, then Overground lines, then the Elizabeth line, DLR and trams. */
  lines: LineId[];
  /**
   * Fare zones. Stations on a zone boundary have two, e.g. [2, 3]. Stations outside the zones, like
   * Watford Junction and Reading, have none, and so do tram stops: trams don't use zones.
   */
  zones: number[];
  lat: number;
  lon: number;
  /** Local authorities, e.g. ["Camden"] or ["Epping Forest"]. Stations on a boundary have two. */
  boroughs: string[];
  /** Year the station first opened on the Underground. Null for stations not on the Tube. */
  opened: number | null;
  /**
   * Entries plus exits per year, in millions. A few stations show 0 for the year; prompts treat that as unknown.
   * Tram stops all get the same estimate, since trams aren't counted stop by stop.
   */
  usage: number;
  /** TfL stop ids merged into this station: an interchange like Canary Wharf has Tube, DLR and Elizabeth line ones. */
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
  /** Names of National Rail stations near London, which aren't in the game. */
  otherStations: string[];
};
