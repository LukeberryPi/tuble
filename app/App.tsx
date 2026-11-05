import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { AnswerResult, TodayPrompt, TodayResponse } from "../src/game/api.ts";
import { msUntilNextPuzzle } from "../src/game/day.ts";
import { createMatcher } from "../src/game/match.ts";
import { pointsFor, TIERS, type TierId } from "../src/game/score.ts";
import { LINES, lineLabel, type Mode } from "../src/lines.ts";
import { pickFacts } from "./facts.ts";
import { Platform, type TrainState } from "./Platform.tsx";
import { Roundel } from "./Roundel.tsx";
import { scoreImage } from "./scoreImage.ts";
import { fetchToday, loadProgress, saveProgress, sendAnswer, type Progress } from "./session.ts";

const SECONDS_PER_PROMPT = 30;
const PROMPT_MS = SECONDS_PER_PROMPT * 1000;
/** The board warns, and the door lights flash, for the last few seconds. */
const DOORS_CLOSING_SECONDS = 5;
/** Below this many other players, shares lean on the passenger-number estimate. */
const FEW_PLAYERS = 30;

type Station = TodayResponse["stations"][number];
type Screen = "intro" | "prompt" | "reveal" | "summary";

const LINE_COLOURS = new Map<string, string>(LINES.map((line) => [line.id, line.colour]));
const LINE_NAMES = new Map<string, string>(
  LINES.map((line) => [line.id, `${lineLabel(line)}${line.mode === "overground" ? " (Overground)" : ""}`]),
);
/** Lines the map draws as a double line: everything but the Tube. */
const DOUBLE = new Set<string>(LINES.filter((line) => line.mode !== "tube").map((line) => line.id));
const MODE_NAMES: Record<Mode, string> = { tube: "Tube", overground: "Overground", elizabeth: "Elizabeth line", dlr: "DLR", tram: "trams" };

/** "Tube, Overground, Elizabeth line, DLR or trams". Pages served before `modes` existed only get `overground`. */
function modeList(today: TodayResponse): string {
  const names = (today.modes ?? (today.overground ? ["tube", "overground"] : ["tube"])).map((mode) => MODE_NAMES[mode]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0]!;
}
const TIER_ORDER: TierId[] = ["rush-hour", "off-peak", "night-tube", "ghost-station", "lost-train"];

function firstScreen(progress: Progress, total: number): Screen {
  if (progress.results.length >= total) return "summary";
  if (progress.startedAt !== null) return "prompt";
  return progress.results.length > 0 ? "reveal" : "intro";
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Focuses a button without scrolling the platform out of view. */
const focusOnMount = (element: HTMLElement | null) => element?.focus({ preventScroll: true });
const backToPlatform = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });

