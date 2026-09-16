/**
 * Where people sit on the Explore canvas.
 *
 * Positions are purely for looking: nobody is closer to the centre because
 * they are popular, and nothing about a person is encoded in where they are.
 * Each person gets a stable angle from a hash of their id, so the same
 * person stays in roughly the same place from one session to the next, and
 * people are spread evenly around a ring in that order. More than
 * RING_CAPACITY people spill onto a second ring, again by hash order.
 */

export const RING_CAPACITY = 8;

export interface CanvasPoint {
  id: string;
  x: number;
  y: number;
  ring: 1 | 2;
  /** Node diameter in points. */
  size: number;
}

export interface CanvasSize {
  width: number;
  height: number;
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

export const NODE_SIZE = { 1: 60, 2: 50 } as const;

/**
 * Lay out people around the centre of the given box. Returns one point per
 * id, in the same order as the input.
 */
export function layoutPeople(ids: readonly string[], box: CanvasSize): CanvasPoint[] {
  if (ids.length === 0) return [];
  const cx = box.width / 2;
  const cy = box.height / 2;
  // Leave room for the node itself plus its name label below it.
  const margin = 44;
  const maxRadius = Math.min(box.width, box.height) / 2 - margin;

  const byAngle = [...ids].sort((a, b) => angleFor(a) - angleFor(b));
  const inner = byAngle.slice(0, RING_CAPACITY);
  const outer = byAngle.slice(RING_CAPACITY);

  const innerRadius = outer.length > 0 ? maxRadius * 0.55 : maxRadius * 0.82;
  const outerRadius = maxRadius;

  const place = (ring: 1 | 2, members: string[], radius: number): CanvasPoint[] => {
    if (members.length === 0) return [];
    // Even spacing keeps names from colliding; the hash only decides the
    // order and the starting offset, so positions stay stable.
    const offset = angleFor(members[0]);
    return members.map((id, index) => {
      const angle = offset + (index / members.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        ring,
        size: NODE_SIZE[ring],
      };
    });
  };

  const points = [...place(1, inner, innerRadius), ...place(2, outer, outerRadius)];
  const byId = new Map(points.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id) as CanvasPoint);
}
