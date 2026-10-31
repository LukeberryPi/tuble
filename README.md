# tuble

A daily London Underground game. Every day, everyone gets the same 7 prompts and 20 seconds for each: name a station that fits. The fewer other players who gave your answer, the more you score.

> **Name a station on the Central line.**
> Most people say Oxford Circus. You say Roding Valley: 👻 Ghost Station, +100.

This repo has the station data and the prompt generator. The game itself comes next.

## How a day works

- Six regular prompts, then an **Interchange** round: two conditions at once, for double points.
- Correct answers score by how rare they are: 🥵 Rush Hour (lots of people said it), 💺 Off-Peak, 🌙 Night Tube, 👻 Ghost Station (almost nobody did). A wrong answer is a 🚧 Signal Failure.
- Until there are enough players to measure rarity, each station's yearly passenger count stands in for how often people would say it.

## The prompt bank

`bun run data:prompts` builds every prompt from the station data. Right now that gives:

- **277 regular prompts** from 21 families, 149 of them with a good spread of obvious and obscure answers
- **793 Interchange prompts**
- **46 days** of regular prompts before one repeats

A few examples:

| Prompt | Answers | Why it's fun |
| --- | ---: | --- |
| Name a station with an animal hiding in its name | 22 | Lambeth North hides a lamb, Whitechapel an ape |
| Name a station south of the river | 31 | North Greenwich counts, Pimlico doesn't |
| Name a station further south than Brixton | 13 | Heathrow Terminal 4 is one of them |
| Name a station one stop from Waterloo | 6 | Bank counts, via the Waterloo & City line |
| Name a station between Euston and Waterloo on the Northern line | 6 | Players have to picture the Charing Cross branch |
| Name a station in Zone 1, with an animal hiding in its name | 4 | An Interchange prompt |

[docs/prompt-bank.md](docs/prompt-bank.md) lists every prompt with its likely answers and deep cuts.

## Data

[data/network.json](data/network.json) has all 269 stations: lines, zones, position, borough, opening year and yearly passenger count, plus the track between stations and the routes trains run. TfL lists Paddington, Edgware Road and Hammersmith as two stations each; they're merged here, because players think of each as one place.

It's built from:

- the [TfL Unified API](https://api.tfl.gov.uk): stations, zones, coordinates, the order of stops and the routes trains run
- Wikipedia's [List of London Underground stations](https://en.wikipedia.org/wiki/List_of_London_Underground_stations): borough, opening year and 2024 passenger counts

## Commands

```sh
bun install
bun run data:network   # refetch TfL and Wikipedia data (set TFL_APP_KEY to avoid rate limits)
bun run data:prompts   # regenerate data/prompts.json and docs/prompt-bank.md
bun test
bun run typecheck
```

## Code

- `src/graph.ts`: walks the network: stops between stations, line ends, the stations between two others
- `src/prompts/families.ts`: every kind of prompt, in priority order
- `src/prompts/lexicons.ts`: the hand-picked word lists (colours, animals, trees and so on)
- `src/prompts/generate.ts`: filters prompts by answer count, drops near copies, and pairs prompts into Interchange rounds
- `scripts/`: the data build and the prompt generator

## Credits

Powered by TfL Open Data. Contains OS data © Crown copyright and database rights 2016 and Geomni UK Map data © and database rights [2019].

Borough, opening year and usage figures come from Wikipedia ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)).

The roundel and the Johnston typeface are TfL trademarks, so the game should use its own logo and a lookalike font such as [Hammersmith One](https://fonts.google.com/specimen/Hammersmith+One).