export function App() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [progress, setProgress] = useState<Progress>({ results: [], startedAt: null });
  const [screen, setScreen] = useState<Screen>("intro");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchToday()
      .then((data) => {
        if (cancelled) return;
        const saved = loadProgress(data.date);
        setToday(data);
        setProgress(saved);
        setScreen(firstScreen(saved, data.prompts.length));
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const stations = useMemo(() => new Map((today?.stations ?? []).map((station) => [station.id, station])), [today]);
  const facts = useMemo(
    () => (today ? pickFacts(progress.results, (id) => stations.get(id)?.lines ?? [], today.number) : []),
    [today, progress.results, stations],
  );

  if (loadFailed || !today) {
    return (
      <Layout station="TUBLE" train="away">
        <Board left={loadFailed ? "Signal failure" : "Loading today's tuble"} right={loadFailed ? "" : "…"} />
        {loadFailed && <p className="notice">Couldn't load today's tuble. Check your connection and refresh.</p>}
      </Layout>
    );
  }

  const total = today.prompts.length;
  const index = progress.results.length;
  const latest = progress.results.at(-1);
  const update = (change: (previous: Progress) => Progress) =>
    setProgress((previous) => {
      const next = change(previous);
      saveProgress(today.date, next);
      return next;
    });

  const finished = index >= total;
  const start = () => {
    // Instantly, so it can't fight the input scrolling itself into view above a phone's keyboard.
    window.scrollTo({ top: 0 });
    update((previous) => (finished ? { results: [], startedAt: Date.now(), replay: true } : { ...previous, startedAt: Date.now() }));
    setScreen("prompt");
  };
  const answered = (result: AnswerResult) => {
    update((previous) => ({ ...previous, results: [...previous.results, result], startedAt: null }));
    setUrgent(false);
    setScreen("reveal");
    backToPlatform();
  };
  const next = () => {
    if (index < total) return start();
    setScreen("summary");
    backToPlatform();
  };
  const show = (to: Screen) => () => {
    setScreen(to);
    backToPlatform();
  };

  const visited = progress.results.flatMap((result) => (result.correct && result.stationId ? [stations.get(result.stationId)?.name ?? ""] : []));
  const station = screen === "intro" || screen === "summary" ? "TUBLE" : (visited.at(-1) ?? "TUBLE");
  const train: TrainState = screen === "prompt" ? "standing" : screen === "reveal" ? (latest?.correct ? "leaving" : "leaving-with-pigeon") : "away";

  return (
    <Layout today={today} station={station} train={train} urgent={screen === "prompt" && urgent} onHome={screen === "summary" ? show("intro") : undefined}>
      {(screen === "prompt" || screen === "reveal") && <LineProgress results={progress.results} total={total} at={screen === "prompt" ? index : index - 1} />}
      {screen === "intro" && <Intro today={today} finished={finished} onStart={start} onScore={show("summary")} />}
      {screen === "prompt" && progress.startedAt !== null && (
        <PromptScreen
          key={index}
          today={today}
          index={index}
          startedAt={progress.startedAt}
          replay={progress.replay === true}
          onAnswered={answered}
          onUrgent={setUrgent}
        />
      )}
      {screen === "reveal" && latest && <Reveal key={index} today={today} index={index - 1} result={latest} fact={facts[index - 1]!} onNext={next} />}
      {screen === "summary" && <Summary today={today} results={progress.results} replay={progress.replay === true} onPlayAgain={show("intro")} />}
    </Layout>
  );
}

function Layout(props: { today?: TodayResponse; station: string; train: TrainState; urgent?: boolean; onHome?: () => void; children: ReactNode }) {
  const { today, station, train, urgent = false, onHome, children } = props;
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <a
            className="brand"
            href="/"
            aria-label="tuble home"
            onClick={(event) => {
              if (!onHome) return;
              event.preventDefault();
              onHome();
            }}
          >
            <Roundel name="" className="brand-roundel" />
            <span className="wordmark">tuble</span>
          </a>
          {today && (
            <span className="edition">
              No. {today.number} · {formatDate(today.date)}
            </span>
          )}
        </div>
      </header>
      <Platform station={station} train={train} urgent={urgent} />
      <main className="page">
        <div className="panel">{children}</div>
      </main>
      <footer className="footer">
        <p>
          An unofficial fan game, not affiliated with Transport for London. Powered by TfL Open Data. Contains OS data © Crown copyright and
          database rights 2016 and Geomni UK Map data © and database rights [2019]. Station facts from Wikipedia (CC BY-SA 4.0).
        </p>
        <p>
          made by <a href="https://x.com/LukeberryPi">@LukeberryPi</a> with ❤️
        </p>
      </footer>
    </>
  );
}

