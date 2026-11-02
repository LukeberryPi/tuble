/** The 11 Underground lines and the 6 Overground lines, with TfL's ids and colours. */
export const LINES = [
  { id: "bakerloo", name: "Bakerloo", colour: "#B36305", mode: "tube" },
  { id: "central", name: "Central", colour: "#E32017", mode: "tube" },
  { id: "circle", name: "Circle", colour: "#FFD300", mode: "tube" },
  { id: "district", name: "District", colour: "#00782A", mode: "tube" },
  { id: "hammersmith-city", name: "Hammersmith & City", colour: "#F3A9BB", mode: "tube" },
  { id: "jubilee", name: "Jubilee", colour: "#A0A5A9", mode: "tube" },
  { id: "metropolitan", name: "Metropolitan", colour: "#9B0056", mode: "tube" },
  { id: "northern", name: "Northern", colour: "#000000", mode: "tube" },
  { id: "piccadilly", name: "Piccadilly", colour: "#003688", mode: "tube" },
  { id: "victoria", name: "Victoria", colour: "#0098D4", mode: "tube" },
  { id: "waterloo-city", name: "Waterloo & City", colour: "#95CDBA", mode: "tube" },
  { id: "liberty", name: "Liberty", colour: "#606667", mode: "overground" },
  { id: "lioness", name: "Lioness", colour: "#EF9600", mode: "overground" },
  { id: "mildmay", name: "Mildmay", colour: "#2774AE", mode: "overground" },
  { id: "suffragette", name: "Suffragette", colour: "#5BA763", mode: "overground" },
  { id: "weaver", name: "Weaver", colour: "#893B67", mode: "overground" },
  { id: "windrush", name: "Windrush", colour: "#D22730", mode: "overground" },
] as const;

export type Line = (typeof LINES)[number];
export type LineId = Line["id"];
export type Mode = Line["mode"];

export const TUBE_LINES = LINES.filter((line) => line.mode === "tube");
export const OVERGROUND_LINES = LINES.filter((line) => line.mode === "overground");

const LINES_BY_ID = new Map<string, Line>(LINES.map((line) => [line.id, line]));

export function getLine(id: LineId): Line {
  const line = LINES_BY_ID.get(id);
  if (!line) throw new Error(`Unknown line: ${id}`);
  return line;
}

export function isTubeLine(id: string): boolean {
  return LINES_BY_ID.get(id)?.mode === "tube";
}

export function isOvergroundLine(id: string): boolean {
  return LINES_BY_ID.get(id)?.mode === "overground";
}
