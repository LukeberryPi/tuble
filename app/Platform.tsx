import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Roundel } from "./Roundel.tsx";

/**
 * Where the train is. It waits with its doors open while a prompt runs, and leaves when it ends:
 * with the player, or, when time runs out, with the pigeon.
 */
export type TrainState = "away" | "standing" | "leaving" | "leaving-with-pigeon";

const CAB = 130;
const CAR = 360;
const CARS = 5;
const TRAIN_WIDTH = CAB * 2 + CAR * CARS;
/** The middle carriage hides the roundel, and the pigeon waits by its first door. */
const MIDDLE_CAR = Math.floor(CARS / 2);
const DOORS = [64, 248];
const DOOR_WIDTH = 48;
const PIGEON_DOOR = CAB + MIDDLE_CAR * CAR + DOORS[0]! + DOOR_WIDTH / 2 - TRAIN_WIDTH / 2;

const STANDING = "translateX(-50%)";
const OFF_RIGHT = "translateX(calc(50vw + 2px))";
const OFF_LEFT = "translateX(calc(-50vw - 100%))";
const ARRIVE_MS = 1100;
const DEPART_MS = 1200;
/** Wide screens repeat the roundel along the wall, if the name is short enough to clear the posters. */
const REPEAT_MAX_LENGTH = 16;

type Styles = { transform?: string; opacity?: string };

/** Animates from wherever the element is now, so a train can leave before it has finished arriving. */
function move(element: HTMLElement, to: Styles, options: KeyframeAnimationOptions) {
  const style = getComputedStyle(element);
  const now: Required<Styles> = { transform: style.transform === "none" ? "none" : style.transform, opacity: style.opacity };
  const from = Object.fromEntries(Object.keys(to).map((key) => [key, now[key as keyof Styles]]));
  element.getAnimations().forEach((animation) => animation.cancel());
  Object.assign(element.style, to);
  element.animate([from, to as Keyframe], options);
}

function place(element: HTMLElement, styles: Styles) {
  element.getAnimations().forEach((animation) => animation.cancel());
  Object.assign(element.style, styles);
}

export function Platform({ station, train, urgent }: { station: string; train: TrainState; urgent: boolean }) {
  const trainRef = useRef<HTMLDivElement>(null);
  const pigeonRef = useRef<HTMLDivElement>(null);
  const previous = useRef<TrainState | null>(null);

  useLayoutEffect(() => {
    const carriage = trainRef.current!;
    const pigeon = pigeonRef.current!;
    const from = previous.current;
    if (from === train) return;
    previous.current = train;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const doors = (open: boolean) => (carriage.dataset.doors = open ? "open" : "closed");
    const stop = () => timers.forEach(clearTimeout);
    // Delayed animations rather than timers, so that skipping ahead can't strand the train or the pigeon.
    const pigeonReturns = (delay: number) => {
      if (pigeon.style.opacity !== "0") return;
      place(pigeon, { transform: "none", opacity: "0" });
      move(pigeon, { opacity: "1" }, { duration: 400, delay, fill: "backwards", easing: "ease" });
    };
    const leave = (delay: number) => {
      later(delay, () => doors(false));
      const departure = { delay: delay + 280, fill: "backwards" } as const;
      if (reduced) move(carriage, { opacity: "0" }, { ...departure, duration: 400, easing: "ease" });
      else move(carriage, { transform: OFF_LEFT }, { ...departure, duration: DEPART_MS, easing: "cubic-bezier(0.5, 0, 0.75, 0.4)" });
    };

    if (from === null) {
      const here = train === "standing";
      place(carriage, { transform: here ? STANDING : OFF_RIGHT, opacity: "1" });
      place(pigeon, { transform: "none", opacity: train === "leaving-with-pigeon" ? "0" : "1" });
      doors(here);
      carriage.dataset.pigeon = "";
      return;
    }

    if (train === "away") {
      // The train is already leaving; the pigeon comes back to see the score.
      doors(false);
      pigeonReturns(reduced ? 0 : DEPART_MS);
      return;
    }

    if (train === "standing") {
      carriage.dataset.pigeon = "";
      doors(false);
      if (reduced) {
        place(carriage, { transform: STANDING, opacity: "0" });
        move(carriage, { opacity: "1" }, { duration: 300, easing: "ease" });
        later(300, () => doors(true));
      } else {
        place(carriage, { transform: OFF_RIGHT, opacity: "1" });
        move(carriage, { transform: STANDING }, { duration: ARRIVE_MS, easing: "cubic-bezier(0.16, 0.84, 0.3, 1)" });
        later(ARRIVE_MS - 80, () => doors(true));
      }
      pigeonReturns(reduced ? 0 : ARRIVE_MS);
      return stop;
    }

    if (train === "leaving-with-pigeon") {
      if (reduced) move(pigeon, { opacity: "0" }, { duration: 250, easing: "ease" });
      else {
        place(pigeon, { transform: "translateY(-36%) scale(0.8)", opacity: "0" });
        pigeon.animate(
          [
            { transform: "none", opacity: 1 },
            { transform: "translateY(-70%) scale(0.92)", opacity: 1, offset: 0.55 },
            { transform: "translateY(-36%) scale(0.8)", opacity: 0 },
          ],
          { duration: 480, easing: "ease-out" },
        );
      }
      later(400, () => (carriage.dataset.pigeon = "aboard"));
      leave(700);
    } else leave(0);
    return stop;
  }, [train]);

  return (
    <div className="platform" aria-hidden>
      <div className="wall">
        <div className="frieze" />
        <div className="poster poster-pigeons">
          <span>Pigeons</span>
          <span>travel free</span>
        </div>
        <div className="poster poster-stand">
          <span>Stand</span>
          <span>on the right</span>
        </div>
        <Roundel name={station} className="wall-roundel" />
        {station.length <= REPEAT_MAX_LENGTH && (
          <>
            <Roundel name={station} className="wall-roundel wall-roundel-left" />
            <Roundel name={station} className="wall-roundel wall-roundel-right" />
          </>
        )}
      </div>
      <div className="track" />
      <div className="train" ref={trainRef} data-urgent={urgent || undefined}>
        <Train />
      </div>
      <div className="platform-edge">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="mind-the-gap">
            Mind the gap
          </span>
        ))}
      </div>
      <div className="pigeon" ref={pigeonRef} style={{ "--door": PIGEON_DOOR } as CSSProperties}>
        <svg viewBox="0 0 40 32" className="pigeon-svg">
          <PigeonShape pecking />
        </svg>
      </div>
    </div>
  );
}

