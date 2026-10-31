/** The 11 Underground lines, with TfL's ids and colours. */
export const LINES = [
  { id: "bakerloo", name: "Bakerloo", colour: "#B36305" },
  { id: "central", name: "Central", colour: "#E32017" },
  { id: "circle", name: "Circle", colour: "#FFD300" },
  { id: "district", name: "District", colour: "#00782A" },
  { id: "hammersmith-city", name: "Hammersmith & City", colour: "#F3A9BB" },
  { id: "jubilee", name: "Jubilee", colour: "#A0A5A9" },
  { id: "metropolitan", name: "Metropolitan", colour: "#9B0056" },
  { id: "northern", name: "Northern", colour: "#000000" },
  { id: "piccadilly", name: "Piccadilly", colour: "#003688" },
  { id: "victoria", name: "Victoria", colour: "#0098D4" },
  { id: "waterloo-city", name: "Waterloo & City", colour: "#95CDBA" },
] as const;

export type Line = (typeof LINES)[number];
export type LineId = Line["id"];

const LINES_BY_ID = new Map<string, Line>(LINES.map((line) => [line.id, line]));

export function getLine(id: LineId): Line {
  const line = LINES_BY_ID.get(id);
  if (!line) throw new Error(`Unknown line: ${id}`);
  return line;
}
