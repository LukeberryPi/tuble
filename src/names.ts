/** A key for matching names from different sources: "King's Cross St. Pancras" -> "kings cross st pancras". */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A URL-safe id: "King's Cross St. Pancras" -> "kings-cross-st-pancras". */
export function slugify(name: string): string {
  return nameKey(name).replace(/ /g, "-");
}

/** The words in a name, lower case, ignoring "&" and punctuation: "Harrow-on-the-Hill" -> ["harrow", "on", "the", "hill"]. */
export function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/['’.]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
