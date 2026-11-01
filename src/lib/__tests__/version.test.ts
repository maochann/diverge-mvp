import { describe, expect, it } from 'vitest';

import { compareVersions, updateNeedFor } from '../version';

describe('compareVersions', () => {
  it('orders numerically, not as strings', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.3.0', '1.2.1')).toBeGreaterThan(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });
});

describe('updateNeedFor', () => {
  const policy = { latest: '1.3.0', min: '1.1.0' };
  it('is quiet when up to date or newer', () => {
    expect(updateNeedFor('1.3.0', policy)).toBe('none');
    expect(updateNeedFor('1.4.0', policy)).toBe('none');
  });
  it('offers an update when behind the store', () => {
    expect(updateNeedFor('1.2.1', policy)).toBe('optional');
  });
  it('requires an update below the supported floor', () => {
    expect(updateNeedFor('1.0.0', policy)).toBe('required');
  });
});
