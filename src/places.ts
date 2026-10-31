/** The 33 local authorities of Greater London, as Wikipedia names them. */
const LONDON = new Set([
  "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley", "Camden", "City of London", "City of Westminster",
  "Croydon", "Ealing", "Enfield", "Greenwich", "Hackney", "Hammersmith and Fulham", "Haringey", "Harrow", "Havering",
  "Hillingdon", "Hounslow", "Islington", "Kensington and Chelsea", "Kingston upon Thames", "Lambeth", "Lewisham",
  "Merton", "Newham", "Redbridge", "Richmond upon Thames", "Southwark", "Sutton", "Tower Hamlets", "Waltham Forest",
  "Wandsworth",
]);

/**
 * Boroughs whose tube stations are all south of the Thames. Richmond upon Thames straddles the
 * river, but its two stations (Kew Gardens and Richmond) are on the south bank.
 */
const SOUTH_OF_THE_RIVER = new Set([
  "Bexley", "Bromley", "Croydon", "Greenwich", "Kingston upon Thames", "Lambeth", "Lewisham", "Merton",
  "Richmond upon Thames", "Southwark", "Sutton", "Wandsworth",
]);

export function isInLondon(borough: string): boolean {
  return LONDON.has(borough);
}

export function isSouthOfTheRiver(borough: string): boolean {
  return SOUTH_OF_THE_RIVER.has(borough);
}

/** How a prompt names a borough: "in Camden", "in the City of London". */
export function boroughPhrase(borough: string): string {
  if (borough.startsWith("City of")) return `in the ${borough}`;
  return `in the borough of ${borough.replace(" and ", " & ")}`;
}
