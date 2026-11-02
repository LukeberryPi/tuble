/**
 * Draws the favicon, the home-screen icon and the social card: a roundel with TUBLE on the bar.
 * Text is turned into outlines, so the files look the same wherever they're shown.
 *
 *   bun run icons
 */
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FONT_URL = "https://github.com/google/fonts/raw/main/ofl/hammersmithone/HammersmithOne-Regular.ttf";
const BLUE = "#0019A8";
const RED = "#DC241F";
const YELLOW = "#FFD300";

/** The roundel's proportions, as fractions of the ring's outer radius. */
const INNER_RADIUS = 0.65;
const BAR_HEIGHT = 0.4;
const BAR_WIDTH = 2.47;
/** The lettering's capitals fill this much of the bar's height. */
const CAP_SHARE = 0.53;

async function loadFont(): Promise<opentype.Font> {
  const path = join(tmpdir(), "HammersmithOne-Regular.ttf");
  if (!(await Bun.file(path).exists())) {
    const response = await fetch(FONT_URL);
    if (!response.ok) throw new Error(`${FONT_URL}: ${response.status}`);
    await Bun.write(path, await response.arrayBuffer());
  }
  return opentype.parse(await Bun.file(path).arrayBuffer());
}

/** Outlines a line of text centred on `cx`, with its baseline at `baseline`. */
function textPath(font: opentype.Font, text: string, size: number, cx: number, baseline: number, spacing = 0): { d: string; width: number } {
  const glyphs = font.stringToGlyphs(text);
  const scale = size / font.unitsPerEm;
  const advances = glyphs.map((glyph, i) => {
    const kerning = i < glyphs.length - 1 ? font.getKerningValue(glyph, glyphs[i + 1]!) : 0;
    return (glyph.advanceWidth! + kerning) * scale + (i < glyphs.length - 1 ? spacing * size : 0);
  });
  const width = advances.reduce((sum, advance) => sum + advance, 0);
  let x = cx - width / 2;
  const d = glyphs
    .map((glyph, i) => {
      const path = glyph.getPath(x, baseline, size).toPathData(2);
      x += advances[i]!;
      return path;
    })
    .join("");
  return { d, width };
}

function capHeight(font: opentype.Font): number {
  return font.tables.os2!.sCapHeight / font.unitsPerEm;
}

function roundel(font: opentype.Font, cx: number, cy: number, r: number, name = "TUBLE"): string {
  const barWidth = r * BAR_WIDTH;
  const barHeight = r * BAR_HEIGHT;
  const caps = barHeight * CAP_SHARE;
  const label = textPath(font, name, caps / capHeight(font), cx, cy + caps / 2);
  return [
    `<circle cx="${cx}" cy="${cy}" r="${(r * (1 + INNER_RADIUS)) / 2}" fill="none" stroke="${RED}" stroke-width="${r * (1 - INNER_RADIUS)}"/>`,
    `<rect x="${cx - barWidth / 2}" y="${cy - barHeight / 2}" width="${barWidth}" height="${barHeight}" fill="${BLUE}"/>`,
    `<path d="${label.d}" fill="#fff"/>`,
  ].join("");
}

