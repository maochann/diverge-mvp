/**
 * Compare two dotted version strings ("1.2.10" > "1.2.9"). Missing parts
 * count as 0, non-numbers as 0; returns <0, 0 or >0 like a comparator.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface UpdatePolicy {
  /** The newest version on the store. */
  latest: string;
  /** Below this the app no longer works with the server; updating is required. */
  min: string;
}

export type UpdateNeed = 'none' | 'optional' | 'required';

/** What the installed version should do about the store's versions. */
export function updateNeedFor(installed: string, policy: UpdatePolicy): UpdateNeed {
  if (compareVersions(installed, policy.min) < 0) return 'required';
  if (compareVersions(installed, policy.latest) < 0) return 'optional';
  return 'none';
}
