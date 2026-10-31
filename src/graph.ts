import type { LineId } from "./lines.ts";
import type { Network, Station } from "./network.ts";

type Adjacency = Map<string, Set<string>>;

function link(adjacency: Adjacency, a: string, b: string) {
  if (!adjacency.has(a)) adjacency.set(a, new Set());
  if (!adjacency.has(b)) adjacency.set(b, new Set());
  adjacency.get(a)!.add(b);
  adjacency.get(b)!.add(a);
}

function indexesOf(list: string[], item: string): number[] {
  return list.flatMap((value, i) => (value === item ? [i] : []));
}

/** Walks over the station network. A "stop" is one hop between neighbouring stations, on any line. */
export class TubeGraph {
  readonly stations: Station[];
  private readonly byId: Map<string, Station>;
  private readonly adjacent: Adjacency = new Map();
  private readonly lineAdjacent = new Map<LineId, Adjacency>();
  private readonly routes = new Map<LineId, string[][]>();

  constructor(network: Network) {
    this.stations = network.stations;
    this.byId = new Map(network.stations.map((station) => [station.id, station]));
    for (const { a, b, line } of network.edges) {
      link(this.adjacent, a, b);
      if (!this.lineAdjacent.has(line)) this.lineAdjacent.set(line, new Map());
      link(this.lineAdjacent.get(line)!, a, b);
    }
    for (const { line, stations } of network.routes) {
      this.routes.set(line, [...(this.routes.get(line) ?? []), stations]);
    }
  }

  station(id: string): Station {
    const station = this.byId.get(id);
    if (!station) throw new Error(`Unknown station: ${id}`);
    return station;
  }

  /** How many stops it takes to reach every station from `from`. */
  stopsFrom(from: string): Map<string, number> {
    const stops = new Map([[from, 0]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]!;
      for (const next of this.adjacent.get(at) ?? []) {
        if (stops.has(next)) continue;
        stops.set(next, stops.get(at)! + 1);
        queue.push(next);
      }
    }
    return stops;
  }

  /** Stations where a line ends on the map: they have only one neighbour on that line. */
  lineEnds(line: LineId): string[] {
    const adjacency = this.lineAdjacent.get(line);
    if (!adjacency) return [];
    return [...adjacency].filter(([, next]) => next.size === 1).map(([id]) => id);
  }

  /**
   * The stations a train passes between `a` and `b` on one line, in order. Returns null if no
   * train on that line runs between them, or if trains take different ways, like the Northern
   * line via Bank or via Charing Cross.
   */
  between(line: LineId, a: string, b: string): string[] | null {
    if (a === b) return null;
    const ways = new Map<string, string[]>();
    for (const route of this.routes.get(line) ?? []) {
      // The Circle line passes Paddington and Edgware Road twice, so check every pair of visits.
      for (const i of indexesOf(route, a)) {
        for (const j of indexesOf(route, b)) {
          const way = i < j ? route.slice(i + 1, j) : route.slice(j + 1, i).reverse();
          ways.set([...way].sort().join(), way);
        }
      }
    }
    return ways.size === 1 ? [...ways.values()][0]! : null;
  }
}
