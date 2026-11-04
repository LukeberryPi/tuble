---
title: I built a daily Tube game mostly by asking
date: 2026-11-04
status: draft
---

> **Draft.** Written from the build record. Edit the voice to taste before publishing.
> The full round-by-round record is in [the audit log](./tuble-build-audit-log.md).

I made a small daily game called [tuble](https://tuble.win). Every day you get seven prompts —
"name a station on the District line", "name a station south of the river" — and thirty seconds
each. The twist is the scoring: the fewer other players who gave your answer, the more you score.
Say Oxford Circus and you get a shrug. Say Roding Valley and you get a Ghost Station.

What I want to write about isn't really the game. It's that I built most of it by typing short
messages to a coding agent and reading back what it did. This is the honest version of how that
went.

## It started as a worse idea

The first thing I asked for wasn't fun. I said so — "this is not fun enough, give it more thought" —
and the idea got reworked until the rarity-scoring hook showed up. That's the part worth keeping:
the agent is quick, but taste is still my job. The good turns were the ones where I pushed back, not
the ones where I was vague.

## Questions you don't have to write

A daily game needs a lot of prompts, and I didn't want to write them by hand. So the questions are
generated from real data: a map of every Tube and Overground station with its lines, zones,
position, borough, opening year, and yearly passenger count. From that you can ask the game for
"stations further east than the O2" or "stations on the Mildmay line" and get a list with sensible
answers. Right now that's 395 prompts across two dozen families — enough for about two months before
one repeats.

The passenger counts do something nice, too. Before enough people have played, the game guesses how
rare an answer is from how busy the station actually is. Real answers take over once they come in.

## Then I asked for whimsy

The first version worked and looked like a form. So I sent a long, slightly unreasonable message:
make wrong guesses shake instead of submitting, drop the timer to thirty seconds, go HAM on the
TfL theme, build a train animation for the score reveal, and "prove to me that you're an amazing
design engineer."

That one round did the most work by far — hundreds of small edits, and a browser driven two dozen
times to screenshot the result on desktop, on mobile, and with reduced motion on. What came back:
the top of the page is now a Tube platform. The train waits with its doors open while you think, and
when you answer it pulls out and reveals a roundel with your station's name. If you run out of time,
a pigeon hops aboard and the train leaves without you. The background is seat moquette. It has the
whimsy it was missing.

## The unglamorous parts are where you pay attention

Two moments stand out, and neither was design.

**Deploying to real players.** By the time I shipped the redesign, a handful of people were playing
that day's puzzle. Changing the rules mid-day — a shorter timer, free retries — would have been
unfair to anyone already playing. So the Overground answers and the new timing only switch on from
the next day; the day in progress stays exactly as it was. That's the kind of thing you have to ask
for, or at least notice.

**Words matter.** I had the game say "You lost the train" when time ran out. A Londoner would say
"missed the train." I asked for the fix, and it went out as its own small change. Little, but it's
the difference between sounding local and sounding not.

## What the machine was good and bad at

Good at: volume and verification. Generating hundreds of prompts, wiring up a Worker, taking its own
screenshots and checking them, catching that a wrong guess shouldn't reach the server. It deployed
to a custom domain and pushed the whole thing to GitHub from a sentence each.

Needs a human: knowing the first idea was boring, knowing "lost the train" was wrong, knowing not to
change a game out from under the people playing it. The agent is fast and tireless. The judgement
was still mine, and the best results came when I spent it.

## By the numbers

- **Live:** [tuble.win](https://tuble.win)
- **Built across:** a handful of short sessions over five days
- **Stations in the data:** 352 (269 Tube, 83 Overground-only)
- **Prompts generated:** 395 regular, plus ~1,500 double-points "Interchange" rounds
- **The heavy round:** the redesign — hundreds of edits and two dozen browser checks in one go

The receipts, round by round with timings, are in [the audit log](./tuble-build-audit-log.md).
