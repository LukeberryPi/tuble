# tuble

A daily London Tube game. Play it at **https://tuble.win**.

Every day, everyone gets the same 7 prompts and 30 seconds for each: name a Tube or Overground station that fits. Guesses that don't fit bounce off, so keep trying until the doors close. The fewer other players who gave your answer, the more you score.

> **Name a station on the Central line.**
> Most people say Oxford Circus. You say Roding Valley: 👻 Ghost Station, +100.

## How a day works

- Six regular prompts, then an **Interchange** round: two conditions at once, for double points.
- Correct answers score by how rare they are, measured by the share of players who said something more common:

  | Tier | Points | Meaning |
  | --- | ---: | --- |
  | 🥵 Rush Hour | 10 | One of the answers most people gave |
  | 💺 Off-Peak | 40 | Half of players said something more common |
  | 🌙 Night Tube | 70 | 80% said something more common |
  | 👻 Ghost Station | 100 | 95% said something more common |
  | 🏃 Lost the Train | 0 | Out of time |

- A wrong guess costs nothing but time: the answer box shakes, the guess is crossed off, and the clock keeps running. Only running out of time scores zero.
- Until enough people have played, each station's yearly passenger count stands in for how often people would say it. It counts as 20 players, so real answers take over within a few dozen plays.
- A new puzzle starts at midnight London time. [data/schedule.json](data/schedule.json) lists each day's prompts for a year, so every player gets the same ones. Launch day (31 October 2026, Halloween) is hand-picked.
- Days that have started are never changed. `bun run data:schedule` keeps them exactly as they are, answers included, and re-picks everything after today. That's how the Overground arrived on 3 November without changing a puzzle anyone had played; earlier days still only take Tube stations (`OVERGROUND_FROM` in `src/game/day.ts`).

## The prompt bank

`bun run data:prompts` builds every prompt from the station data. Right now that gives:

- **395 regular prompts** from 24 families, 229 of them with a good spread of obvious and obscure answers
- **1491 Interchange prompts**
- **65 days** of regular prompts before one repeats

A few examples:

| Prompt | Answers | Why it's fun |
| --- | ---: | --- |
| Name a station with an animal hiding in its name | 27 | Lambeth North hides a lamb, Whitechapel an ape |
| Name a station south of the river | 50 | North Greenwich counts, Pimlico doesn't |
| Name a station further east than the O2 | 41 | Chigwell counts. Stratford doesn't |
| Name a station on the Mildmay line | 28 | The Overground's lines only got names in 2024 |
| Name a station one stop from Waterloo | 6 | Bank counts, via the Waterloo & City line |
| Name a station between Euston and Waterloo on the Northern line | 6 | Players have to picture the Charing Cross branch |
| Name a station in Zone 1, with an animal hiding in its name | 5 | An Interchange prompt |

[docs/prompt-bank.md](docs/prompt-bank.md) lists every prompt with its likely answers and deep cuts.

## Data

[data/network.json](data/network.json) has all 352 stations, 269 on the Tube and 83 only on the Overground: lines, zones, position, borough, opening year and yearly passenger count, plus the track between stations and the routes trains run. TfL lists Paddington, Edgware Road and Hammersmith as two stations each; they're merged here, because players think of each as one place. It also lists 380 other stations (National Rail, DLR, Elizabeth line, trams), so the game can say "East Croydon isn't on the Tube or the Overground" rather than "never heard of it".

It's built from:

- the [TfL Unified API](https://api.tfl.gov.uk): stations, zones, coordinates, the order of stops and the routes trains run
- Wikipedia's [List of London Underground stations](https://en.wikipedia.org/wiki/List_of_London_Underground_stations): borough, opening year and 2024 passenger counts
- TfL's annual station counts: 2024 passenger counts for stations only on the Overground

## Commands

```sh
bun install
bun run db:migrate:local  # once, to set up the local database
bun run dev               # play locally
bun test
bun run typecheck
bun run deploy            # build, migrate the production database and deploy to Cloudflare

bun run data:network      # refetch TfL and Wikipedia data (set TFL_APP_KEY to avoid rate limits)
bun run data:prompts      # regenerate data/prompts.json and docs/prompt-bank.md
bun run data:schedule     # re-pick the days after today into data/schedule.json
bun run icons             # redraw the favicons and the social card in public/
```

The game runs on Cloudflare Workers: the page is static assets, and a Worker serves `/api/today` and `/api/answer`. Answers go in a D1 database called `tuble`. Deploying needs a `wrangler login` with access to that database.

## Code

- `app/`: the page (React)
- `app/Platform.tsx`: the platform at the top of the page. The train waits with its doors open while a prompt runs, then leaves with you, or, if time runs out, with the pigeon
- `app/facts.ts`: the "Did you know?" board, picking a fact about your station, its line or the Tube in general
- `worker/index.ts`: the API: today's prompts, and scoring an answer against everyone else's. Wrong guesses get a 422 and aren't recorded
- `migrations/`: the database tables. A trigger keeps a running count of each answer
- `src/game/`: shared by the page and the Worker: London dates, the schedule, name matching (typos, "Kings Cross", "Heathrow 5") and scoring
- `src/graph.ts`: walks the network: stops between stations, line ends, the stations between two others
- `src/prompts/families.ts`: every kind of prompt, in priority order
- `src/prompts/lexicons.ts`: the hand-picked word lists (colours, animals, trees and so on)
- `src/prompts/generate.ts`: filters prompts by answer count, drops near copies, and pairs prompts into Interchange rounds
- `scripts/`: the data build, the prompt generator, the schedule and the icons

## Credits

Powered by TfL Open Data. Contains OS data © Crown copyright and database rights 2016 and Geomni UK Map data © and database rights [2019].

Borough, opening year and usage figures, and most of the "Did you know?" facts, come from Wikipedia ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)). A few facts were first spotted in [this r/london thread](https://www.reddit.com/r/london/comments/rdcj1q/a_few_or_many_facts_about_the_london_underground/).

The roundel is a registered TfL trademark. The game is an unofficial fan project and uses it as homage, in the favicon, the social card and on the platform wall. TfL's licensing team could reasonably ask for it to come down, and if they do, it will. The Johnston typeface isn't free to use, so the game uses [Hammersmith One](https://fonts.google.com/specimen/Hammersmith+One), a lookalike. Its 1 looks like a capital I at small sizes, so digits come from a subset of [Lato](https://fonts.google.com/specimen/Lato) Bold ([SIL Open Font License](public/fonts/Lato-OFL.txt)). The countdown board uses [Doto](https://fonts.google.com/specimen/Doto), and the "Did you know?" whiteboard [Permanent Marker](https://fonts.google.com/specimen/Permanent+Marker).
