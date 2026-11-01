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
 *
 * How many people a ring holds follows from its length: each node needs
 * its own width plus its name label beside the next one. When even two
 * rings are short of room, every node shrinks a little (all of a ring stay
 * the same size, so size still says nothing about a person).
 */

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
  /** 1 at full node size; below 1 when the box was too small for everyone. */
  scale: number;
}

/**
 * A canvas that may be larger than the screen: laid out in a box `spread`
 * times the visible one, shown at `fit` (= 1 / spread) so everyone is in
 * view at first, and free to be pinched closer and moved around.
 */
export interface CanvasPlan {
  layout: CanvasLayout;
  width: number;
  height: number;
  fit: number;
}

/** The canvas grows up to this many times the screen before nodes shrink. */
const MAX_SPREAD = 3;

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
/** The name label is drawn `size + LABEL_WIDTH_EXTRA` wide under the node. */
export const LABEL_WIDTH_EXTRA = 28;
/** Height of the name label plus its gap, below the node. */
export const LABEL_HEIGHT = 22;
/** Smallest the nodes go when the canvas is crowded. */
const MIN_SCALE = 0.7;

const RING_GAP = 44;
/**
 * Ring 1 to ring 2, centre to centre: a ring-1 half node, a ring-2 half
 * node, one label and a little air, so a node on one ring never touches a
 * node or label on the other whatever its angle.
 */
const SECOND_RING_GAP = NODE_SIZE[1] / 2 + NODE_SIZE[2] / 2 + LABEL_HEIGHT + 14;
/** Room at the sides of the box for a node and its name label. */
const EDGE_MARGIN_X = 46;
/** Room at the top and bottom of the box for a node and its name label. */
const EDGE_MARGIN_Y = 54;
/** Air between neighbours on the same ring. */
const AIR = 2;
/** The ring may stretch this much taller than wide to use a tall screen. */
const MAX_STRETCH = 1.45;

interface Ellipse {
  rx: number;
  ry: number;
}

/** Ramanujan's approximation; exact enough to count nodes. */
function perimeter({ rx, ry }: Ellipse): number {
  return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
}

/**
 * Centre-to-centre distance two neighbours on a ring need so that neither
 * node's label runs into the other node, whichever way round the ring they
 * sit. A label hangs under its node, so the tight case is a neighbour
 * diagonally below: clear when they are a label's half width plus a node's
 * half width apart sideways, or a node plus a label apart vertically.
 */
function spacing(size: number): number {
  const textHalf = (size + LABEL_WIDTH_EXTRA - 8) / 2;
  return Math.hypot(size / 2 + textHalf + AIR, size + LABEL_HEIGHT + AIR);
}

/** How many nodes of this size fit on the ring without labels touching. */
function capacity(ring: Ellipse, size: number): number {
  return Math.max(1, Math.floor(perimeter(ring) / spacing(size)));
}

/**
 * Walk the ring by distance rather than angle: on an ellipse equal angles
 * bunch people at the top and bottom, equal arc lengths do not. Returns a
 * function from a fraction of the way round [0, 1) to a point relative to
 * the centre, starting at the rightmost point and going clockwise on screen.
 */
function arcWalker({ rx, ry }: Ellipse): (fraction: number) => { x: number; y: number } {
  const steps = 360;
  const lengths = [0];
  let px = rx;
  let py = 0;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    lengths.push(lengths[i - 1] + Math.hypot(x - px, y - py));
    px = x;
    py = y;
  }
  const total = lengths[steps];
  return (fraction) => {
    const target = fraction * total;
    let lo = 0;
    let hi = steps;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const span = lengths[i] - lengths[i - 1] || 1;
    const t = ((i - 1 + (target - lengths[i - 1]) / span) / steps) * Math.PI * 2;
    return { x: Math.cos(t) * rx, y: Math.sin(t) * ry };
  };
}

/**
 * Where a person sits once they are inside the circle: scattered by hash
 * between 40% and 70% of the boundary, never on the centre avatar. Used
 * both for the inside marks and as the destination when someone is followed
 * from the canvas.
 */
