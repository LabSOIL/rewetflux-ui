import { useCallback, useEffect, useRef, useState } from 'react';

// A pointer that only passes over the trigger on its way elsewhere opens nothing.
export const OPEN_MS = 120;
// A pointer that strays off the popup, or wanders on its way to it, has this long to come back.
export const CLOSE_MS = 400;

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Whether `p` lies inside the triangle `a b c`, edges included, whichever way it winds. */
export function insideTriangle(p, a, b, c) {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/**
 * Whether `p` lies on the way from `from` (where the pointer left the trigger) to `rect`: inside
 * the rect, or inside the hull of the point and the rect, a fan of one triangle per edge.
 */
export function insideSafeArea(p, from, rect) {
  if (p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) return true;
  const corners = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
  return corners.some((corner, i) => insideTriangle(p, from, corner, corners[(i + 1) % 4]));
}

const point = event => ({ x: event.clientX, y: event.clientY });
const byMouse = event => event.pointerType === 'mouse';

/**
 * A popup that a mouse opens by resting on its trigger and that a click (or a tap, or a key)
 * pins open. A hovered popup closes once the pointer has been off both trigger and popup for
 * CLOSE_MS, and moving through the safe area towards the popup keeps restarting that wait. A
 * pinned popup stays until the trigger is pressed again, Escape is pressed, or something
 * outside is pressed.
 */
export function useHoverPopup({ onOpen } = {}) {
  const [state, setState] = useState('closed'); // 'closed' | 'hovered' | 'pinned'
  const trigger = useRef(null);
  const popup = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const leftAt = useRef(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    openTimer.current = closeTimer.current = null;
  };

  const show = useCallback(next => {
    clearTimers();
    leftAt.current = null;
    setState(prev => {
      if (prev === 'closed') onOpenRef.current?.();
      return next;
    });
  }, []);

  const close = useCallback(() => {
    clearTimers();
    leftAt.current = null;
    setState('closed');
  }, []);

  const closeLater = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      leftAt.current = null;
      setState(prev => (prev === 'hovered' ? 'closed' : prev));
    }, CLOSE_MS);
  };

  const enter = event => {
    if (!byMouse(event)) return;
    clearTimeout(closeTimer.current);
    leftAt.current = null;
    if (state === 'closed' && !openTimer.current) {
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        show('hovered');
      }, OPEN_MS);
    }
  };

  const leave = from => event => {
    if (!byMouse(event)) return;
    clearTimeout(openTimer.current);
    openTimer.current = null;
    if (state !== 'hovered') return;
    leftAt.current = from === 'trigger' ? point(event) : null;
    closeLater();
  };

  // While the pointer heads from the trigger to the popup, every step inside the safe area
  // restarts the wait; a step outside it lets the wait run out.
  useEffect(() => {
    if (state !== 'hovered') return undefined;
    const move = event => {
      const from = leftAt.current;
      if (!from || !popup.current || !byMouse(event)) return;
      if (insideSafeArea(point(event), from, popup.current.getBoundingClientRect())) closeLater();
    };
    document.addEventListener('pointermove', move);
    return () => document.removeEventListener('pointermove', move);
  }, [state]);

  useEffect(() => {
    if (state === 'closed') return undefined;
    const key = event => {
      if (event.key === 'Escape') close();
    };
    const press = event => {
      if (state !== 'pinned') return;
      if (trigger.current?.contains(event.target) || popup.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', press);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', press);
    };
  }, [state, close]);

  useEffect(() => clearTimers, []);

  // A click on a hovered popup's trigger pins it rather than closing what the user is about to use.
  const click = () => (state === 'pinned' ? close() : show('pinned'));

  return {
    open: state !== 'closed',
    pinned: state === 'pinned',
    close,
    triggerProps: {
      ref: trigger,
      onPointerEnter: enter,
      onPointerLeave: leave('trigger'),
      onClick: click,
      'aria-expanded': state !== 'closed',
      'aria-haspopup': 'dialog',
    },
    popupProps: {
      ref: popup,
      onPointerEnter: enter,
      onPointerLeave: leave('popup'),
    },
  };
}
