import type { AnswerResult } from "../src/game/api.ts";

/** Facts for the "Did you know?" board, by station id. */
export const STATION_FACTS: Record<string, string> = {
  "leicester-square": "Leicester Square to Covent Garden is the shortest hop on the Tube: about 260 metres. It's quicker to walk.",
  "covent-garden": "Covent Garden to Leicester Square is the shortest hop on the Tube: about 260 metres. It's quicker to walk.",
  "chalfont-and-latimer": "Chalfont & Latimer to Chesham is the longest gap between two stations on the Tube: 6.3 km.",
  chesham: "Chesham is as far north and as far west as the Tube goes.",
  amersham: "Amersham is the highest station on the Tube, 147 metres above sea level.",
  hampstead: "Hampstead is the deepest station on the Tube. Its platforms are 58.5 metres below ground.",
  "baker-street": "Baker Street has ten platforms, more than any other Tube station. Some of them date from 1863.",
  "canary-wharf": "Canary Wharf is the busiest Tube station with only one line, the Jubilee.",
  "roding-valley": "Roding Valley is the quietest station on the Tube, with about 170,000 journeys a year.",
  highgate: "Jerry Springer was born in Highgate station in 1944, while it was being used as an air-raid shelter.",
  "liverpool-street": "Liverpool Street stands on the first site of Bethlem Royal Hospital, better known as Bedlam.",
  embankment: "Embankment's northbound Northern line platform still plays Oswald Laurence's original “Mind the gap”.",
  greenford: "Greenford had the last wooden escalator on the Underground. It was replaced in 2014.",
  angel: "Angel's escalators are 60 metres long, the longest on the Underground.",
  pimlico: "Pimlico is the only Victoria line station where you can't change to another line.",
  "battersea-power-station": "Battersea Power Station is the only Tube station with “station” in its name.",
  "mornington-crescent": "Mornington Crescent is also a game on Radio 4's I'm Sorry I Haven't a Clue. Nobody has ever explained the rules.",
  balham: "Balham is the only station that shares no letters with the word “underground”.",
  "st-johns-wood": "St John's Wood is the only Tube station that shares no letters with the word “mackerel”.",
  hoxton: "Hoxton shares no letters with the word “mackerel”. On the Tube, only St John's Wood can say the same.",
  "mansion-house": "Mansion House and South Ealing are the only Tube stations with all five vowels in their names.",
  "south-ealing": "South Ealing and Mansion House are the only Tube stations with all five vowels in their names.",
  "caledonian-road-and-barnsbury": "Caledonian Road & Barnsbury has all five vowels. On the Tube, only Mansion House and South Ealing do.",
  knightsbridge: "Knightsbridge has six consonants in a row: G, H, T, S, B and R.",
  kennington: "Some Northern line trains turn round at Kennington, on a loop of track with no platform.",
  "mile-end": "At Mile End you can change from the deep-level Central line to the District just by crossing the platform.",
  epping: "Epping to West Ruislip is the longest Tube journey you can make without changing: 34 miles on the Central line.",
  "west-ruislip": "West Ruislip to Epping is the longest Tube journey you can make without changing: 34 miles on the Central line.",
  wapping: "Trains from Wapping to Rotherhithe run through the Thames Tunnel, the first ever built under a navigable river. The Brunels finished it in 1843.",
  rotherhithe: "Trains from Rotherhithe to Wapping run through the Thames Tunnel, the first ever built under a navigable river. The Brunels finished it in 1843.",
  "clapham-junction": "Clapham Junction isn't in Clapham. It's in Battersea.",
  morden: "Morden is the southernmost station on the Tube.",
  upminster: "Upminster is as far east as both the Tube and the Overground go.",
  "kings-cross-st-pancras": "King's Cross St. Pancras has six Tube lines, more than any other station.",
  "watford-junction": "Watford Junction is outside London's fare zones altogether.",
  "west-croydon": "West Croydon is the southernmost station on the Overground.",
};

/** Facts about the lines, for stations without one of their own. */
export const LINE_FACTS: Record<string, string> = {
  liberty: "The Liberty line is named after the Royal Liberty of Havering, which ran its own affairs for centuries.",
  lioness: "The Lioness line is named after England's women's football team, and it runs to Wembley.",
  mildmay: "The Mildmay line is named after the Mildmay Mission Hospital, which cared for people with HIV when few others would.",
  suffragette: "The Suffragette line is named after the campaign for women's votes, which was strong in East London.",
  weaver: "The Weaver line is named after the weavers of Spitalfields, Bethnal Green and Hackney.",
  windrush: "The Windrush line is named after the Windrush generation, who came to Britain from the Caribbean after the war.",
  metropolitan: "The Metropolitan line opened in 1863. It was the world's first underground railway.",
  victoria: "The Victoria line runs entirely underground. Only the Waterloo & City can say the same.",
  "waterloo-city": "The Waterloo & City has just two stations. Its trains can only leave the tunnels by crane.",
};

/** Facts about anywhere, for when nothing more specific comes up. */
export const GENERAL_FACTS = [
  "Only about 45% of the Underground is actually underground.",
  "Harry Beck's Tube map first appeared in 1933. He was an engineering draughtsman, and it shows.",
  "“Mind the gap” was first heard on the Underground in 1968.",
  "Edward Johnston drew the Underground's typeface in 1916. A version of it is still used today.",
  "The roundel first appeared on Underground platforms in 1908.",
  "Only about one Tube station in nine is south of the Thames.",
  "The Overground's six lines only got their names in 2024.",
  "Aldwych station closed in 1994 but still works as a film set. Atonement's flooded Balham was shot there.",
  "The Northern line's tunnel from East Finchley to Morden is 27.8 km long, one of the longest railway tunnels in the world.",
];

/** One fact per stop: about the player's station, then other answers to the prompt, then its lines, then anything. No repeats. */
export function pickFacts(results: AnswerResult[], linesOf: (stationId: string) => string[], seed: number): string[] {
  const used = new Set<string>();
  return results.map((result, i) => {
    const answers = [result.stationId, ...result.top.map((answer) => answer.id), ...result.deepCuts.map((answer) => answer.id)];
    const lines = result.stationId ? linesOf(result.stationId) : [];
    const candidates = [
      ...answers.map((id) => (id ? STATION_FACTS[id] : undefined)),
      ...lines.map((line) => LINE_FACTS[line]),
      ...GENERAL_FACTS.map((_, k) => GENERAL_FACTS[(seed + i + k) % GENERAL_FACTS.length]),
    ];
    const fact = candidates.find((candidate): candidate is string => candidate !== undefined && !used.has(candidate)) ?? GENERAL_FACTS[0]!;
    used.add(fact);
    return fact;
  });
}
