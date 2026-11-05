import type { TierId } from "../src/game/score.ts";

/** What the score image shows. Points only, never stations, so it can't spoil the day for anyone. */
export type ScoreCard = {
  number: number;
  /** Already formatted, like "Thu 5 Nov". */
  date: string;
  replay: boolean;
  score: number;
  best: number;
  rounds: { points: number; tier: TierId; interchange: boolean }[];
  host: string;
};

const SIZE = 1080;
const BLUE = "#0019a8";
const RED = "#dc241f";
const YELLOW = "#ffd300";
const AMBER = "#ffb000";
const INK = "#10131a";
/** The same colours as the results train on the site. */
const TIER_COLOURS: Record<TierId, string> = {
  "rush-hour": "#dc241f",
  "off-peak": "#00782a",
  "night-tube": "#1c1f5e",
  "ghost-station": "#6950a1",
  "lost-train": "#f2a900",
};

const SIGN = '"Hammersmith One", "Helvetica Neue", Arial, sans-serif';
/** Hammersmith One's 1 looks like a capital I, so digits come from Lato Bold, as on the site. */
const DIGITS = `"tuble digits", ${SIGN}`;
const BOARD = '"Doto", ui-monospace, monospace';

/** The pigeon from the social card, drawn 40 by 32. */
const PIGEON = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="32" viewBox="0 0 40 32"><path d="M8 22 Q4 18 2 22 L0 25 Q6 25 10 24 Z" fill="#5b6470"/><ellipse cx="18" cy="20" rx="11" ry="7.5" fill="#8d97a3"/><path d="M11 17 Q18 12 26 18 Q20 22 11 17 Z" fill="#6f7a87"/><path d="M12 21 H22 M12 23.4 H20" stroke="#4d5560" stroke-width="1.2"/><path d="M24 15 Q25 9 30 9 Q34 9 34.5 13 Q34 17 28 19 Z" fill="#7d8894"/><path d="M25 16 Q28 13 31 15 Q29 19 25 18 Z" fill="#5fa58b" opacity="0.9"/><circle cx="31" cy="11.6" r="1.3" fill="#f2a33a"/><circle cx="31.2" cy="11.6" r="0.6" fill="#111"/><path d="M34.3 12.2 L38 13.4 L34.2 14.2 Z" fill="#3f454c"/><path d="M17 27 V31 M15 31 H19 M22 27 V31 M20 31 H24" stroke="#d27a63" stroke-width="1.2" stroke-linecap="round"/></svg>`;

/** Draws the score image as a 1080 × 1080 PNG, in the style of the social card. */
export async function scoreImage(card: ScoreCard): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`40px ${SIGN}`, "TUBLE"),
    document.fonts.load(`40px ${DIGITS}`, "0123456789"),
    document.fonts.load(`800 40px ${BOARD}`, "NO."),
  ]).catch(() => undefined);
  const pigeon = new Image();
  pigeon.src = `data:image/svg+xml,${encodeURIComponent(PIGEON)}`;
  await pigeon.decode().catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  wall(ctx);
  roundel(ctx, 540, 262, 158);
  board(ctx, card);
  scoreSign(ctx, `${card.score} / ${card.best}`);
  const edge = 954;
  const roofs = train(ctx, card.rounds, edge);
  platform(ctx, edge, card.host);
  // Perched on the second carriage, clear of the Interchange circle.
  const perch = roofs[1];
  if (perch && pigeon.naturalWidth) ctx.drawImage(pigeon, perch.x - 52, perch.y - 74, 96, 77);
  vignette(ctx);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image export failed"))), "image/png"),
  );
}

function wall(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#c9cec8";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#f1f3ef";
  for (let row = 0; row * 15 < SIZE; row++) {
    const offset = row % 2 ? -15 : 0;
    for (let x = offset; x < SIZE; x += 30) {
      ctx.beginPath();
      ctx.roundRect(x + 1, row * 15 + 1, 28, 13, 2);
      ctx.fill();
    }
  }
  const light = ctx.createLinearGradient(0, 0, 0, SIZE);
  light.addColorStop(0, "rgb(255 255 255 / 0.45)");
  light.addColorStop(0.4, "rgb(255 255 255 / 0)");
  light.addColorStop(1, "rgb(0 0 0 / 0.12)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // The blue frieze along the top of the wall.
  ctx.fillStyle = "#0b1b78";
  ctx.fillRect(0, 34, SIZE, 36);
  ctx.fillStyle = "#1532b4";
  for (let x = 0; x < SIZE; x += 36) ctx.fillRect(x, 34, 34, 36);
  ctx.fillStyle = "#0a1050";
  ctx.fillRect(0, 32, SIZE, 3);
  ctx.fillRect(0, 69, SIZE, 3);
}

function shadow(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.shadowColor = "rgb(0 0 0 / 0.22)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  draw();
  ctx.restore();
}

/** The same proportions as the favicon and the social card. */
function roundel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const barWidth = r * 2.47;
  const barHeight = r * 0.4;
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * 1.65) / 2, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.35;
    ctx.strokeStyle = RED;
    ctx.stroke();
    ctx.fillStyle = BLUE;
    ctx.fillRect(cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight);
  });
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.round(barHeight * 0.75)}px ${SIGN}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TUBLE", cx, cy + barHeight * 0.04);
}

/** The dot-matrix board, as on the site. */
function board(ctx: CanvasRenderingContext2D, card: ScoreCard) {
  const x = 170;
  const y = 482;
  const width = SIZE - x * 2;
  const height = 76;
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fillStyle = "#2a2d33";
    ctx.fill();
  });
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 5, width - 10, height - 10, 8);
  ctx.fillStyle = "#0a0b0d";
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgb(255 176 0 / 0.08)";
  for (let dx = x; dx < x + width; dx += 6) for (let dy = y; dy < y + height; dy += 6) ctx.fillRect(dx, dy, 1.6, 1.6);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = AMBER;
  ctx.shadowColor = "rgb(255 176 0 / 0.55)";
  ctx.shadowBlur = 10;
  ctx.font = `800 34px ${BOARD}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`No. ${card.number}${card.replay ? " replay" : ""}`, x + 28, y + height / 2 + 2);
  ctx.textAlign = "right";
  ctx.fillText(card.date, x + width - 28, y + height / 2 + 2);
  ctx.restore();
}