function svg(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function png(source: string, width: number): Buffer {
  return new Resvg(source, { fitTo: { mode: "width", value: width } }).render().asPng();
}

const PIGEON = `<path d="M8 22 Q4 18 2 22 L0 25 Q6 25 10 24 Z" fill="#5b6470"/><ellipse cx="18" cy="20" rx="11" ry="7.5" fill="#8d97a3"/><path d="M11 17 Q18 12 26 18 Q20 22 11 17 Z" fill="#6f7a87"/><path d="M12 21 H22 M12 23.4 H20" stroke="#4d5560" stroke-width="1.2"/><path d="M24 15 Q25 9 30 9 Q34 9 34.5 13 Q34 17 28 19 Z" fill="#7d8894"/><path d="M25 16 Q28 13 31 15 Q29 19 25 18 Z" fill="#5fa58b" opacity="0.9"/><circle cx="31" cy="11.6" r="1.3" fill="#f2a33a"/><circle cx="31.2" cy="11.6" r="0.6" fill="#111"/><path d="M34.3 12.2 L38 13.4 L34.2 14.2 Z" fill="#3f454c"/><path d="M17 27 V31 M15 31 H19 M22 27 V31 M20 31 H24" stroke="#d27a63" stroke-width="1.2" stroke-linecap="round"/>`;

function socialCard(font: opentype.Font): string {
  const width = 1200;
  const height = 630;
  const tiles = `<pattern id="tiles" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#C9CEC8"/><g fill="#F1F3EF"><rect x="1" y="1" width="28" height="13" rx="2"/><rect x="31" y="1" width="28" height="13" rx="2"/><rect x="-14" y="16" width="28" height="13" rx="2"/><rect x="16" y="16" width="28" height="13" rx="2"/><rect x="46" y="16" width="28" height="13" rx="2"/></g></pattern>`;
  const frieze = `<pattern id="frieze" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="#0B1B78"/><rect width="34" height="36" fill="#1532B4"/></pattern>`;
  const light = `<linearGradient id="light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="0.4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>`;
  const vignette = `<radialGradient id="vignette" cx="0.5" cy="0.4" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.32"/></radialGradient>`;
  const shadow = `<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.22"/></filter>`;

  const tagline = textPath(font, "Name the station nobody else will.", 42, width / 2, 0);
  const signWidth = tagline.width + 88;
  const signTop = 466;
  const signHeight = 74;
  const taglineBaseline = signTop + signHeight / 2 + (42 * capHeight(font)) / 2;
  const edgeTop = 582;
  const mind = Array.from({ length: 4 }, (_, i) => textPath(font, "MIND THE GAP", 15, 150 + i * 300, edgeTop + 19, 0.18).d).join("");

  return svg(
    width,
    height,
    [
      `<defs>${tiles}${frieze}${light}${vignette}${shadow}</defs>`,
      `<rect width="${width}" height="${height}" fill="url(#tiles)"/>`,
      `<rect width="${width}" height="${height}" fill="url(#light)"/>`,
      `<rect y="34" width="${width}" height="36" fill="url(#frieze)"/>`,
      `<rect y="32" width="${width}" height="3" fill="#0A1050"/><rect y="69" width="${width}" height="3" fill="#0A1050"/>`,
      `<g filter="url(#shadow)">${roundel(font, 600, 256, 168)}</g>`,
      `<rect x="${width / 2 - signWidth / 2}" y="${signTop}" width="${signWidth}" height="${signHeight}" rx="10" fill="${BLUE}" filter="url(#shadow)"/>`,
      `<path d="${textPath(font, "Name the station nobody else will.", 42, width / 2, taglineBaseline).d}" fill="#fff"/>`,
      `<rect y="${edgeTop}" width="${width}" height="26" fill="#5A5E63"/>`,
      `<path d="${mind}" fill="#F4F4F0"/>`,
      `<rect y="${edgeTop + 26}" width="${width}" height="8" fill="${YELLOW}"/>`,
      `<rect y="${edgeTop + 34}" width="${width}" height="${height - edgeTop - 34}" fill="#8E9294"/>`,
      `<g transform="translate(244 ${edgeTop + 22 - 31 * 3}) scale(3)">${PIGEON}</g>`,
      `<rect width="${width}" height="${height}" fill="url(#vignette)"/>`,
    ].join(""),
  );
}

const font = await loadFont();
const public_ = join(import.meta.dir, "..", "public");

// The favicon is the roundel alone, in a square.
const side = 250;
const favicon = svg(side, side, roundel(font, side / 2, side / 2, side / BAR_WIDTH));
await Bun.write(join(public_, "favicon.svg"), `${favicon}\n`);
await Bun.write(join(public_, "favicon-32.png"), png(favicon, 32));

// iOS draws transparent icons on black, so the home-screen icon gets a white tile.
const touch = svg(180, 180, `<rect width="180" height="180" fill="#fff"/>${roundel(font, 90, 90, 150 / BAR_WIDTH)}`);
await Bun.write(join(public_, "apple-touch-icon.png"), png(touch, 180));

await Bun.write(join(public_, "og.png"), png(socialCard(font), 1200));
console.log("Wrote favicon.svg, favicon-32.png, apple-touch-icon.png and og.png to public/");
