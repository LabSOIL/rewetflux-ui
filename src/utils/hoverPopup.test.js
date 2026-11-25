import { describe, expect, it } from 'vitest';
import { insideSafeArea, insideTriangle } from './hoverPopup';

const RECT = { left: 100, right: 300, top: 10, bottom: 210 };

describe('insideTriangle', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  const c = { x: 0, y: 10 };

  it('holds the inside and the edges, whichever way the triangle winds', () => {
    expect(insideTriangle({ x: 2, y: 2 }, a, b, c)).toBe(true);
    expect(insideTriangle({ x: 2, y: 2 }, a, c, b)).toBe(true);
    expect(insideTriangle({ x: 5, y: 0 }, a, b, c)).toBe(true);
  });

  it('leaves out a point past the long edge', () => {
    expect(insideTriangle({ x: 6, y: 6 }, a, b, c)).toBe(false);
  });
});

describe('insideSafeArea', () => {
  const from = { x: 40, y: 50 };

  it('holds the popup itself', () => {
    expect(insideSafeArea({ x: 200, y: 200 }, from, RECT)).toBe(true);
  });

  it('holds a point on a diagonal from where the pointer left towards the popup', () => {
    expect(insideSafeArea({ x: 80, y: 120 }, from, RECT)).toBe(true);
  });

  it('leaves out a point that heads away from the popup', () => {
    expect(insideSafeArea({ x: 30, y: 60 }, from, RECT)).toBe(false);
    expect(insideSafeArea({ x: 60, y: 260 }, from, RECT)).toBe(false);
  });
});