/** A Tube train, drawn 100 units tall: a cab at each end and carriages between them. */
function Train() {
  return (
    <svg className="train-svg" viewBox={`0 0 ${TRAIN_WIDTH} 100`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="train-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfdfb" />
          <stop offset="0.7" stopColor="#e9ebe7" />
          <stop offset="1" stopColor="#d5d8d4" />
        </linearGradient>
        <linearGradient id="train-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef3f5" />
          <stop offset="1" stopColor="#cdd8de" />
        </linearGradient>
        {DOORS.map((left) => (
          <clipPath key={left} id={`door-${left}`}>
            <rect x={left} y="20" width={DOOR_WIDTH} height="66" />
          </clipPath>
        ))}
      </defs>
      <Cab x={0} />
      {Array.from({ length: CARS }, (_, i) => (
        <Carriage key={i} x={CAB + i * CAR} index={i} />
      ))}
      <Cab x={TRAIN_WIDTH} flip />
    </svg>
  );
}

function Cab({ x, flip = false }: { x: number; flip?: boolean }) {
  return (
    <g transform={flip ? `translate(${x} 0) scale(-1 1)` : `translate(${x} 0)`}>
      <rect x="126" y="10" width="8" height="78" fill="#2a2f36" />
      <rect x="20" y="88" width="96" height="6" rx="2" fill="#2a2f36" />
      <Bogie x={44} />
      <path d="M126 8 H52 Q30 8 20 22 L8 42 Q2 52 2 64 V86 H126 Z" fill="url(#train-body)" />
      <path d="M52 3 H118 Q124 3 126 8 H40 Q44 3 52 3 Z" fill="#b8bec5" />
      <path d="M2 86 V64 Q2 52 8 42 L13 34 H34 V86 Z" fill="#dc241f" />
      <path d="M16 30 L24 18 Q30 12 42 12 H60 V40 H14 Z" fill="#1c2630" />
      <rect x="22" y="14" width="30" height="6" rx="1.5" fill="#0d1014" />
      <text x="37" y="19" className="train-led" fontSize="5.4" textAnchor="middle" transform={flip ? "translate(74 0) scale(-1 1)" : undefined}>
        TUBLE
      </text>
      <circle cx="44" cy="31" r="4" fill="#4b5866" />
      <path d="M36 40 Q36 34 44 34 Q52 34 52 40 Z" fill="#4b5866" />
      <rect x="4" y="66" width="9" height="4" rx="2" fill="#fff6cf" />
      <rect x="34" y="74" width="92" height="12" fill="#0019a8" />
      <Window x={68} width={52} index={flip ? 19 : 7} />
    </g>
  );
}

function Carriage({ x, index }: { x: number; index: number }) {
  const windows: [number, number][] = [
    [12, 44],
    [120, 58],
    [182, 58],
    [304, 44],
  ];
  const middle = index === MIDDLE_CAR;
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="-4" y="10" width="8" height="78" fill="#2a2f36" />
      <rect x="10" y="88" width="340" height="6" rx="2" fill="#2a2f36" />
      <Bogie x={40} />
      <Bogie x={250} />
      <path d="M4 22 Q4 8 18 8 H342 Q356 8 356 22 V86 H4 Z" fill="url(#train-body)" />
      <path d="M12 8 Q16 3 28 3 H332 Q344 3 348 8 Z" fill="#b8bec5" />
      <rect x="4" y="74" width="352" height="12" fill="#0019a8" />
      {windows.map(([left, width], w) => (
        <Window key={w} x={left} width={width} index={index * 4 + w} pigeonSeat={middle && w === 1} />
      ))}
      {DOORS.map((left) => (
        <Door key={left} x={left} />
      ))}
      <rect x="128" y="11" width="104" height="9" rx="1.5" fill="#0d1014" />
      <text x="180" y="18" className="train-led" fontSize="6.6" textAnchor="middle">
        {middle ? "TUBLE · MIND THE GAP" : "TUBLE"}
      </text>
    </g>
  );
}