function Intro({ today, finished, onStart, onScore }: { today: TodayResponse; finished: boolean; onStart: () => void; onScore: () => void }) {
  return (
    <section className="intro">
      <h1 className="headline">Name the station nobody else will.</h1>
      <ol className="rules">
        <li>
          <span>
            <strong>{today.prompts.length} stops</strong>, {SECONDS_PER_PROMPT} seconds each.
          </span>
        </li>
        <li>
          <span>
            Name <strong>any station on the {modeList(today)}</strong> that fits. Wrong guesses
            bounce off, so keep trying.
          </span>
        </li>
        <li>
          <span>
            The fewer players who say it, the <strong>more you score</strong>.
          </span>
        </li>
      </ol>
      <ul className="tier-key" aria-label="Scores">
        {TIER_ORDER.map((id) => (
          <li key={id} className={`tier-key-row tier-${id}`}>
            <span className="tier-key-emoji" aria-hidden>
              {TIERS[id].emoji}
            </span>
            <span>
              <span className="tier-key-name">{TIERS[id].name}</span>
              <span className="tier-key-meaning">{TIERS[id].meaning}</span>
            </span>
            <span className="tier-key-points">{TIERS[id].points}</span>
          </li>
        ))}
      </ul>
      <p className="interchange-note">
        <span className="interchange-symbol" aria-hidden />
        <span>
          <strong>The last stop is an Interchange:</strong> two conditions at once, for double points.
        </span>
      </p>
      <button className="primary" onClick={onStart} ref={focusOnMount}>
        {finished ? `Play tuble No. ${today.number} again` : `Start tuble No. ${today.number}`}
      </button>
      {finished && (
        <p className="notice">
          Only your first go counts towards other players' scores.{" "}
          <button className="link-button" type="button" onClick={onScore}>
            See your score
          </button>
        </p>
      )}
    </section>
  );
}

type Guess = { stationId: string | null; timeUp: boolean; text: string; attempt: number };
type Hint = { message: string; id: number };

function PromptScreen(props: {
  today: TodayResponse;
  index: number;
  startedAt: number;
  replay: boolean;
  onAnswered: (result: AnswerResult) => void;
  onUrgent: (urgent: boolean) => void;
}) {
  const { today, index, startedAt, replay, onAnswered, onUrgent } = props;
  const prompt = today.prompts[index]!;
  const match = useMemo(() => createMatcher(today.stations, today.otherStations), [today]);
  const stations = useStations(today);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [hint, setHint] = useState<Hint | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, startedAt + PROMPT_MS - now);
  const seconds = Math.ceil(remaining / 1000);
  const final = guess?.timeUp === true;
  const urgent = !final && seconds <= DOORS_CLOSING_SECONDS;

  useEffect(() => onUrgent(urgent), [urgent]);

  // The clock keeps running while a guess is checked, and stops once the answer is final.
  useEffect(() => {
    if (final) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [final]);

  // Out of time: whatever's typed is the answer, if it's a station that hasn't already bounced off.
  useEffect(() => {
    if (remaining > 0 || guess) return;
    const typed = match(text);
    const stationId = typed.kind === "station" && !wrong.includes(typed.id) ? typed.id : null;
    setGuess({ stationId, timeUp: true, text, attempt: 0 });
  }, [remaining, guess, match, text, wrong]);

  const say = (message: string) => setHint({ message, id: Date.now() });

  const shake = () => {
    const field = fieldRef.current;
    if (!field) return;
    const flash: Keyframe[] = [{ borderColor: "#dc241f" }, { borderColor: "#dc241f", offset: 0.7 }, {}];
    field.querySelector("input")?.animate(flash, { duration: 700, easing: "ease-out" });
    if (reducedMotion()) return;
    field.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-9px)" },
        { transform: "translateX(8px)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "ease-out" },
    );
  };

  useEffect(() => {
    if (!guess) return;
    let cancelled = false;
    setFailed(false);
    sendAnswer(today.date, prompt.id, guess.stationId, guess.timeUp, replay)
      .then((outcome) => {
        if (cancelled) return;
        if (outcome.kind === "result") return onAnswered(outcome.result);
        const id = guess.stationId!;
        setWrong((tried) => [...tried, id]);
        setText((current) => (current === guess.text ? "" : current));
        say(`${stations.get(id)?.name ?? "That station"} doesn't fit.`);
        shake();
        setGuess(null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // onAnswered changes every render; the guess only needs sending when it changes.
  }, [guess]);

  const choose = (id: string) => {
    setChoices([]);
    if (wrong.includes(id)) {
      say(`You've tried ${stations.get(id)?.name}.`);
      shake();
    } else setGuess({ stationId: id, timeUp: false, text, attempt: 0 });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (guess) return;
    const typed = match(text);
    setChoices([]);
    if (typed.kind === "station") choose(typed.id);
    else if (typed.kind === "choose") {
      setChoices(typed.ids);
      say("Which one?");
    } else if (typed.kind === "vague") say("Keep typing: lots of stations start like that.");
    else if (typed.kind === "elsewhere") {
      say(`${typed.name} isn't on the ${modeList(today)}.`);
      shake();
    } else if (!text.trim()) say("Type a station name.");
    else {
      say("That's not a station we know.");
      shake();
    }
  };

  return (
    <section className="prompt">
      <Board
        left={final ? "Stand clear of the doors" : urgent ? "Doors closing" : prompt.interchange ? "Interchange" : `Stop ${index + 1} of ${today.prompts.length}`}
        right={final ? "" : `${seconds}s`}
        urgent={urgent}
      />
      <div className="timer" aria-hidden>
        <div className={`timer-fill${urgent ? " timer-low" : ""}`} style={{ transform: `scaleX(${remaining / PROMPT_MS})` }} />
      </div>
      <Question prompt={prompt} />
      <form className="answer-form" onSubmit={submit}>
        <div className="answer-field" ref={fieldRef}>
          <input
            className="answer-input"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setHint(null);
              setChoices([]);
            }}
            readOnly={final}
            placeholder="Type a station"
            aria-label="Your station"
            autoFocus={matchMedia("(pointer: fine)").matches}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button className="go" type="submit" disabled={guess !== null}>
            Go
          </button>
        </div>
      </form>
      <div className="feedback" aria-live="polite">
        {hint && (
          <p key={hint.id} className="hint">
            {hint.message}
          </p>
        )}
        {choices.length > 0 && (
          <div className="choices">
            {choices.map((id) => (
              <button key={id} className="choice" type="button" onClick={() => choose(id)}>
                {stations.get(id)?.name}
              </button>
            ))}
          </div>
        )}
        {wrong.length > 0 && (
          <ul className="tried" aria-label="Already tried">
            {wrong.map((id) => (
              <li key={id} className="tried-chip">
                {stations.get(id)?.name}
              </li>
            ))}
          </ul>
        )}
        {guess && !failed && <p className="sending">{guess.timeUp ? "Doors closing…" : "Checking…"}</p>}
        {guess && failed && (
          <p className="hint">
            Signal failure: couldn't reach tuble.{" "}
            <button className="link-button" type="button" onClick={() => setGuess({ ...guess, attempt: guess.attempt + 1 })}>
              Try again
            </button>
          </p>
        )}
      </div>
    </section>
  );
}

