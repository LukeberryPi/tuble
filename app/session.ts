import type { AnswerResult, TodayResponse } from "../src/game/api.ts";

/** A player's progress through one day's puzzle, saved in the browser. */
export type Progress = {
  results: AnswerResult[];
  /** When the current prompt's timer started. Kept so reloading doesn't reset the clock. */
  startedAt: number | null;
  /** Playing the day again, after finishing it once. */
  replay?: boolean;
};

/** What the server made of a guess. A wrong guess isn't recorded, so the player can try again. */
export type Outcome = { kind: "result"; result: AnswerResult } | { kind: "wrong" };

const PLAYER_KEY = "tuble:player";
const progressKey = (date: string) => `tuble:day:${date}`;

export function loadProgress(date: string): Progress {
  try {
    const saved = localStorage.getItem(progressKey(date));
    if (saved) {
      const progress = JSON.parse(saved) as Progress;
      // Misses were called Signal Failures before 3 November 2026.
      const results = progress.results.map((result) => ((result.tier as string) === "signal-failure" ? { ...result, tier: "lost-train" as const } : result));
      return { ...progress, results };
    }
  } catch {
    // Private browsing or a corrupt entry: start fresh.
  }
  return { results: [], startedAt: null };
}

export function saveProgress(date: string, progress: Progress): void {
  try {
    localStorage.setItem(progressKey(date), JSON.stringify(progress));
  } catch {
    // Storage is full or blocked. The game still works, it just won't survive a reload.
  }
}

/** An anonymous id, so each player's answer counts once per prompt. */
function playerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function fetchToday(): Promise<TodayResponse> {
  const response = await fetch("/api/today");
  if (!response.ok) throw new Error(`GET /api/today: ${response.status}`);
  return (await response.json()) as TodayResponse;
}

/** Sends a guess. Once time is up the answer is final, even if it doesn't fit. */
export async function sendAnswer(date: string, promptId: string, stationId: string | null, timeUp: boolean, replay: boolean): Promise<Outcome> {
  const response = await fetch("/api/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ date, promptId, stationId, player: playerId(), timeUp, replay }),
  });
  if (response.status === 422 && !timeUp) return { kind: "wrong" };
  if (!response.ok) throw new Error(`POST /api/answer: ${response.status}`);
  return { kind: "result", result: (await response.json()) as AnswerResult };
}
