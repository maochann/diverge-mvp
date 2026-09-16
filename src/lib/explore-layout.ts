/**
 * Where people sit on the Explore canvas.
 *
 * The reader's circle is drawn literally: a boundary around the centre.
 * People the reader follows sit inside it as small marks; everyone else is
 * placed just beyond it on a ring (a second ring if there are many).
 *
 * Positions are purely for looking: nobody is closer because they are
 * popular, and nothing about a person is encoded in where they are. Each
 * person gets a stable angle from a hash of their id, so the same person
 * stays in roughly the same place from one session to the next, and people
 * are spread evenly around their ring in that order.
 */

export const RING_CAPACITY = 7;

export interface CanvasPoint {
  id: string;
  x: number;
  y: number;
  ring: 1 | 2;
  /** Node diameter in points. */
  size: number;
}

export interface InsidePoint {
  id: string;
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasLayout {
  center: { x: number; y: number };
  /** Radius of the circle that separates "your circle" from everyone else. */
  boundaryRadius: number;
  outside: CanvasPoint[];
  inside: InsidePoint[];
}

/** FNV-1a; small, deterministic, good enough to scatter a few ids. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A stable angle in [0, 2π) for this person. */
export function angleFor(id: string): number {
  return (hashId(id) / 0x100000000) * Math.PI * 2;
}

/** A stable fraction in [0, 1) for this person, independent of the angle. */
export function fractionFor(id: string): number {
  return ((hashId(id) >>> 8) % 1000) / 1000;
}

export const NODE_SIZE = { 1: 60, 2: 50 } as const;
const RING_GAP = 44;
const SECOND_RING_GAP = 48;
/** Room for a node plus its name label at the edge of the box. */
const EDGE_MARGIN = 46;

/**
 * Lay out the canvas. `outsideIds` are people beyond the circle (nodes),
 * `insideIds` are people the reader follows (small marks inside).
 */
export function layoutCanvas(
  outsideIds: readonly string[],
  insideIds: readonly string[],
  box: CanvasSize,
): CanvasLayout {
  const cx = box.width / 2;
  const cy = box.height / 2;
  const maxRadius = Math.min(box.width, box.height) / 2 - EDGE_MARGIN;

  const byAngle = [...outsideIds].sort((a, b) => angleFor(a) - angleFor(b));
  const ring1 = byAngle.slice(0, RING_CAPACITY);
  const ring2 = byAngle.slice(RING_CAPACITY);

  // Work back from the outermost ring so everything fits the box.
  const outerRadius = maxRadius;
  const ring1Radius = ring2.length > 0 ? outerRadius - SECOND_RING_GAP : outerRadius;
  const boundaryRadius = Math.max(40, ring1Radius - RING_GAP);

  const place = (ring: 1 | 2, members: string[], radius: number): CanvasPoint[] => {
    if (members.length === 0) return [];
    // Even spacing keeps names from colliding; the hash only decides the
    // order and the starting offset, so positions stay stable.
    const offset = angleFor(members[0]);
    return members.map((id, index) => {
      const angle = offset + (index / members.length) * Math.PI * 2 - Math.PI / 2;
      // A few points of give per person so the ring reads as hand-placed,
      // not plotted. Stable per id; far too small to read as distance.
      const give = (fractionFor(id) - 0.5) * 10;
      return {
        id,
        x: cx + Math.cos(angle) * (radius + give),
        y: cy + Math.sin(angle) * (radius + give),
        ring,
        size: NODE_SIZE[ring],
      };
    });
  };

  const placed = [...place(1, ring1, ring1Radius), ...place(2, ring2, outerRadius)];
  const byId = new Map(placed.map((p) => [p.id, p]));

  // Inside marks: scattered by hash between 40% and 70% of the boundary,
  // never overlapping the centre avatar.
  const inside = insideIds.map((id) => {
    const r = boundaryRadius * (0.4 + fractionFor(id) * 0.3);
    const angle = angleFor(id);
    return { id, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });

  return {
    center: { x: cx, y: cy },
    boundaryRadius,
    outside: outsideIds.map((id) => byId.get(id) as CanvasPoint),
    inside,
  };
}
