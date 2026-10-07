import { describe, expect, it } from 'vitest';

import { CHAPTER_SIZE, MIX_FOLLOWED_COUNT, MIX_OUTSIDE_COUNT } from '@/constants/feed';
import { composeMixChapter, mergeOutsidePool } from '@/lib/feed-mix';

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

describe('composeMixChapter (regression)', () => {
  it('builds a full chapter in the fixed F F O pattern', () => {
    const mix = composeMixChapter(range('f', 20), range('o', 20));
    expect(mix.items).toHaveLength(CHAPTER_SIZE);
    expect(mix.usedFollowed).toBe(MIX_FOLLOWED_COUNT);
    expect(mix.usedOutside).toBe(MIX_OUTSIDE_COUNT);
    expect(mix.items.map((i) => i.kind).join(' ')).toBe(
      'followed followed outside followed followed outside followed followed outside followed followed outside',
    );
  });

  it('lets outside fill in when the circle runs short, and vice versa', () => {
    const fewFollowed = composeMixChapter(range('f', 2), range('o', 20));
    expect(fewFollowed.usedFollowed).toBe(2);
    expect(fewFollowed.usedOutside).toBe(CHAPTER_SIZE - 2);
    const fewOutside = composeMixChapter(range('f', 20), range('o', 1));
    expect(fewOutside.usedOutside).toBe(1);
    expect(fewOutside.usedFollowed).toBe(CHAPTER_SIZE - 1);
  });

  it('is empty when both pools are empty', () => {
    expect(composeMixChapter([], []).items).toEqual([]);
  });
});

describe('mergeOutsidePool', () => {
  const explore = range('e', 5).map((id) => ({ post: { id } }));

  it('puts adjacent posts first, then the Explore pool, without duplicates', () => {
    const pool = mergeOutsidePool([{ id: 'a1' }, { id: 'e2' }], explore, new Set());
    expect(pool.map((p) => (p.source === 'adjacent' ? `A:${p.post.id}` : `E:${p.item.post.id}`))).toEqual([
      'A:a1',
      'A:e2',
      'E:e1',
      'E:e3',
      'E:e4',
      'E:e5',
    ]);
  });

  it('skips anything already shown this session', () => {
    const pool = mergeOutsidePool([{ id: 'a1' }], explore, new Set(['a1', 'e1']));
    expect(pool.map((p) => (p.source === 'adjacent' ? p.post.id : p.item.post.id))).toEqual([
      'e2',
      'e3',
      'e4',
      'e5',
    ]);
  });

  it('falls back to the Explore pool alone when there is nothing adjacent', () => {
    const pool = mergeOutsidePool([], explore, new Set());
    expect(pool.every((p) => p.source === 'explore')).toBe(true);
    expect(pool).toHaveLength(5);
  });
});