export function insidePositionFor(
  id: string,
  center: { x: number; y: number },
  boundaryRadius: number,
): InsidePoint {
  const r = boundaryRadius * (0.4 + fractionFor(id) * 0.3);
  const angle = angleFor(id);
  return { id, x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
}

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
  const center = { x: cx, y: cy };

  // The outer ring fills the box; on a tall screen it is a little taller
  // than wide so the rows above and below the centre have room.
  const rx = Math.max(60, box.width / 2 - EDGE_MARGIN_X);
  const ry = Math.max(60, Math.min(box.height / 2 - EDGE_MARGIN_Y, rx * MAX_STRETCH));
  const outer: Ellipse = { rx, ry };
  // The inner ring keeps the same gap all round, but not so tall and thin
  // that it stops reading as a ring around the circle.
  const innerRx = rx - SECOND_RING_GAP;
  const inner: Ellipse = { rx: innerRx, ry: Math.min(ry - SECOND_RING_GAP, innerRx * 1.6) };

  const byAngle = [...outsideIds].sort((a, b) => angleFor(a) - angleFor(b));
  const n = byAngle.length;

  // One ring while it fits; two when it does not; smaller nodes when even
  // two rings are short of room.
  let scale = 1;
  let ring1: string[];
  let ring2: string[];
  let ring1Ellipse: Ellipse;
  if (n <= capacity(outer, NODE_SIZE[1])) {
    ring1 = byAngle;
    ring2 = [];
    ring1Ellipse = outer;
  } else {
    // Shrink in small steps until two rings hold everyone, or as far as
    // nodes may go; past that the outer ring simply gets a little closer.
    const room = (at: number) =>
      capacity(inner, NODE_SIZE[1] * at) + capacity(outer, NODE_SIZE[2] * at);
    while (room(scale) < n && scale > MIN_SCALE) scale = Math.max(MIN_SCALE, scale - 0.02);
    const cap1 = capacity(inner, NODE_SIZE[1] * scale);
    ring1 = byAngle.slice(0, Math.min(cap1, n));
    ring2 = byAngle.slice(ring1.length);
    ring1Ellipse = inner;
  }

  const boundaryRadius = Math.max(40, Math.min(ring1Ellipse.rx, ring1Ellipse.ry) - RING_GAP);

  const place = (ring: 1 | 2, members: string[], on: Ellipse, offset: number): CanvasPoint[] => {
    if (members.length === 0) return [];
    const size = Math.round(NODE_SIZE[ring] * scale);
    const along = arcWalker(on);
    // Even spacing along the ring keeps names from colliding; the hash only
    // decides the order and the starting offset, so positions stay stable.
    return members.map((id, index) => {
      const fraction = offset / (Math.PI * 2) + index / members.length - 0.25;
      const { x, y } = along(fraction - Math.floor(fraction));
      // A few points of give per person so the ring reads as hand-placed,
      // not plotted. Stable per id; far too small to read as distance.
      const give = 1 + ((fractionFor(id) - 0.5) * 4) / Math.min(on.rx, on.ry);
      return { id, x: cx + x * give, y: cy + y * give, ring, size };
    });
  };

  // The second ring starts half a step round from the first, so nodes on
  // the two rings sit between each other rather than in line.
  const offset1 = angleFor(ring1[0] ?? '');
  const offset2 = offset1 + (ring1.length > 0 ? Math.PI / ring1.length : 0);
  const placed = [...place(1, ring1, ring1Ellipse, offset1), ...place(2, ring2, outer, offset2)];
  const byId = new Map(placed.map((p) => [p.id, p]));

  return {
    center,
    boundaryRadius,
    outside: outsideIds.map((id) => byId.get(id) as CanvasPoint),
    inside: insideIds.map((id) => insidePositionFor(id, center, boundaryRadius)),
    scale,
  };
}

/**
 * Plan the canvas for a screen of `box`: the smallest spread (in steps of a
 * tenth) at which everyone fits at full size, shown zoomed out to fit. Past
 * MAX_SPREAD the nodes shrink instead, as before.
 */
export function planCanvas(
  outsideIds: readonly string[],
  insideIds: readonly string[],
  box: CanvasSize,
): CanvasPlan {
  let spread = 1;
  for (;;) {
    const width = box.width * spread;
    const height = box.height * spread;
    const layout = layoutCanvas(outsideIds, insideIds, { width, height });
    if (layout.scale === 1 || spread >= MAX_SPREAD) return { layout, width, height, fit: 1 / spread };
    spread = Math.round((spread + 0.1) * 10) / 10;
  }
}
