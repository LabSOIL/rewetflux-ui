import { describe, expect, it } from 'vitest';
import { signal } from './signal';

describe('signal', () => {
  it('tells its listeners when the value changes, and not when it is set to the same value', () => {
    const s = signal(1);
    const seen = [];
    const stop = s.subscribe(() => seen.push(s.get()));
    s.set(2);
    s.set(2);
    s.set(3);
    stop();
    s.set(4);
    expect(seen).toEqual([2, 3]);
    expect(s.get()).toBe(4);
  });
});