function Question({ prompt, compact = false }: { prompt: TodayPrompt; compact?: boolean }) {
  return (
    <div className={`question${compact ? " question-compact" : ""}`}>
      <p className="lead">Name a station</p>
      <h1 className="conditions">
        {prompt.conditions.map((condition, i) => (
          <span key={i} className="condition">
            {condition}
          </span>
        ))}
      </h1>
      {!compact && (
        <p className="fits">
          {prompt.answerCount} stations fit{prompt.interchange && " · double points"}
        </p>
      )}
    </div>
  );
}

function Reveal(props: { today: TodayResponse; index: number; result: AnswerResult; fact: string; onNext: () => void }) {
  const { today, index, result, fact, onNext } = props;
  const stations = useStations(today);
  const tier = TIERS[result.tier];
  const station = result.stationId ? stations.get(result.stationId) : undefined;
  const isLast = index === today.prompts.length - 1;
  const top = result.top[0]?.share ?? 1;

  return (
    <section className="reveal">
      <Question prompt={today.prompts[index]!} compact />
      <div className={`tier-banner tier-${result.tier}`}>
        <span className="tier-banner-emoji" aria-hidden>
          {tier.emoji}
        </span>
        <span className="tier-banner-name">{tier.name}</span>
        <span className="tier-banner-points">+{result.points}</span>
      </div>
      <div className="reveal-body">
        <p className="your-answer">{result.correct && station ? <StationName station={station} /> : "You missed the train."}</p>
        <p className="explain">{explain(result, station)}</p>

        <Whiteboard fact={fact} />

        <h2 className="section-title">Most said</h2>
        <ul className="bars">
          {result.top.map((answer, i) => (
            <li key={answer.id} className={`bar${answer.id === result.stationId ? " bar-mine" : ""}`}>
              <span className="bar-label">
                <StationName station={stations.get(answer.id)!} />
              </span>
              <span className="bar-track">
                <span className="bar-fill" style={{ "--share": Math.max(0.04, answer.share / top), "--i": i } as CSSProperties} />
              </span>
              <span className="bar-value">{percent(answer.share)}</span>
            </li>
          ))}
        </ul>

        {result.deepCuts.length > 0 && (
          <>
            <h2 className="section-title">Deep cuts</h2>
            <ul className="deep-cuts">
              {result.deepCuts.map((answer) => (
                <li key={answer.id}>
                  <StationName station={stations.get(answer.id)!} />
                  <span className="deep-cut-share">{percent(answer.share)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <button className="primary" onClick={onNext} ref={focusOnMount}>
          {isLast ? "See your score" : "Next stop"}
        </button>
      </div>
    </section>
  );
}

function explain(result: AnswerResult, station: Station | undefined): string {
  if (!station) return "The doors closed before you found a station that fits. The pigeon made it, though.";
  if (!result.correct) return `${station.name} doesn't fit, so the train left without you.`;
  const share = percent(result.share ?? 0);
  if (result.players === 0) return "You're the first to answer this one. Until more people play, rarity is estimated from how busy each station is.";
  if (result.players < FEW_PLAYERS) {
    return `Roughly ${share} of players say ${station.name}. With ${result.players} ${result.players === 1 ? "player" : "players"} so far, that's partly estimated from how busy each station is.`;
  }
  return `${share} of other players said ${station.name}.`;
}

/** Like the boards station staff write on. */
function Whiteboard({ fact }: { fact: string }) {
  return (
    <aside className="whiteboard">
      <p className="whiteboard-title">Did you know?</p>
      <p className="whiteboard-fact">{fact}</p>
    </aside>
  );
}

function Summary(props: { today: TodayResponse; results: AnswerResult[]; replay: boolean; onPlayAgain: () => void }) {
  const { today, results, replay, onPlayAgain } = props;
  const stations = useStations(today);
  const [shared, setShared] = useState<string | null>(null);
  const score = results.reduce((sum, result) => sum + result.points, 0);
  const best = today.prompts.reduce((sum, prompt) => sum + pointsFor("ghost-station", prompt.interchange), 0);
  const emojis = results.map((result) => TIERS[result.tier].emoji);
  const shareText = [
    `tuble No. ${today.number}${replay ? " (replay)" : ""}: ${score}/${best}`,
    `${emojis.slice(0, -1).join("")} ⇄ ${emojis.at(-1)}`,
    location.origin,
  ].join("\n");

  const share = async () => {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text: shareText }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setShared("Copied to clipboard");
    } catch {
      setShared(shareText);
    }
  };

  const exportImage = async () => {
    try {
      const blob = await scoreImage({
        number: today.number,
        date: formatDate(today.date),
        replay,
        score,
        best,
        rounds: results.map((result, i) => ({ points: result.points, tier: result.tier, interchange: today.prompts[i]?.interchange ?? false })),
        host: location.host,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tuble-${today.number}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setShared("Image downloaded");
    } catch {
      setShared("Couldn't create the image. Please try again.");
    }
  };

  return (
    <section className="summary">
      <p className="lead">
        tuble No. {today.number} · {formatDate(today.date)}
      </p>
      <ResultTrain results={results} />
      <p className="score">
        <CountUp className="score-value" value={score} />
        <span className="score-best"> / {best}</span>
      </p>
      <button className="primary" onClick={share}>
        Share your score
      </button>
      <button className="secondary" onClick={exportImage}>Save score image</button>
      {shared && <p className="shared" role="status">{shared}</p>}
      <button className="secondary" onClick={onPlayAgain}>
        Play again
      </button>

      <ol className="recap">
        {results.map((result, i) => {
          const prompt = today.prompts[i]!;
          const station = result.stationId ? stations.get(result.stationId) : undefined;
          const tier = TIERS[result.tier];
          return (
            <li key={prompt.id} className={`recap-row tier-${result.tier}`}>
              <span className="recap-emoji" aria-hidden>
                {tier.emoji}
              </span>
              <span className="recap-text">
                <span className="recap-prompt">{prompt.conditions.join(", ")}</span>
                <span className={`recap-answer${station && !result.correct ? " recap-wrong" : ""}`}>{station?.name ?? "Out of time"}</span>
              </span>
              <span className="recap-score">
                <span className="recap-tier">{tier.name}</span>
                <span className="recap-points">+{result.points}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <Countdown />
    </section>
  );
}

/** Today's stops as a train: one carriage per stop, the Interchange last. */
function ResultTrain({ results }: { results: AnswerResult[] }) {
  return (
    <div className="result-train-frame">
      <div className="result-train" role="img" aria-label={results.map((result) => TIERS[result.tier].name).join(", ")}>
        <span className="result-cab" />
        {results.map((result, i) => (
          <span
            key={result.promptId}
            className={`result-car tier-${result.tier}${i === results.length - 1 ? " result-car-interchange" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            <span className="result-window">{TIERS[result.tier].emoji}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    const start = performance.now();
    const duration = 1100;
    let frame = requestAnimationFrame(function tick(time) {
      const t = Math.min(1, (time - start) / duration);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={className}>{shown}</span>;
}

function Countdown() {
  const [left, setLeft] = useState(() => msUntilNextPuzzle());
  useEffect(() => {
    const timer = setInterval(() => setLeft(msUntilNextPuzzle()), 1000);
    return () => clearInterval(timer);
  }, []);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <Board left="Next tuble" right={`${hours}:${pad(minutes)}:${pad(seconds)}`} />;
}

/** A strip map, like the ones above train doors: one stop per prompt, the Interchange at the end. */
function LineProgress({ results, total, at }: { results: AnswerResult[]; total: number; at: number }) {
  return (
    <div className="line-progress" style={{ "--stops": total, "--at": at } as CSSProperties}>
      <ol className="line-stops" aria-label="Your journey">
        {Array.from({ length: total }, (_, i) => {
          const result = results[i];
          const label = result ? `Stop ${i + 1}: ${TIERS[result.tier].name}` : `Stop ${i + 1}`;
          return (
            <li key={i} className={`stop${result ? " stop-done" : ""}${i === total - 1 ? " stop-interchange" : ""}`} aria-label={label} aria-current={i === at || undefined}>
              <span className="stop-emoji" aria-hidden>
                {result ? TIERS[result.tier].emoji : ""}
              </span>
              <span className="stop-mark" aria-hidden />
            </li>
          );
        })}
      </ol>
      <span className="line-train-track" aria-hidden>
        <span className="line-train" />
      </span>
    </div>
  );
}

/** A dot-matrix board, like the ones on the platform. */
function Board({ left, right, urgent = false }: { left: string; right: string; urgent?: boolean }) {
  return (
    <div className={`board${urgent ? " board-urgent" : ""}`}>
      <span className="board-left">{left}</span>
      <span className="board-right">{right}</span>
    </div>
  );
}

function StationName({ station }: { station: Station }) {
  return (
    <span className="station-name">
      <span>{station.name}</span>
      <span className="line-chips">
        {station.lines.map((line) => (
          <span
            key={line}
            className={`line-chip${DOUBLE.has(line) ? " line-chip-double" : ""}`}
            style={{ "--line": LINE_COLOURS.get(line) } as CSSProperties}
            title={LINE_NAMES.get(line)}
          />
        ))}
      </span>
    </span>
  );
}

function useStations(today: TodayResponse): Map<string, Station> {
  return useMemo(() => new Map(today.stations.map((station) => [station.id, station])), [today.stations]);
}

function percent(share: number): string {
  return share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`;
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