function Bogie({ x }: { x: number }) {
  return (
    <g fill="#1b1f25">
      <rect x={x} y="88" width="70" height="7" rx="2" />
      <circle cx={x + 16} cy="95" r="5" />
      <circle cx={x + 54} cy="95" r="5" />
    </g>
  );
}

function Door({ x }: { x: number }) {
  const leaf = (left: number, side: "l" | "r") => (
    <g className={`leaf leaf-${side}`}>
      <rect x={left} y="20" width="24" height="66" fill="#dc241f" />
      <rect x={left + 4} y="26" width="16" height="34" rx="2" fill="url(#train-glass)" stroke="#8f1611" strokeWidth="1" />
      <rect x={left + (side === "l" ? 22 : 0)} y="20" width="2" height="66" fill="#7d130f" />
    </g>
  );
  return (
    <g>
      <rect x={x} y="20" width={DOOR_WIDTH} height="66" fill="#d3dbe0" />
      <rect x={x} y="78" width={DOOR_WIDTH} height="8" fill="#4a525c" />
      <rect x={x + DOOR_WIDTH / 2 - 1.5} y="20" width="3" height="58" fill="#ffd300" />
      <g clipPath={`url(#door-${x})`}>
        {leaf(x, "l")}
        {leaf(x + 24, "r")}
      </g>
      <rect className="door-light" x={x + 19} y="13" width="10" height="4" rx="1.5" />
    </g>
  );
}

type Passenger = "bowler" | "reader" | "headphones" | "bun" | "dog" | "balloon" | "empty" | "cap";
const PASSENGERS: Passenger[] = ["reader", "bowler", "empty", "headphones", "bun", "dog", "cap", "balloon", "reader", "empty", "headphones", "bowler"];

function Window({ x, width, index, pigeonSeat = false }: { x: number; width: number; index: number; pigeonSeat?: boolean }) {
  const top = 24;
  const seats = width > 50 ? [x + width * 0.3, x + width * 0.72] : [x + width / 2];
  return (
    <g>
      <rect x={x} y={top} width={width} height="34" rx="4" fill="url(#train-glass)" />
      {seats.map((cx, s) =>
        pigeonSeat && s === 0 ? (
          <g key={s} className="pigeon-aboard">
            <g transform={`translate(${cx - 10} ${top + 17}) scale(0.5)`}>
              <PigeonShape />
            </g>
          </g>
        ) : (
          <Person key={s} cx={cx} top={top} kind={PASSENGERS[(index * 5 + s * 3) % PASSENGERS.length]!} />
        ),
      )}
      <path d={`M${x + 4} ${top} H${x + width * 0.45} L${x + width * 0.2} ${top + 34} H${x + 2} Z`} fill="#fff" opacity="0.28" />
      <rect x={x} y={top} width={width} height="34" rx="4" fill="none" stroke="#2b3138" strokeWidth="1.4" />
    </g>
  );
}

