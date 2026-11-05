import networkJson from "../data/network.json";
import scheduleJson from "../data/schedule.json";
import type { AnswerRequest, TodayResponse } from "../src/game/api.ts";
import { addDays, londonDate, modesOn, puzzleNumber, stationsOn, usageOn } from "../src/game/day.ts";
import { resultFor } from "../src/game/result.ts";
import { scheduleFor, type DayPrompt, type ScheduleDay } from "../src/game/schedule.ts";
import { likelihoodFor } from "../src/game/score.ts";
import type { Network } from "../src/network.ts";

const network = networkJson as Network;
const schedule = scheduleJson as ScheduleDay[];
const stationIds = new Set(network.stations.map((station) => station.id));

function today(now: Date): Response {
  const date = londonDate(now);
  const day = scheduleFor(schedule, date);
  const prompt = ({ id, text, conditions, answers }: DayPrompt, interchange: boolean) => ({
    id,
    text,
    conditions,
    interchange,
    answerCount: answers.length,
  });
  const modes = modesOn(date);
  const { stations, elsewhere } = stationsOn(date, network.stations);
  const body: TodayResponse = {
    date,
    number: puzzleNumber(date),
    prompts: [...day.prompts.map((p) => prompt(p, false)), prompt(day.interchange, true)],
    modes,
    overground: modes.includes("overground"),
    stations,
    otherStations: [...network.otherStations, ...elsewhere],
  };
  return Response.json(body, { headers: { "cache-control": "public, max-age=60" } });
}

/** Pages loaded before wrong guesses were free don't send `timeUp`, and expect wrong answers to be scored. */
type ParsedAnswer = AnswerRequest & { legacy: boolean };

function parseAnswer(body: unknown): ParsedAnswer | null {
  if (typeof body !== "object" || body === null) return null;
  const { date, promptId, stationId, player, timeUp, replay } = body as Record<string, unknown>;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof promptId !== "string") return null;
  if (stationId !== null && typeof stationId !== "string") return null;
  if (typeof player !== "string" || !/^[\w-]{8,64}$/.test(player)) return null;
  if (timeUp !== undefined && typeof timeUp !== "boolean") return null;
  if (replay !== undefined && typeof replay !== "boolean") return null;
  return { date, promptId, stationId, player, timeUp: timeUp ?? true, replay: replay === true, legacy: timeUp === undefined };
}

const error = (status: number, message: string) => Response.json({ error: message }, { status });

async function answer(request: Request, env: Env, now: Date): Promise<Response> {
  const body = parseAnswer(await request.json().catch(() => null));
  if (!body) return error(400, "That answer didn't make sense.");

  // Players who started just before midnight can still finish.
  const date = londonDate(now);
  if (body.date !== date && body.date !== addDays(date, -1)) return error(410, "That puzzle has closed.");

  const day = scheduleFor(schedule, body.date);
  const interchange = body.promptId === day.interchange.id;
  const prompt = interchange ? day.interchange : day.prompts.find((p) => p.id === body.promptId);
  if (!prompt) return error(400, "That prompt isn't in this puzzle.");
  if (body.stationId !== null && !stationIds.has(body.stationId)) return error(400, "That isn't a station.");

  // A wrong guess isn't an answer: the player keeps guessing until the time is up.
  const fits = body.stationId !== null && prompt.answers.includes(body.stationId);
  if (!fits && !body.timeUp) return error(422, "That station doesn't fit.");
  const stationId = fits || body.legacy ? body.stationId : null;

  // The trigger in migrations/0001_answers.sql keeps the tallies up to date.
  const record = env.DB.prepare(
    "INSERT INTO answers (day, prompt_id, player, station_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT DO NOTHING",
  ).bind(body.date, body.promptId, body.player, stationId ?? "", now.getTime());
  const reads = [
    env.DB.prepare("SELECT station_id FROM answers WHERE day = ?1 AND prompt_id = ?2 AND player = ?3").bind(
      body.date,
      body.promptId,
      body.player,
    ),
    env.DB.prepare("SELECT station_id, players FROM tallies WHERE day = ?1 AND prompt_id = ?2").bind(body.date, body.promptId),
  ];
  const [recorded, tallies] = (await env.DB.batch<Record<string, unknown>>(body.replay ? reads : [record, ...reads])).slice(-2);

  // Answering twice (say, from two tabs) keeps the first answer.
  const firstAnswer = String(recorded!.results[0]?.station_id ?? "") || null;
  const counts = Object.fromEntries(tallies!.results.map((row) => [String(row.station_id), Number(row.players)]));
  // A replay is scored as if it had replaced the player's first answer.
  if (body.replay) {
    if (recorded!.results.length > 0) counts[firstAnswer ?? ""]! -= 1;
    counts[stationId ?? ""] = (counts[stationId ?? ""] ?? 0) + 1;
  }
  const result = resultFor({
    promptId: body.promptId,
    answers: prompt.answers,
    interchange,
    stationId: body.replay ? stationId : firstAnswer,
    counts,
    likelihood: likelihoodFor(body.promptId, usageOn(body.date, network.stations)),
  });
  // Older pages only know a miss as a Signal Failure.
  if (body.legacy && !result.correct) return Response.json({ ...result, tier: "signal-failure" });
  return Response.json(result);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const now = new Date();
    try {
      if (url.pathname === "/api/today" && request.method === "GET") return today(now);
      if (url.pathname === "/api/answer" && request.method === "POST") return await answer(request, env, now);
      return error(404, "Not found.");
    } catch (cause) {
      console.error(cause);
      return error(500, "Something went wrong. Try again in a moment.");
    }
  },
} satisfies ExportedHandler<Env>;