/** The score on an enamel sign, like the tagline on the social card. */
function scoreSign(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = `120px ${DIGITS}`;
  const width = ctx.measureText(text).width + 120;
  const y = 602;
  const height = 150;
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(540 - width / 2, y, width, height, 14);
    ctx.fillStyle = BLUE;
    ctx.fill();
  });
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 540, y + height / 2 + 4);
}

/** The results train from the site, with each carriage showing its question's points. Returns the middle of each roof. */
function train(ctx: CanvasRenderingContext2D, rounds: ScoreCard["rounds"], bottom: number): { x: number; y: number }[] {
  const gap = 8;
  const cab = 56;
  const car = 114;
  const height = 118;
  const top = bottom - height;
  const left = (SIZE - (cab + rounds.length * (car + gap))) / 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#2b3138";

  // The cab, facing left.
  ctx.beginPath();
  ctx.roundRect(left, top, cab + 6, height, [40, 6, 6, 16]);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#1c2630";
  ctx.fillRect(left, top, cab + 6, height * 0.42);
  ctx.fillStyle = RED;
  ctx.fillRect(left, top + height * 0.42, cab + 6, height);
  ctx.restore();
  ctx.stroke();

  return rounds.map((round, i) => {
    const x = left + cab + gap + i * (car + gap);
    ctx.beginPath();
    ctx.roundRect(x, top, car, height, [12, 12, 6, 6]);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#fdfdfb";
    ctx.fillRect(x, top, car, height);
    ctx.fillStyle = TIER_COLOURS[round.tier];
    ctx.fillRect(x, top + height * 0.72, car, height);
    ctx.restore();
    ctx.stroke();

    const windowWidth = car * 0.8;
    const windowHeight = height * 0.54;
    const windowTop = top + height * 0.1;
    ctx.beginPath();
    ctx.roundRect(x + (car - windowWidth) / 2, windowTop, windowWidth, windowHeight, 8);
    ctx.fillStyle = "#dfe7ec";
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `46px ${DIGITS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(round.points), x + car / 2, windowTop + windowHeight / 2 + 2, windowWidth - 10);

    // The Interchange round gets an interchange circle on its roof, as on the site.
    if (round.interchange) {
      ctx.beginPath();
      ctx.arc(x + car / 2, top - 6, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#2b3138";
    }
    return { x: x + car / 2, y: top };
  });
}

function platform(ctx: CanvasRenderingContext2D, top: number, host: string) {
  ctx.fillStyle = "#5a5e63";
  ctx.fillRect(0, top, SIZE, 30);
  ctx.fillStyle = "#f4f4f0";
  ctx.font = `17px ${SIGN}`;
  ctx.letterSpacing = "3px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 135; x < SIZE; x += 270) ctx.fillText("MIND THE GAP", x, top + 16);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, top + 30, SIZE, 10);
  ctx.fillStyle = "#8e9294";
  ctx.fillRect(0, top + 40, SIZE, SIZE - top - 40);
  ctx.fillStyle = "#f4f4f0";
  ctx.font = `40px ${SIGN}`;
  ctx.fillText(host, 540, top + 40 + (SIZE - top - 40) / 2 + 2);
}

function vignette(ctx: CanvasRenderingContext2D) {
  const shade = ctx.createRadialGradient(540, 432, 0, 540, 432, SIZE * 0.78);
  shade.addColorStop(0.6, "rgb(0 0 0 / 0)");
  shade.addColorStop(1, "rgb(0 0 0 / 0.3)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, SIZE, SIZE);
}
