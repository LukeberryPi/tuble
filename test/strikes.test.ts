import { describe, expect, test } from "bun:test";
import { parseStrikes, upcomingStrikes } from "../src/game/strikes.ts";

// How TfL's page listed the Tube drivers' strikes in November 2026, escaped inside a script.
const PAGE = String.raw`<p>Strikes by some Tube drivers are planned for dates from November 2026 to February 2027.</p>
\u003cdiv\u003eNovember 2026\u003c/div\u003e\u003cp\u003e12:00 Thursday 26 to 11:59 Friday 27 November 2026\u003c/p\u003e
\u003cdiv\u003eDecember 2026\u003c/div\u003e\u003cp\u003e12:00 Thursday 17 to 11:59 Friday 18&nbsp;December 2026\u003c/p\u003e
<p>12:00 Thursday 26 to 11:59 Friday 27 November 2026</p>`;

describe("reading TfL's strikes page", () => {
  test("finds each strike once, in London time", () => {
    expect(parseStrikes(PAGE)).toEqual([
      { start: "2026-11-26T12:00", end: "2026-11-27T11:59", label: "12:00 Thursday 26 to 11:59 Friday 27 November 2026" },
      { start: "2026-12-17T12:00", end: "2026-12-18T11:59", label: "12:00 Thursday 17 to 11:59 Friday 18 December 2026" },
    ]);
  });

  test("handles strikes across a month or a year, and one-day strikes", () => {
    const page = "<p>Sunday 30 November to Monday 1 December 2026</p><p>Thursday 31 December 2026 to Friday 1 January 2027</p><p>Tuesday 3 March 2027</p>";
    expect(parseStrikes(page).map(({ start, end }) => [start, end])).toEqual([
      ["2026-11-30T00:00", "2026-12-01T23:59"],
      ["2026-12-31T00:00", "2027-01-01T23:59"],
      ["2027-03-03T00:00", "2027-03-03T23:59"],
    ]);
  });

  test("finds nothing on a page without strikes", () => {
    expect(parseStrikes("<p>There are no planned strikes from November 2026 to February 2027.</p>")).toEqual([]);
  });
});

describe("strikes worth warning about", () => {
  const strikes = parseStrikes(PAGE);
  const at = (iso: string) => upcomingStrikes(strikes, new Date(iso)).map((strike) => strike.start);

  test("warns a week ahead, during a strike, and not after", () => {
    expect(at("2026-11-18T12:00:00Z")).toEqual([]);
    expect(at("2026-11-19T12:00:00Z")).toEqual(["2026-11-26T12:00"]);
    expect(at("2026-11-27T11:00:00Z")).toEqual(["2026-11-26T12:00"]);
    expect(at("2026-11-27T12:00:00Z")).toEqual([]);
    expect(at("2026-12-10T12:00:00Z")).toEqual(["2026-12-17T12:00"]);
  });
});
