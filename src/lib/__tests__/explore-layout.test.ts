import { describe, expect, it } from 'vitest';

import { LABEL_HEIGHT, LABEL_WIDTH_EXTRA, layoutCanvas } from '../explore-layout';

/** The name label under a node: the text itself, narrower than its box. */
function label(p: { x: number; y: number; size: number }) {
  const w = p.size + LABEL_WIDTH_EXTRA - 8;
  return { left: p.x - w / 2, right: p.x + w / 2, top: p.y + p.size / 2 + 4, bottom: p.y + p.size / 2 + LABEL_HEIGHT };
}

/** The avatar circle's bounding box. */
function disc(p: { x: number; y: number; size: number }) {
  return { left: p.x - p.size / 2, right: p.x + p.size / 2, top: p.y - p.size / 2, bottom: p.y + p.size / 2 };
}

type Rect = ReturnType<typeof label>;
function overlaps(a: Rect, b: Rect) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** How far one rect intrudes into another, in points; 0 when apart. */
function intrusion(a: Rect, b: Rect) {
  if (!overlaps(a, b)) return 0;
  return Math.min(a.right - b.left, b.right - a.left, a.bottom - b.top, b.bottom - a.top);
}

/**
 * Two nodes clash when their discs come within 4pt, their labels touch, or
 * a label runs more than a few points into the other node (names are
 * centred and usually shorter than their box, so a corner graze is fine).
 */
function clash(a: { x: number; y: number; size: number }, b: typeof a) {
  const discs = Math.hypot(a.x - b.x, a.y - b.y) < (a.size + b.size) / 2 + 4;
  const labels = overlaps(label(a), label(b));
  const grazes = Math.max(intrusion(label(a), disc(b)), intrusion(label(b), disc(a)));
  return discs || labels || grazes > 6;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `person-${i}-${(i * 7919) % 1000}`);

describe('layoutCanvas', () => {
  const boxes = [
    { width: 390, height: 640 },
    { width: 390, height: 560 },
    { width: 375, height: 520 },
  ];

  for (const box of boxes) {
    for (const n of [1, 3, 7, 8, 12, 16, 18, 20, 22]) {
      it(`keeps ${n} people apart in a ${box.width}x${box.height} box`, () => {
        const { outside } = layoutCanvas(ids(n), [], box);
        expect(outside).toHaveLength(n);
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            expect(
              clash(outside[i], outside[j]),
              `${outside[i].id} (ring ${outside[i].ring}) overlaps ${outside[j].id} (ring ${outside[j].ring})`,
            ).toBe(false);
          }
        }
      });
    }

    it(`keeps everyone inside a ${box.width}x${box.height} box`, () => {
      for (const n of [7, 12, 20]) {
        for (const p of layoutCanvas(ids(n), [], box).outside) {
          expect(p.x - (p.size + LABEL_WIDTH_EXTRA) / 2).toBeGreaterThanOrEqual(0);
          expect(p.x + (p.size + LABEL_WIDTH_EXTRA) / 2).toBeLessThanOrEqual(box.width);
          expect(p.y - p.size / 2).toBeGreaterThanOrEqual(0);
          expect(p.y + p.size / 2 + LABEL_HEIGHT).toBeLessThanOrEqual(box.height);
        }
      }
    });
  }

  it('gives everyone on a ring the same size', () => {
    const { outside } = layoutCanvas(ids(18), [], { width: 390, height: 640 });
    for (const ring of [1, 2] as const) {
      const sizes = new Set(outside.filter((p) => p.ring === ring).map((p) => p.size));
      expect(sizes.size).toBe(1);
    }
  });

  it('is stable: the same person lands in the same place', () => {
    const a = layoutCanvas(ids(12), [], { width: 390, height: 640 });
    const b = layoutCanvas([...ids(12)].reverse(), [], { width: 390, height: 640 });
    for (const p of a.outside) {
      const q = b.outside.find((o) => o.id === p.id);
      expect(q).toEqual(p);
    }
  });
});
