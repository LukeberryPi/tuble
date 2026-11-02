/**
 * Picks the prompts for each day and writes data/schedule.json.
 * Run with `bun run data:schedule` after regenerating the prompt bank.
 *
 * Days up to today in London have been played, so they're kept exactly as they are, answers
 * included. Everything after today is picked again from the current prompt bank.
 */
import type { Network } from "../src/network.ts";
import type { InterchangePrompt, Prompt } from "../src/prompts/types.ts";
import { LAUNCH_DATE, daysBetween, londonDate } from "../src/game/day.ts";
import { buildSchedule, type ScheduleDay } from "../src/game/schedule.ts";

/** How far ahead to schedule. After the last day the schedule starts again from the top. */
const DAYS_AHEAD = 365;
const SEED = 20261031;
const OUTPUT = new URL("../data/schedule.json", import.meta.url);

const network = (await Bun.file(new URL("../data/network.json", import.meta.url)).json()) as Network;
const bank = (await Bun.file(new URL("../data/prompts.json", import.meta.url)).json()) as {
  prompts: Prompt[];
  interchange: InterchangePrompt[];
};

const today = londonDate(new Date());
const existing = (await Bun.file(OUTPUT).exists()) ? ((await Bun.file(OUTPUT).json()) as ScheduleDay[]) : [];
const history = existing.filter((day) => day.date <= today);

const schedule = buildSchedule(bank, {
  history,
  start: LAUNCH_DATE,
  days: daysBetween(history.at(-1)?.date ?? LAUNCH_DATE, today) + DAYS_AHEAD,
  seed: SEED,
  stationIds: new Set(network.stations.map((station) => station.id)),
});

await Bun.write(OUTPUT, `${JSON.stringify(schedule, null, 1)}\n`);

const upcoming = schedule.filter((day) => day.date > today);
for (const day of upcoming.slice(0, 3)) {
  console.log(`\n${day.date}`);
  for (const prompt of [...day.prompts, day.interchange]) console.log(`  ${prompt.text} (${prompt.answers.length})`);
}
console.log(
  `\nKept ${history.length} played days and added ${upcoming.length}, with ${new Set(upcoming.map((day) => day.interchange.id)).size} different Interchange prompts`,
);