function Person({ cx, top, kind }: { cx: number; top: number; kind: Passenger }) {
  if (kind === "empty") return null;
  const ink = "#5a6672";
  const bottom = top + 34;
  if (kind === "dog") {
    return (
      <g fill="#8a6b52">
        <circle cx={cx} cy={bottom - 9} r="5" />
        <ellipse cx={cx - 5} cy={bottom - 11} rx="2" ry="4" fill="#5e4636" />
        <ellipse cx={cx + 5} cy={bottom - 11} rx="2" ry="4" fill="#5e4636" />
        <ellipse cx={cx} cy={bottom - 6} rx="2.6" ry="2" fill="#f1e4d6" />
        <circle cx={cx} cy={bottom - 7} r="1" fill="#2a2a2a" />
      </g>
    );
  }
  const child = kind === "balloon";
  const s = child ? 0.78 : 1;
  const headY = bottom - 19 * s;
  return (
    <g>
      <path d={`M${cx - 9 * s} ${bottom} Q${cx - 9 * s} ${bottom - 13 * s} ${cx} ${bottom - 13 * s} Q${cx + 9 * s} ${bottom - 13 * s} ${cx + 9 * s} ${bottom} Z`} fill={ink} />
      <circle cx={cx} cy={headY} r={5.2 * s} fill={ink} />
      {kind === "bowler" && (
        <g fill="#20262d">
          <path d={`M${cx - 5} ${headY - 2} Q${cx - 5} ${headY - 9} ${cx} ${headY - 9} Q${cx + 5} ${headY - 9} ${cx + 5} ${headY - 2} Z`} />
          <rect x={cx - 7.5} y={headY - 3} width="15" height="2" rx="1" />
        </g>
      )}
      {kind === "cap" && (
        <g fill="#dc241f">
          <path d={`M${cx - 5.4} ${headY - 1} A5.4 5.4 0 0 1 ${cx + 5.4} ${headY - 1} Z`} />
          <rect x={cx + 3} y={headY - 2.2} width="5.5" height="1.8" rx="0.9" />
        </g>
      )}
      {kind === "bun" && <circle cx={cx + 1} cy={headY - 6} r="3" fill={ink} />}
      {kind === "headphones" && (
        <path d={`M${cx - 6} ${headY + 1} Q${cx - 6} ${headY - 8} ${cx} ${headY - 8} Q${cx + 6} ${headY - 8} ${cx + 6} ${headY + 1}`} fill="none" stroke="#ffd300" strokeWidth="2" />
      )}
      {kind === "reader" && (
        <g>
          <rect x={cx - 10} y={headY - 5} width="20" height="15" rx="1" fill="#f4f1e8" stroke="#b7b2a6" strokeWidth="0.6" />
          <path d={`M${cx} ${headY - 5} V${headY + 10} M${cx - 8} ${headY - 1} H${cx - 2} M${cx - 8} ${headY + 2} H${cx - 2} M${cx + 2} ${headY - 1} H${cx + 8} M${cx + 2} ${headY + 2} H${cx + 8}`} stroke="#9aa1a8" strokeWidth="0.8" />
        </g>
      )}
      {child && (
        <g>
          <path d={`M${cx + 3} ${headY + 2} Q${cx + 9} ${headY - 6} ${cx + 8} ${top + 11}`} fill="none" stroke={ink} strokeWidth="0.7" />
          <ellipse cx={cx + 8} cy={top + 7} rx="4" ry="4.6" fill="#dc241f" />
        </g>
      )}
    </g>
  );
}

/** Every station has one. Drawn 40 by 32 units. */
function PigeonShape({ pecking = false }: { pecking?: boolean }) {
  return (
    <g>
      <path d="M8 22 Q4 18 2 22 L0 25 Q6 25 10 24 Z" fill="#5b6470" />
      <ellipse cx="18" cy="20" rx="11" ry="7.5" fill="#8d97a3" />
      <path d="M11 17 Q18 12 26 18 Q20 22 11 17 Z" fill="#6f7a87" />
      <path d="M12 21 H22" stroke="#4d5560" strokeWidth="1.2" />
      <path d="M12 23.4 H20" stroke="#4d5560" strokeWidth="1.2" />
      <g className={pecking ? "pigeon-head" : undefined}>
        <path d="M24 15 Q25 9 30 9 Q34 9 34.5 13 Q34 17 28 19 Z" fill="#7d8894" />
        <path d="M25 16 Q28 13 31 15 Q29 19 25 18 Z" fill="#5fa58b" opacity="0.9" />
        <circle cx="31" cy="11.6" r="1.3" fill="#f2a33a" />
        <circle cx="31.2" cy="11.6" r="0.6" fill="#111" />
        <path d="M34.3 12.2 L38 13.4 L34.2 14.2 Z" fill="#3f454c" />
      </g>
      <path d="M17 27 V31 M15 31 H19 M22 27 V31 M20 31 H24" stroke="#d27a63" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}
