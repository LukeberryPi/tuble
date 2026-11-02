/**
 * Famous places for "further north than…" and "within 1 km of…" prompts. Coordinates come from
 * Wikipedia. Left out: places that share a name with a station (Kew Gardens, Hampstead Heath),
 * which would read as if they meant the station, and big parks, which are too wide to be
 * north or south of anything.
 */
export type Landmark = {
  id: string;
  /** As it reads in a prompt: "further north than the London Eye". */
  name: string;
  lat: number;
  lon: number;
};

export const LANDMARKS: Landmark[] = [
  { id: "big-ben", name: "Big Ben", lat: 51.5007, lon: -0.1245 },
  { id: "buckingham-palace", name: "Buckingham Palace", lat: 51.50083, lon: -0.14194 },
  { id: "westminster-abbey", name: "Westminster Abbey", lat: 51.49944, lon: -0.1275 },
  { id: "downing-street", name: "10 Downing Street", lat: 51.5033, lon: -0.1275 },
  { id: "trafalgar-square", name: "Trafalgar Square", lat: 51.50806, lon: -0.12806 },
  { id: "london-eye", name: "the London Eye", lat: 51.5033, lon: -0.1194 },
  { id: "british-museum", name: "the British Museum", lat: 51.5194, lon: -0.1269 },
  { id: "somerset-house", name: "Somerset House", lat: 51.5111, lon: -0.1178 },
  { id: "bt-tower", name: "the BT Tower", lat: 51.5215, lon: -0.1389 },
  { id: "tate-britain", name: "Tate Britain", lat: 51.4911, lon: -0.1275 },
  { id: "imperial-war-museum", name: "the Imperial War Museum", lat: 51.4958, lon: -0.1086 },
  { id: "st-pauls", name: "St Paul's Cathedral", lat: 51.5138, lon: -0.0983 },
  { id: "tower-of-london", name: "the Tower of London", lat: 51.50806, lon: -0.07611 },
  { id: "tower-bridge", name: "Tower Bridge", lat: 51.5056, lon: -0.0753 },
  { id: "shard", name: "the Shard", lat: 51.5045, lon: -0.0865 },
  { id: "gherkin", name: "the Gherkin", lat: 51.51444, lon: -0.08028 },
  { id: "tate-modern", name: "Tate Modern", lat: 51.5078, lon: -0.0994 },
  { id: "globe", name: "Shakespeare's Globe", lat: 51.50806, lon: -0.09722 },
  { id: "borough-market", name: "Borough Market", lat: 51.50556, lon: -0.09083 },
  { id: "old-bailey", name: "the Old Bailey", lat: 51.51583, lon: -0.10181 },
  { id: "natural-history-museum", name: "the Natural History Museum", lat: 51.49611, lon: -0.17639 },
  { id: "royal-albert-hall", name: "the Royal Albert Hall", lat: 51.5011, lon: -0.1774 },
  { id: "kensington-palace", name: "Kensington Palace", lat: 51.50528, lon: -0.18833 },
  { id: "harrods", name: "Harrods", lat: 51.49972, lon: -0.16361 },
  { id: "stamford-bridge", name: "Stamford Bridge", lat: 51.48167, lon: -0.19111 },
  { id: "craven-cottage", name: "Craven Cottage", lat: 51.475, lon: -0.22167 },
  { id: "abbey-road-studios", name: "Abbey Road Studios", lat: 51.53194, lon: -0.17833 },
  { id: "lords", name: "Lord's Cricket Ground", lat: 51.5294, lon: -0.1727 },
  { id: "london-zoo", name: "London Zoo", lat: 51.53556, lon: -0.15583 },
  { id: "camden-market", name: "Camden Market", lat: 51.54139, lon: -0.14639 },
  { id: "emirates-stadium", name: "the Emirates Stadium", lat: 51.555, lon: -0.10833 },
  { id: "highgate-cemetery", name: "Highgate Cemetery", lat: 51.567, lon: -0.147 },
  { id: "kenwood-house", name: "Kenwood House", lat: 51.5714, lon: -0.1675 },
  { id: "alexandra-palace", name: "Alexandra Palace", lat: 51.59417, lon: -0.13083 },
  { id: "tottenham-hotspur-stadium", name: "Tottenham Hotspur Stadium", lat: 51.6044, lon: -0.0664 },
  { id: "wembley-stadium", name: "Wembley Stadium", lat: 51.5556, lon: -0.2794 },
  { id: "london-stadium", name: "the London Stadium", lat: 51.5386, lon: -0.0164 },
  { id: "the-o2", name: "the O2", lat: 51.50278, lon: 0.00306 },
  { id: "cutty-sark", name: "the Cutty Sark", lat: 51.48278, lon: -0.00972 },
  { id: "thames-barrier", name: "the Thames Barrier", lat: 51.49694, lon: 0.03667 },
  { id: "excel", name: "ExCeL London", lat: 51.5081, lon: 0.0289 },
  { id: "horniman-museum", name: "the Horniman Museum", lat: 51.44056, lon: -0.06083 },
  { id: "centre-court", name: "Wimbledon's Centre Court", lat: 51.43374, lon: -0.21406 },
  { id: "twickenham-stadium", name: "Twickenham Stadium", lat: 51.45583, lon: -0.34139 },
  { id: "hampton-court-palace", name: "Hampton Court Palace", lat: 51.40333, lon: -0.3375 },
  { id: "windsor-castle", name: "Windsor Castle", lat: 51.4839, lon: -0.6044 },
];
